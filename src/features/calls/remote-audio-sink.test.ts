import { describe, expect, it } from 'vitest';
import {
  FakeAudioElement,
  FakeStream,
  asStream,
} from '@/test/calls/call-fakes';
import { createRemoteAudioSink } from './remote-audio-sink';

function setup() {
  const elements: FakeAudioElement[] = [];
  const unlockStates: boolean[] = [];
  const sink = createRemoteAudioSink({
    createAudioElement: () => {
      const element = new FakeAudioElement();
      elements.push(element);
      return element as unknown as HTMLAudioElement;
    },
    onNeedsUnlockChange: (needs) => unlockStates.push(needs),
  });
  return { sink, elements, unlockStates };
}

describe('createRemoteAudioSink (#141)', () => {
  it('plays one audio element per peer', async () => {
    const { sink, elements } = setup();
    const a = new FakeStream();
    sink.attach('A', asStream(a), false);
    sink.attach('B', asStream(new FakeStream()), false);
    await Promise.resolve();
    expect(elements).toHaveLength(2);
    expect(elements[0]!.srcObject).toBe(a);
    expect(elements[0]!.play).toHaveBeenCalled();
  });

  it('does not play a muted peer and disables its tracks (receiver-side)', async () => {
    const { sink, elements } = setup();
    const stream = new FakeStream();
    sink.attach('A', asStream(stream), true);
    await Promise.resolve();
    expect(elements[0]!.muted).toBe(true);
    expect(elements[0]!.play).not.toHaveBeenCalled();
    expect(stream.tracks[0]!.enabled).toBe(false);
  });

  it('mutes and unmutes an attached peer as its flags change', () => {
    const { sink, elements } = setup();
    const stream = new FakeStream();
    sink.attach('A', asStream(stream), false);
    sink.setMuted('A', true);
    expect(elements[0]!.pause).toHaveBeenCalled();
    expect(stream.tracks[0]!.enabled).toBe(false);
    sink.setMuted('A', false);
    expect(stream.tracks[0]!.enabled).toBe(true);
    expect(elements[0]!.muted).toBe(false);
    expect(elements[0]!.play).toHaveBeenCalledTimes(2);
  });

  it('flags needsAudioUnlock when play() is rejected and clears it on resume()', async () => {
    const { sink, elements, unlockStates } = setup();
    sink.attach('A', asStream(new FakeStream()), false);
    elements[0]!.rejectPlay = true;
    sink.setMuted('A', true);
    sink.setMuted('A', false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sink.needsAudioUnlock()).toBe(true);
    expect(unlockStates).toEqual([true]);
    elements[0]!.rejectPlay = false;
    await sink.resume();
    expect(sink.needsAudioUnlock()).toBe(false);
    expect(unlockStates).toEqual([true, false]);
  });

  it('detach releases the stream and dispose releases every peer', () => {
    const { sink, elements } = setup();
    sink.attach('A', asStream(new FakeStream()), false);
    sink.attach('B', asStream(new FakeStream()), false);
    sink.detach('A');
    expect(elements[0]!.srcObject).toBeNull();
    sink.dispose();
    expect(elements[1]!.srcObject).toBeNull();
  });
});
