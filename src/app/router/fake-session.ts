import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type { SessionService, SessionSnapshot } from '@/session/controller';

/**
 * Session service whose snapshot the test drives directly. `client` is the API
 * client the service exposes (a real one pointed at MSW when a test needs HTTP).
 */
export function fakeSession(
  initial: SessionSnapshot,
  client: SessionService['client'] = {} as SessionService['client'],
) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const initialize = vi.fn(() => Promise.resolve());
  const service = {
    client,
    controller: {
      getSnapshot: () => snapshot,
      getCleanupFailure: () => false,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      registerCleanup: () => () => {},
      releasePrivateState: () => {},
      initialize,
      login: vi.fn(),
      adoptSession: vi.fn(async () => {
        snapshot = {
          status: 'authenticated',
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'user@example.test',
            displayName: 'Test User',
            avatar: {
              bodyId: 'male',
              hairId: 'afro',
              topId: 'hoodie',
              hairColor: '#6C4D48',
              clothingColor: '#5B4F96',
            },
          },
        };
        listeners.forEach((listener) => listener());
        return { ok: true, cleanupFailed: false };
      }),
      logout: vi.fn(),
    },
  } as unknown as SessionService;
  return {
    service,
    initialize,
    set(next: SessionSnapshot) {
      act(() => {
        snapshot = next;
        listeners.forEach((listener) => listener());
      });
    },
  };
}
