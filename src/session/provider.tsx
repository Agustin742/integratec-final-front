import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { SessionService, SessionSnapshot } from './controller';

const SessionContext = createContext<SessionService | null>(null);

export interface SessionProviderProps {
  readonly service: SessionService;
  readonly children: ReactNode;
}

/** The application owns service identity; this effect owns Query cleanup. */
export function SessionProvider({ service, children }: SessionProviderProps) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unregister = service.controller.registerCleanup(() => {
      // Cancellation takes effect synchronously; never wait before removing data.
      void queryClient.cancelQueries();
      queryClient.clear();
    });
    void service.controller.initialize();
    return unregister;
  }, [service, queryClient]);
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
