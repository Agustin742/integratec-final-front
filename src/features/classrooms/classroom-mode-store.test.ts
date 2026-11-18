import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  getClassroomMode,
  resetClassroomModeStore,
  setClassroomMode,
  syncClassroomModeOwner,
  toggleClassroomMode,
  useClassroomViewMode,
} from './classroom-mode-store';

describe('classroom-mode-store (#34)', () => {
  beforeEach(() => {
    resetClassroomModeStore();
  });

  test('defaults every user to 3d mode and supports explicit set and toggle', () => {
    expect(getClassroomMode('user-a')).toBe('3d');

    setClassroomMode('user-a', '2d');
    expect(getClassroomMode('user-a')).toBe('2d');

    expect(toggleClassroomMode('user-a')).toBe('3d');
    expect(getClassroomMode('user-a')).toBe('3d');

    expect(toggleClassroomMode('user-a')).toBe('2d');
    expect(getClassroomMode('user-a')).toBe('2d');
  });

  test('S3: isolates preferences per account and drops prior owner state on account switch', () => {
    setClassroomMode('user-a', '2d');
    expect(getClassroomMode('user-a')).toBe('2d');

    // A second account never inherits the first user's 2D selection.
    expect(getClassroomMode('user-b')).toBe('3d');

    syncClassroomModeOwner('user-b');
    expect(getClassroomMode('user-b')).toBe('3d');
    // Switching back after another user signed in must not resurrect stale state.
    expect(getClassroomMode('user-a')).toBe('3d');
  });

  test('S3: resetClassroomModeStore clears active mode and owner on logout', () => {
    setClassroomMode('user-a', '2d');
    expect(getClassroomMode('user-a')).toBe('2d');

    resetClassroomModeStore();
    expect(getClassroomMode('user-a')).toBe('3d');
  });

  test('ignores blank or missing user identifiers', () => {
    setClassroomMode('   ', '2d');
    expect(getClassroomMode('   ')).toBe('3d');
    expect(toggleClassroomMode('')).toBe('3d');
  });

  test('useClassroomViewMode subscribes reactively and resets cleanly when userId changes', () => {
    const { result, rerender } = renderHook(
      ({ userId }: { readonly userId: string | null }) =>
        useClassroomViewMode(userId),
      { initialProps: { userId: 'user-a' as string | null } },
    );

    expect(result.current.mode).toBe('3d');

    act(() => {
      result.current.setMode('2d');
    });
    expect(result.current.mode).toBe('2d');

    // Switching to another user resets immediately without leaking user-a's 2D selection.
    rerender({ userId: 'user-b' });
    expect(result.current.mode).toBe('3d');

    // Returning to user-a does not revive the cleared preference.
    rerender({ userId: 'user-a' });
    expect(result.current.mode).toBe('3d');

    // Toggle through hook works for active user and resets when signed out (null).
    act(() => {
      result.current.toggleMode();
    });
    expect(result.current.mode).toBe('2d');

    rerender({ userId: null });
    expect(result.current.mode).toBe('3d');
  });
});
