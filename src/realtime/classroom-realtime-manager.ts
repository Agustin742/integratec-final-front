import {
  createClassroomRealtimeClient,
  type ClassroomRealtimeClient,
  type RealtimeAuthPort,
  type RealtimeSdkClientLike,
} from './client';
import { MAX_CONNECTIONS_PER_USER } from './contracts.generated';

/** Wait before a failed connection is retried: 2s, 4s, ... capped at 30s. */
const RETRY_BASE_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 30_000;
/**
 * A released connection lingers briefly so that remounting UIs (StrictMode,
 * switching between the workspace and a floating chat) reuse it instead of
 * leaving and rejoining the room.
 */
const DEFAULT_RELEASE_GRACE_MS = 1_000;

export interface ClassroomRealtimeLease {
  readonly classroomId: string;
  readonly client: ClassroomRealtimeClient;
  /** Idempotent. The connection closes after the last lease is released. */
  release(): void;
}

export interface ClassroomRealtimeManager {
  /**
   * Returns a lease on the single connection of `classroomId`, opening it when
   * no other subscriber holds it. Returns `null` when the manager is disposed
   * or opening another classroom would exceed the per-user connection limit.
   */
  acquire(classroomId: string): ClassroomRealtimeLease | null;
  dispose(): void;
}

export interface CreateClassroomRealtimeManagerOptions {
  readonly auth: RealtimeAuthPort;
  readonly realtimeUrl?: string;
  readonly createSdkClient?: (endpoint: string) => RealtimeSdkClientLike;
  /** Defaults to the server-side `MAX_CONNECTIONS_PER_USER`. */
  readonly maxConnections?: number;
  readonly releaseGraceMs?: number;
}

interface ManagedConnection {
  readonly client: ClassroomRealtimeClient;
  leases: number;
  closeTimer: ReturnType<typeof setTimeout> | undefined;
  retryTimer: ReturnType<typeof setTimeout> | undefined;
  retries: number;
  unsubscribe: () => void;
}

/**
 * App-level owner of the Colyseus classroom connections: at most one
 * connection per classroom, shared by every subscriber (workspace, chat
 * dock, ...) and bounded by the per-user connection limit. Subscribers never
 * create their own client, so an extra UI can never consume a second slot of
 * the classroom room.
 */
export function createClassroomRealtimeManager(
  options: CreateClassroomRealtimeManagerOptions,
): ClassroomRealtimeManager {
  const maxConnections = options.maxConnections ?? MAX_CONNECTIONS_PER_USER;
  const graceMs = options.releaseGraceMs ?? DEFAULT_RELEASE_GRACE_MS;
  const connections = new Map<string, ManagedConnection>();
  let disposed = false;

  function close(classroomId: string, connection: ManagedConnection): void {
    clearTimeout(connection.closeTimer);
    clearTimeout(connection.retryTimer);
    connection.unsubscribe();
    connection.client.dispose();
    if (connections.get(classroomId) === connection) {
      connections.delete(classroomId);
    }
  }

  function open(classroomId: string): ManagedConnection {
    const client = createClassroomRealtimeClient({
      auth: options.auth,
      realtimeUrl: options.realtimeUrl,
      createSdkClient: options.createSdkClient,
    });
    const connection: ManagedConnection = {
      client,
      leases: 0,
      closeTimer: undefined,
      retryTimer: undefined,
      retries: 0,
      unsubscribe: () => {},
    };
    // Transient failures (network, verification unavailable) are retried with
    // backoff while somebody still needs the connection. Denials and lost
    // access are terminal: the REST history keeps working without live updates.
    connection.unsubscribe = client.subscribe(() => {
      const snapshot = client.getSnapshot();
      if (snapshot.status === 'connected') {
        clearTimeout(connection.retryTimer);
        connection.retryTimer = undefined;
        connection.retries = 0;
        return;
      }
      const transient =
        snapshot.status === 'disconnected' &&
        (snapshot.reason === 'connection-error' ||
          snapshot.reason === 'verification-unavailable');
      if (!transient || connection.retryTimer !== undefined) return;
      const delay = Math.min(
        RETRY_BASE_DELAY_MS * 2 ** connection.retries,
        RETRY_MAX_DELAY_MS,
      );
      connection.retries += 1;
      connection.retryTimer = setTimeout(() => {
        connection.retryTimer = undefined;
        if (disposed || connections.get(classroomId) !== connection) return;
        void client.connect(classroomId);
      }, delay);
    });
    connections.set(classroomId, connection);
    void client.connect(classroomId);
    return connection;
  }

  return {
    acquire(classroomId) {
      const id = classroomId.trim();
      if (disposed || id === '') return null;
      let connection = connections.get(id);
      if (connection !== undefined && connection.leases === 0) {
        const status = connection.client.getSnapshot().status;
        if (status === 'lost-access' || status === 'rejected') {
          close(id, connection);
          connection = undefined;
        }
      }
      if (connection === undefined) {
        if (connections.size >= maxConnections) return null;
        connection = open(id);
      }
      const owner = connection;
      clearTimeout(owner.closeTimer);
      owner.closeTimer = undefined;
      owner.leases += 1;
      let released = false;
      return {
        classroomId: id,
        client: owner.client,
        release() {
          if (released) return;
          released = true;
          owner.leases -= 1;
          if (owner.leases > 0) return;
          owner.closeTimer = setTimeout(() => {
            if (owner.leases === 0) close(id, owner);
          }, graceMs);
        },
      };
    },
    dispose() {
      disposed = true;
      for (const [classroomId, connection] of [...connections]) {
        close(classroomId, connection);
      }
    },
  };
}
