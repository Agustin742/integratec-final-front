import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { SessionService, SessionSnapshot } from './controller';

const SessionContext = createContext<SessionService | null>(null);

export interface SessionProviderProps {
  readonly service: SessionService;
  readonly children: ReactNode;
}

/** Gate replacement children until the previous private owners have been released. */
export function SessionProvider({ service, children }: SessionProviderProps) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState({ service, queryClient });
  useLayoutEffect(() => {
    const unregister = service.controller.registerCleanup(() => {
      // Cancellation takes effect synchronously; never wait before removing data.
      void queryClient.cancelQueries();
      queryClient.clear();
    });
    // This commit-time gate must acknowledge external cache teardown before B can render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional pre-paint ownership handoff
    setReady({ service, queryClient });
    void service.controller.initialize();
    return () => {
      // Layout cleanup precedes passive owner unregistration and new child exposure.
      service.controller.releasePrivateState();
      unregister();
    };
  }, [service, queryClient]);
  if (ready.service !== service || ready.queryClient !== queryClient)
    return null;
  return (
    <SessionContext.Provider value={service}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionService(): SessionService {
  const service = useContext(SessionContext);
  if (!service) throw new Error('SessionProvider is required.');
  return service;
}

/** Reading a snapshot subscribes to state; it does not initialize the service. */
export function useSessionSnapshot(): SessionSnapshot {
  const { controller } = useSessionService();
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}

/** Private state/subscription owners supply synchronous release callbacks. */
export function useSessionCleanup(cleanup: () => void): void {
  const { controller } = useSessionService();
  useEffect(() => controller.registerCleanup(cleanup), [controller, cleanup]);
}

export interface AuthenticatedContentProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}

/** Opt-in visibility only, not a route guard or backend authorization. */
export function AuthenticatedContent({
  children,
  fallback,
}: AuthenticatedContentProps) {
  return useSessionSnapshot().status === 'authenticated' ? children : fallback;
}
