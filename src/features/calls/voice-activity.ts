/** RMS above which silence turns into speech; the lower off threshold gives hysteresis. */
const ON_THRESHOLD = 0.02;
const OFF_THRESHOLD = 0.012;
/** Keeps "speaking" through the short pauses between words. */
const HOLD_MS = 300;
const POLL_INTERVAL_MS = 50;
/** Speaking changes reach the network at most this often. */
const MIN_EMIT_INTERVAL_MS = 150;
/** RMS that maps to level 1 (a normal speaking voice peaks around 0.1-0.2). */
const LEVEL_FULL_SCALE = 0.15;
const LEVEL_ATTACK = 0.6;
const LEVEL_RELEASE = 0.15;

export interface SpeakingGateOptions {
  readonly onThreshold: number;
  readonly offThreshold: number;
  readonly holdMs: number;
}

export interface SpeakingGate {
  /** Feeds one RMS sample and returns whether the voice is considered active. */
  update(rms: number, nowMs: number): boolean;
}

/**
 * Hysteresis plus hold time: starts above `onThreshold`, stays on while the
 * level is above `offThreshold`, and only stops `holdMs` after the last
 * above-`offThreshold` sample.
 */
export function createSpeakingGate(options: SpeakingGateOptions): SpeakingGate {
  let speaking = false;
  let lastLoudAt = Number.NEGATIVE_INFINITY;
  return {
    update(rms, nowMs) {
      if (
        rms >= options.onThreshold ||
        (speaking && rms >= options.offThreshold)
      ) {
        speaking = true;
        lastLoudAt = nowMs;
      } else if (speaking && nowMs - lastLoudAt > options.holdMs) {
        speaking = false;
      }
      return speaking;
    },
  };
}

type AnalyserContext = Pick<
  AudioContext,
  'createAnalyser' | 'createMediaStreamSource'
>;

export interface VoiceActivityDetectorOptions {
  readonly audioContext: AnalyserContext;
  readonly stream: MediaStream;
  /** Fires on speaking transitions, throttled. Omit to only track the level. */
  readonly onSpeakingChange?: (speaking: boolean) => void;
  readonly now?: () => number;
  readonly schedule?: (tick: () => void, intervalMs: number) => () => void;
}

export interface VoiceActivityDetector {
  /** Smoothed loudness in 0..1, meant to drive avatar head motion. */
  getLevel(): number;
  isSpeaking(): boolean;
  dispose(): void;
}

function defaultSchedule(tick: () => void, intervalMs: number): () => void {
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}

export function createVoiceActivityDetector(
  options: VoiceActivityDetectorOptions,
): VoiceActivityDetector {
  const now = options.now ?? (() => Date.now());
  const schedule = options.schedule ?? defaultSchedule;
  const analyser = options.audioContext.createAnalyser();
  analyser.fftSize = 1024;
  const source = options.audioContext.createMediaStreamSource(options.stream);
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const gate = createSpeakingGate({
    onThreshold: ON_THRESHOLD,
    offThreshold: OFF_THRESHOLD,
    holdMs: HOLD_MS,
  });

  let level = 0;
  let speaking = false;
  let emitted = false;
  let lastEmitAt = Number.NEGATIVE_INFINITY;
  let disposed = false;

  const cancel = schedule(() => {
    if (disposed) return;
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const rms = Math.sqrt(sum / samples.length);
    const raw = Math.min(1, rms / LEVEL_FULL_SCALE);
    level += (raw - level) * (raw > level ? LEVEL_ATTACK : LEVEL_RELEASE);

    const at = now();
    speaking = gate.update(rms, at);
    if (speaking !== emitted && at - lastEmitAt >= MIN_EMIT_INTERVAL_MS) {
      emitted = speaking;
      lastEmitAt = at;
      options.onSpeakingChange?.(speaking);
    }
  }, POLL_INTERVAL_MS);

  return {
    getLevel: () => level,
    isSpeaking: () => speaking,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      source.disconnect();
    },
  };
}
