import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  FakeStream,
  asStream,
} from '@/test/calls/call-fakes';
import {
  createSpeakingGate,
  createVoiceActivityDetector,
} from './voice-activity';

describe('createSpeakingGate (#141)', () => {
  const options = { onThreshold: 0.02, offThreshold: 0.01, holdMs: 300 };

  it('starts speaking only above the on threshold', () => {
    const gate = createSpeakingGate(options);
    expect(gate.update(0.015, 0)).toBe(false);
    expect(gate.update(0.03, 10)).toBe(true);
  });

  it('keeps speaking inside the hysteresis band', () => {
    const gate = createSpeakingGate(options);
    gate.update(0.03, 0);
    expect(gate.update(0.015, 50)).toBe(true);
    expect(gate.update(0.015, 5_000)).toBe(true);
  });

  it('holds the speaking state for holdMs after the level drops', () => {
    const gate = createSpeakingGate(options);
    gate.update(0.03, 0);
    expect(gate.update(0.001, 100)).toBe(true);
    expect(gate.update(0.001, 299)).toBe(true);
    expect(gate.update(0.001, 301)).toBe(false);
  });

  it('a new burst inside the hold window restarts it', () => {
    const gate = createSpeakingGate(options);
    gate.update(0.03, 0);
    gate.update(0.001, 100);
    gate.update(0.03, 250);
    expect(gate.update(0.001, 500)).toBe(true);
    expect(gate.update(0.001, 600)).toBe(false);
  });
});

describe('createVoiceActivityDetector (#141)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const context = new FakeAudioContext();
    const changes: boolean[] = [];
    const detector = createVoiceActivityDetector({
      audioContext: context as unknown as AudioContext,
      stream: asStream(new FakeStream()),
      onSpeakingChange: (speaking) => changes.push(speaking),
      now: () => Date.now(),
    });
    return { context, changes, detector, analyser: context.analysers[0]! };
  }

  it('emits speaking changes and a 0..1 smoothed level', () => {
    const { changes, detector, analyser } = setup();
    analyser.amplitude = 0.1;
    vi.advanceTimersByTime(200);
    expect(changes).toEqual([true]);
    expect(detector.getLevel()).toBeGreaterThan(0.3);
    expect(detector.getLevel()).toBeLessThanOrEqual(1);
    analyser.amplitude = 0;
    vi.advanceTimersByTime(2_000);
    expect(changes).toEqual([true, false]);
    expect(detector.getLevel()).toBeLessThan(0.05);
    detector.dispose();
  });

  it('throttles flapping so changes are at least minEmitInterval apart', () => {
    const { changes, detector, analyser } = setup();
    for (let i = 0; i < 20; i += 1) {
      analyser.amplitude = i % 2 === 0 ? 0.1 : 0;
      vi.advanceTimersByTime(20);
    }
    expect(changes.length).toBeLessThanOrEqual(3);
    detector.dispose();
  });

  it('stops polling and disconnects the source on dispose', () => {
    const { context, changes, detector, analyser } = setup();
    detector.dispose();
    analyser.amplitude = 0.5;
    vi.advanceTimersByTime(1_000);
    expect(changes).toEqual([]);
    expect(context.sourceDisconnects).toHaveBeenCalled();
  });
});
