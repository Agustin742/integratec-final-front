import { create } from 'zustand';

/**
 * Session-scoped state for the 2D Classic Mode offer (issue #56, FD8).
 *
 * The canvas probe fires `beginPerformanceOffer` once per sustained low-fps
 * period. The offer is never automatic: only the user's choice switches
 * modes, and a decline dismisses it for the rest of the app session
 * (in-memory, cleared on logout with the classroom mode preference).
 * Returning to 3D after accepting counts as a conditions change, so a later
 * sustained low period may offer again — but never after a decline.
 */
export type PerformanceOfferStatus =
  'idle' | 'offering' | 'declined' | 'accepted';

interface PerformanceOfferStoreState {
  readonly status: PerformanceOfferStatus;
  readonly beginOffer: () => void;
  readonly accept: () => void;
  readonly decline: () => void;
  readonly reset: () => void;
}

export const usePerformanceOfferStore = create<PerformanceOfferStoreState>(
  (set) => ({
    status: 'idle',
    beginOffer: () =>
      set((state) =>
        state.status === 'declined' ? state : { status: 'offering' },
      ),
    accept: () =>
      set((state) =>
        state.status === 'offering' ? { status: 'accepted' } : state,
      ),
    decline: () =>
      set((state) =>
        state.status === 'offering' ? { status: 'declined' } : state,
      ),
    reset: () =>
      set((state) => (state.status === 'idle' ? state : { status: 'idle' })),
  }),
);

/** Called by the canvas probe on each sustained low-fps period. */
export function beginPerformanceOffer(): void {
  usePerformanceOfferStore.getState().beginOffer();
}

/** Logout cleanup: one session's decision never leaks to the next. */
export function resetPerformanceOfferStore(): void {
  usePerformanceOfferStore.getState().reset();
}
