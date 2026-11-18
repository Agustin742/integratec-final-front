import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

export type ClassroomViewMode = '3d' | '2d';

interface ClassroomModeStoreState {
  readonly ownerUserId: string | null;
  readonly mode: ClassroomViewMode;
  readonly setOwnerMode: (userId: string, mode: ClassroomViewMode) => void;
  readonly syncOwner: (userId: string | null) => void;
  readonly reset: () => void;
}

const DEFAULT_MODE: ClassroomViewMode = '3d';

function normalizeUserId(userId: string | null | undefined): string | null {
  if (typeof userId !== 'string') {
    return null;
  }
  const trimmed = userId.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Per-user 3D / 2D Classic Mode preference store (`HU-ESP-003`, `#34`).
 *
 * Open decision documented in `#34` and `rules/classrooms-and-roles.md`:
 * until a backend user-profile field is contracted, the preference lives in an
 * in-memory client Zustand store keyed by authenticated `userId` and cleared
 * on logout or account switches so one user's preference never leaks to another.
 */
export const useClassroomModeStore = create<ClassroomModeStoreState>((set) => ({
  ownerUserId: null,
  mode: DEFAULT_MODE,
  setOwnerMode: (userId, mode) => set({ ownerUserId: userId, mode }),
  syncOwner: (userId) =>
    set((state) => {
      if (userId === null) {
        return state.ownerUserId === null && state.mode === DEFAULT_MODE
          ? state
          : { ownerUserId: null, mode: DEFAULT_MODE };
      }
      if (state.ownerUserId === userId) {
        return state;
      }
      return { ownerUserId: userId, mode: DEFAULT_MODE };
    }),
  reset: () => set({ ownerUserId: null, mode: DEFAULT_MODE }),
}));

export function getClassroomMode(userId: string | null): ClassroomViewMode {
  const normalized = normalizeUserId(userId);
  if (normalized === null) {
    return DEFAULT_MODE;
  }
  const state = useClassroomModeStore.getState();
  return state.ownerUserId === normalized ? state.mode : DEFAULT_MODE;
}

export function setClassroomMode(
  userId: string | null,
  mode: ClassroomViewMode,
): void {
  const normalized = normalizeUserId(userId);
  if (normalized === null) {
    return;
  }
  useClassroomModeStore.getState().setOwnerMode(normalized, mode);
}

export function toggleClassroomMode(userId: string | null): ClassroomViewMode {
  const normalized = normalizeUserId(userId);
  if (normalized === null) {
    return DEFAULT_MODE;
  }
  const next: ClassroomViewMode =
    getClassroomMode(normalized) === '3d' ? '2d' : '3d';
  useClassroomModeStore.getState().setOwnerMode(normalized, next);
  return next;
}

export function syncClassroomModeOwner(userId: string | null): void {
  useClassroomModeStore.getState().syncOwner(normalizeUserId(userId));
}

export function resetClassroomModeStore(): void {
  useClassroomModeStore.getState().reset();
}

export function useClassroomViewMode(userId: string | null): {
  readonly mode: ClassroomViewMode;
  readonly setMode: (next: ClassroomViewMode) => void;
  readonly toggleMode: () => ClassroomViewMode;
} {
  const normalized = normalizeUserId(userId);

  useEffect(() => {
    syncClassroomModeOwner(normalized);
  }, [normalized]);

  const mode = useClassroomModeStore((state) =>
    normalized !== null && state.ownerUserId === normalized
      ? state.mode
      : DEFAULT_MODE,
  );

  const setMode = useCallback(
    (next: ClassroomViewMode) => {
      setClassroomMode(normalized, next);
    },
    [normalized],
  );

  const toggleMode = useCallback(
    () => toggleClassroomMode(normalized),
    [normalized],
  );

  return { mode, setMode, toggleMode };
}
