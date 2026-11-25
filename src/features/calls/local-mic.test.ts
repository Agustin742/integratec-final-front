import { describe, expect, it, vi } from 'vitest';
import { FakeStream, asStream } from '@/test/calls/call-fakes';
import { createLocalMicControl } from './local-mic';

function setup(withStream = true) {
  const stream = new FakeStream();
  const control = createLocalMicControl({
    stream: withStream ? asStream(stream) : null,
  });
  return { stream, control, track: stream.tracks[0]! };
}

describe('createLocalMicControl (#141)', () => {
  it('disables the track while self muted and enables it again', () => {
    const { control, track } = setup();
    expect(control.setMuted(true)).toBe('ok');
    expect(track.enabled).toBe(false);
    expect(control.setMuted(false)).toBe('ok');
    expect(track.enabled).toBe(true);
  });

  it('keeps the track disabled while the server force-muted the user', () => {
    const { control, track } = setup();
    control.applyServer({ forcedMuted: true, allowSelfUnmute: false });
    expect(track.enabled).toBe(false);
    expect(control.getState().effectiveMuted).toBe(true);
  });

  it('refuses an unmute while force-muted and self unmute is not allowed', () => {
    const { control, track } = setup();
    control.applyServer({ forcedMuted: true, allowSelfUnmute: false });
    control.setMuted(true);
    expect(control.setMuted(false)).toBe('refused');
    expect(track.enabled).toBe(false);
    expect(control.getState().selfMuted).toBe(true);
  });

  it('allows an unmute while force-muted when self unmute is allowed', () => {
    const { control, track } = setup();
    control.applyServer({ forcedMuted: true, allowSelfUnmute: true });
    expect(control.setMuted(false)).toBe('ok');
    expect(track.enabled).toBe(true);
    // The server clears forcedMuted on that unmute; its next state agrees.
    control.applyServer({ forcedMuted: false, allowSelfUnmute: true });
    expect(track.enabled).toBe(true);
  });

  it('mutes again when the server force-mutes after a self unmute', () => {
    const { control, track } = setup();
    control.applyServer({ forcedMuted: false, allowSelfUnmute: true });
    control.applyServer({ forcedMuted: true, allowSelfUnmute: false });
    expect(track.enabled).toBe(false);
  });

  it('refuses to unmute without a microphone and stop() stops the tracks', () => {
    const none = setup(false);
    expect(none.control.setMuted(false)).toBe('refused');
    const { control, track } = setup();
    control.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(vi.isMockFunction(track.stop)).toBe(true);
  });
});
