import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmotePlayback } from './use-emote-playback';

const CLIPS = ['Idle', 'Wave', 'Happy', 'Think', 'Cheer', 'Dance', 'RaiseHand'];

type Props = { emote: string; seq: number; reduced?: boolean };

function setup(initial: Props) {
  return renderHook(
    ({ emote, seq, reduced = false }: Props) =>
      useEmotePlayback({ emote, emoteSeq: seq, clipNames: CLIPS, reduced }),
    { initialProps: initial },
  );
}

describe('useEmotePlayback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts idle and does not replay the emote already active on mount', () => {
    const { result } = setup({ emote: 'wave', seq: 3 });
    expect(result.current).toEqual({ animation: 'Idle', morph: null });
  });

  it('plays the clip and face morph when the sequence changes, then returns to idle', () => {
    const { result, rerender } = setup({ emote: '', seq: 0 });
    rerender({ emote: 'celebrate', seq: 1 });
    expect(result.current).toEqual({ animation: 'Cheer', morph: 'Happy' });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toEqual({ animation: 'Idle', morph: null });
  });

  it('keeps the body on Idle for a face-only emote', () => {
    const { result, rerender } = setup({ emote: '', seq: 0 });
    rerender({ emote: 'happy', seq: 1 });
    expect(result.current).toEqual({ animation: 'Idle', morph: 'Happy' });
  });

  it('restarts when the same emote is sent again', () => {
    const { result, rerender } = setup({ emote: '', seq: 0 });
    rerender({ emote: 'wave', seq: 1 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender({ emote: 'wave', seq: 2 });
    act(() => {
      vi.advanceTimersByTime(1000); // 3s after the first, 1s after the second
    });
    expect(result.current.animation).toBe('Wave');
  });

  it('uses only the face morph under reduced motion', () => {
    const { result, rerender } = setup({ emote: '', seq: 0, reduced: true });
    rerender({ emote: 'happy', seq: 1, reduced: true });
    expect(result.current).toEqual({ animation: 'Idle', morph: 'Happy' });
  });

  it('plays newly added dance clip with Happy morph and returns to idle', () => {
    const { result, rerender } = setup({ emote: '', seq: 0 });
    rerender({ emote: 'dance', seq: 1 });
    expect(result.current).toEqual({ animation: 'Dance', morph: 'Happy' });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toEqual({ animation: 'Idle', morph: null });
  });

  it('returns to idle when an unknown emote follows a running one', () => {
    const { result, rerender } = setup({ emote: '', seq: 0 });
    rerender({ emote: 'wave', seq: 1 });
    expect(result.current.animation).toBe('Wave');
    rerender({ emote: 'backflip', seq: 2 });
    expect(result.current).toEqual({ animation: 'Idle', morph: null });
  });

  it('ignores unknown emotes', () => {
    const { result, rerender } = setup({ emote: '', seq: 0 });
    rerender({ emote: 'backflip', seq: 1 });
    expect(result.current).toEqual({ animation: 'Idle', morph: null });
  });
});
