import {
  createApiClient,
  requestApi,
  type TypedApiClient,
} from '../api/client';
import { ApiError } from '../api/errors';
import { getPublicConfig } from '../config/public-config';
import { assertSessionEpoch, createSessionMiddleware } from './middleware';
import {
  createSessionStorage,
  type SessionStorage,
  type StoredCredentials,
  type TokenPair,
} from './storage';
import {
  createAuthTransport,
  profileSchema,
  safeSessionError,
  type LoginInput,
  type OwnProfile,
} from './transport';

export type SessionSnapshot =
  | { readonly status: 'initializing' | 'unauthenticated' | 'unable-to-verify' }
  | { readonly status: 'authenticated'; readonly user: OwnProfile };
export interface SessionOptions {
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly storage?: SessionStorage;
  /** Inject alongside memory storage to model browser-tab ownership deterministically. */
  readonly tabOwner?: () => string | undefined;
  readonly now?: () => number;
}
export type LoginFailureReason =
  'invalid-credentials' | 'rate-limited' | 'network' | 'unexpected';

export type LoginResult =
  | { readonly ok: true; readonly cleanupFailed: boolean }
  | {
      readonly ok: false;
      readonly cleanupFailed: boolean;
      readonly reason: LoginFailureReason;
      readonly fieldErrors?: ApiError['fieldErrors'];
      readonly correlationId?: string;
    };

function classifyLoginError(
  error: unknown,
  fromProfileVerification = false,
): LoginFailureReason {
  if (error instanceof ApiError) {
    if (!fromProfileVerification && error.status === 401) {
      return 'invalid-credentials';
    }
    if (error.kind === 'rate-limited' || error.status === 429) {
      return 'rate-limited';
    }
    if (error.kind === 'network') {
      return 'network';
    }
  }
  return 'unexpected';
}

export interface SessionController {
  getSnapshot(): SessionSnapshot;
  getCleanupFailure(): boolean;
  subscribe(listener: () => void): () => void;
  registerCleanup(cleanup: () => void): () => void;
  releasePrivateState(): void;
  /**
   * Adopts a profile the server just confirmed for the signed-in user so the
   * shell never shows stale identity. Ignored for another account or when no
   * session is authenticated (a late response must not restore private data).
   */
  applyConfirmedProfile(profile: OwnProfile): void;
  getAccessToken(): string | undefined;
  refreshAccessToken(): Promise<string | undefined>;
  initialize(): Promise<void>;
  login(input: LoginInput): Promise<LoginResult>;
  adoptSession(pair: TokenPair): Promise<LoginResult>;
  logout(): Promise<{ serverConfirmed: boolean; cleanupFailed: boolean }>;
}
export interface SessionService {
  readonly controller: SessionController;
  readonly client: TypedApiClient;
}

export function createSession(options: SessionOptions = {}): SessionService {
  const baseUrl = options.baseUrl ?? getPublicConfig().apiBaseUrl;
  const clientOptions = { baseUrl, fetch: options.fetch };
  const client = createApiClient(clientOptions);
  const auth = createAuthTransport(clientOptions);
  const storage = createSessionStorage(options.storage, options.tabOwner);
  const initial = storage.read();
  let credentials = initial.credentials;
  let storageUnavailable = initial.unavailable;
  const now = options.now ?? Date.now;
  let snapshot: SessionSnapshot = Object.freeze({ status: 'initializing' });
  let epoch = 0;
  let revision = 0;
  let abort = new AbortController();
  let refreshing: Promise<void> | undefined;
  let refreshUnauthorized = false;
  let initializing: Promise<void> | undefined;
  let loginVerificationEpoch: number | undefined;
  let loggingOut:
    Promise<{ serverConfirmed: boolean; cleanupFailed: boolean }> | undefined;
  let cleanupFailed = false;
  const listeners = new Set<() => void>();
  const cleanups = new Set<() => void>();

  function publish(next: SessionSnapshot): void {
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        /* A subscriber must not interrupt credential cleanup. */
      }
    }
  }
  function releasePrivateState(): void {
    for (const cleanup of [...cleanups]) {
      try {
        cleanup();
      } catch {
        cleanupFailed = true;
      }
    }
  }
  function transition(
    status: 'initializing' | 'unauthenticated' | 'unable-to-verify',
    clear: boolean,
  ): void {
    epoch++;
    abort.abort();
    abort = new AbortController();
    refreshing = undefined;
    initializing = undefined;
    loggingOut = undefined;
    cleanupFailed = false;
    if (clear) {
      credentials = undefined;
      storageUnavailable = !storage.clear();
      cleanupFailed = storageUnavailable;
    }
    // Remove identity before invoking external owners; publish their safe result afterward.
    snapshot = Object.freeze({ status });
    releasePrivateState();
    publish(snapshot);
  }
  const epochPort = { epoch: () => epoch };
  function install(pair: TokenPair, expectedEpoch: number): void {
    assertSessionEpoch(epochPort, expectedEpoch);
    const stored: StoredCredentials = {
      ...pair,
      expiresAt: now() + pair.expiresIn * 1000,
    };
    if (!Number.isFinite(stored.expiresAt) || !storage.write(stored)) {
      credentials = undefined;
      storageUnavailable = true;
      throw safeSessionError();
    }
    credentials = stored;
    revision++;
    storageUnavailable = false;
  }
  function renew(
    expectedEpoch: number,
    sentRevision: number,
    cause: 'expiry' | 'unauthorized',
  ): Promise<void> {
    assertSessionEpoch(epochPort, expectedEpoch);
    if (sentRevision !== revision && credentials) return Promise.resolve();
    if (refreshing) {
      // A later protected 401 upgrades an expiry-started flight as well.
      refreshUnauthorized ||= cause === 'unauthorized';
      return refreshing;
    }
    refreshUnauthorized = cause === 'unauthorized';
    const refreshToken = credentials?.refreshToken;
    if (!refreshToken) return Promise.reject(safeSessionError());
    const signal = abort.signal;
    const pending = (async () => {
      try {
        const pair = await auth.refresh(refreshToken, signal);
        install(pair, expectedEpoch);
      } catch (error) {
        assertSessionEpoch(epochPort, expectedEpoch);
        const definitive =
          error instanceof ApiError &&
          (error.status === 400 ||
            error.status === 401 ||
            error.status === 403);
        const malformed =
          error instanceof ApiError &&
          error.kind === 'unexpected' &&
          error.status === null;
        const fromLogin = loginVerificationEpoch === expectedEpoch;
        transition(
          definitive || fromLogin ? 'unauthenticated' : 'unable-to-verify',
          definitive || malformed || refreshUnauthorized || fromLogin,
        );
        throw safeSessionError(error);
      }
    })();
    refreshing = pending;
    const release = () => {
      if (refreshing === pending) refreshing = undefined;
    };
    void pending.then(release, release);
    return pending;
  }
  client.use(
    createSessionMiddleware(
      {
        ...epochPort,
        signal: () => abort.signal,
        access: () => credentials?.accessToken,
        revision: () => revision,
        expired: () =>
          credentials !== undefined && credentials.expiresAt <= now(),
        renew,
        invalidate: () => transition('unauthenticated', true),
      },
      baseUrl,
    ),
  );

  async function verifySession(
    expectedEpoch: number,
    fromLogin = false,
  ): Promise<
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: LoginFailureReason }
  > {
    if (fromLogin) loginVerificationEpoch = expectedEpoch;
    try {
      const payload: unknown = await requestApi(() => client.GET('/users/me'));
      assertSessionEpoch(epochPort, expectedEpoch);
      const result = profileSchema.safeParse(payload);
      if (!result.success) throw safeSessionError();
      const user = Object.freeze({
        ...result.data,
        avatar: Object.freeze(result.data.avatar),
      });
      publish({ status: 'authenticated', user });
      return { ok: true };
    } catch (error) {
      if (epoch === expectedEpoch) {
        transition(
          fromLogin ? 'unauthenticated' : 'unable-to-verify',
          fromLogin,
        );
      }
      return { ok: false, reason: classifyLoginError(error, true) };
    } finally {
      if (fromLogin && loginVerificationEpoch === expectedEpoch) {
        loginVerificationEpoch = undefined;
      }
    }
  }

  const controller: SessionController = {
    getSnapshot: () => snapshot,
    getCleanupFailure: () => cleanupFailed,
    subscribe(listener) {
      // Each registration owns its own callback, including duplicate functions.
      const owned = () => listener();
      listeners.add(owned);
      return () => {
        listeners.delete(owned);
      };
    },
    releasePrivateState,
    applyConfirmedProfile(profile) {
      if (snapshot.status !== 'authenticated') return;
      if (snapshot.user.id !== profile.id) return;
      const result = profileSchema.safeParse(profile);
      if (!result.success) return;
      publish({
        status: 'authenticated',
        user: Object.freeze({
          ...result.data,
          avatar: Object.freeze(result.data.avatar),
        }),
      });
    },
    registerCleanup(cleanup) {
      const owned = () => cleanup();
      cleanups.add(owned);
      return () => {
        cleanups.delete(owned);
      };
    },
    getAccessToken() {
      return snapshot.status === 'authenticated'
        ? credentials?.accessToken
        : undefined;
    },
    async refreshAccessToken() {
      if (snapshot.status !== 'authenticated' || !credentials?.refreshToken) {
        return undefined;
      }
      const expectedEpoch = epoch;
      try {
        await renew(expectedEpoch, revision, 'expiry');
        return epoch === expectedEpoch && snapshot.status === 'authenticated'
          ? credentials?.accessToken
          : undefined;
      } catch {
        return undefined;
      }
    },
    initialize() {
      if (initializing) return initializing;
      if (snapshot.status === 'authenticated') return Promise.resolve();
      if (storageUnavailable) {
        publish({ status: 'unable-to-verify' });
        return Promise.resolve();
      }
      if (!credentials) {
        publish({ status: 'unauthenticated' });
        return Promise.resolve();
      }
      publish({ status: 'initializing' });
      const expectedEpoch = epoch;
      const pending = verifySession(expectedEpoch).then(() => {});
      initializing = pending;
      void pending.finally(() => {
        if (initializing === pending) initializing = undefined;
      });
      return pending;
    },
    async login(input) {
      transition('initializing', true);
      const expectedEpoch = epoch;
      const transitionCleanupFailed = cleanupFailed;
      try {
        if (storageUnavailable) throw safeSessionError();
        const pair = await auth.login(input, abort.signal);
        install(pair, expectedEpoch);
        const verification = await verifySession(expectedEpoch, true);
        if (verification.ok) {
          return {
            ok: true,
            cleanupFailed: transitionCleanupFailed || cleanupFailed,
          };
        }
        return {
          ok: false,
          cleanupFailed: transitionCleanupFailed || cleanupFailed,
          reason: verification.reason,
        };
      } catch (error) {
        if (epoch === expectedEpoch) {
          transition(
            storageUnavailable ? 'unable-to-verify' : 'unauthenticated',
            true,
          );
        }
        return {
          ok: false,
          cleanupFailed: transitionCleanupFailed || cleanupFailed,
          reason: classifyLoginError(error),
          ...(error instanceof ApiError && error.status !== 401
            ? {
                ...(Object.keys(error.fieldErrors).length > 0
                  ? { fieldErrors: error.fieldErrors }
                  : {}),
                ...(error.correlationId
                  ? { correlationId: error.correlationId }
                  : {}),
              }
            : {}),
        };
      }
    },
    async adoptSession(pair) {
      transition('initializing', true);
      const expectedEpoch = epoch;
      const transitionCleanupFailed = cleanupFailed;
      try {
        if (storageUnavailable) throw safeSessionError();
        install(pair, expectedEpoch);
        const verification = await verifySession(expectedEpoch, true);
        if (verification.ok) {
          return {
            ok: true,
            cleanupFailed: transitionCleanupFailed || cleanupFailed,
          };
        }
        return {
          ok: false,
          cleanupFailed: transitionCleanupFailed || cleanupFailed,
          reason: verification.reason,
        };
      } catch (error) {
        if (epoch === expectedEpoch) {
          transition(
            storageUnavailable ? 'unable-to-verify' : 'unauthenticated',
            true,
          );
        }
        return {
          ok: false,
          cleanupFailed: transitionCleanupFailed || cleanupFailed,
          reason: classifyLoginError(error),
        };
      }
    },
    logout() {
      if (loggingOut) return loggingOut;
      const accessToken = credentials?.accessToken;
      transition('unauthenticated', true);
      const expectedEpoch = epoch;
      const transitionCleanupFailed = cleanupFailed;
      const pending = (async () => {
        let serverConfirmed = false;
        if (accessToken) {
          try {
            await auth.logout(accessToken, abort.signal);
            serverConfirmed = epoch === expectedEpoch;
          } catch {
            /* Local logout remains complete; server invalidation is unconfirmed. */
          }
        }
        return { serverConfirmed, cleanupFailed: transitionCleanupFailed };
      })();
      loggingOut = pending;
      const release = () => {
        if (loggingOut === pending) loggingOut = undefined;
      };
      void pending.then(release, release);
      return pending;
    },
  };
  return { controller, client };
}
