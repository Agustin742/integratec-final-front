import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type { RealtimeSdkClientLike } from './client';
import {
  createClassroomRealtimeManager,
  type ClassroomRealtimeManager,
} from './classroom-realtime-manager';

const ClassroomRealtimeContext = createContext<ClassroomRealtimeManager | null>(
  null,
);

export interface ClassroomRealtimeProviderProps {
  readonly children: ReactNode;
  readonly realtimeUrl?: string;
  readonly createSdkClient?: (endpoint: string) => RealtimeSdkClientLike;
  readonly releaseGraceMs?: number;
}

/**
 * Owns the app-wide classroom realtime connections of the signed-in user.
 * Mount it once, below the session provider: every feature that needs live
 * classroom events (workspace, floating chat, ...) shares these connections
 * through `useClassroomRealtimeManager` instead of opening its own.
 *
 * The manager is created lazily on the first subscription, so signed-out and
 * non-classroom screens never open a connection, and it is replaced when the
 * account changes.
 */
export function ClassroomRealtimeProvider({
  children,
  realtimeUrl,
  createSdkClient,
  releaseGraceMs,
}: ClassroomRealtimeProviderProps) {
  const { controller } = useSessionService();
  const session = useSessionSnapshot();
  const userId = session.status === 'authenticated' ? session.user.id : null;
  const current = useRef<ClassroomRealtimeManager | null>(null);

  const lazyManager = useMemo<ClassroomRealtimeManager | null>(() => {
    if (userId === null) return null;
    return {
      acquire(classroomId) {
        current.current ??= createClassroomRealtimeManager({
          auth: controller,
          realtimeUrl,
          createSdkClient,
          releaseGraceMs,
        });
        return current.current.acquire(classroomId);
      },
      dispose() {
        current.current?.dispose();
        current.current = null;
      },
    };
  }, [controller, createSdkClient, realtimeUrl, releaseGraceMs, userId]);

  useEffect(() => {
    return () => lazyManager?.dispose();
  }, [lazyManager]);

  return (
    <ClassroomRealtimeContext.Provider value={lazyManager}>
      {children}
    </ClassroomRealtimeContext.Provider>
  );
}

/** `null` outside the provider or while signed out: callers degrade to REST only. */
export function useClassroomRealtimeManager(): ClassroomRealtimeManager | null {
  return useContext(ClassroomRealtimeContext);
}
