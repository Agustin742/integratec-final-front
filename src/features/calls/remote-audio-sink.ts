type AudioElementLike = Pick<
  HTMLAudioElement,
  'srcObject' | 'muted' | 'autoplay' | 'play' | 'pause'
>;

export interface RemoteAudioSinkOptions {
  readonly createAudioElement?: () => AudioElementLike;
  readonly onNeedsUnlockChange?: (needsUnlock: boolean) => void;
}

export interface RemoteAudioSink {
  /** Starts (or restarts) playback of one peer's stream, honoring its mute state. */
  attach(peerId: string, stream: MediaStream, muted: boolean): void;
  /** Receiver-side mute: a muted peer is neither played nor decoded to output. */
  setMuted(peerId: string, muted: boolean): void;
  detach(peerId: string): void;
  /**
   * Retries playback of every unmuted peer. Call it from a click handler:
   * `Permissions-Policy: autoplay=()` makes the browser accept `play()` only
   * with user activation.
   */
  resume(): Promise<void>;
  needsAudioUnlock(): boolean;
  dispose(): void;
}

interface Entry {
  readonly peerId: string;
  readonly element: AudioElementLike;
  readonly stream: MediaStream;
  muted: boolean;
}

function createDefaultAudioElement(): AudioElementLike {
  return new Audio();
}

export function createRemoteAudioSink(
  options: RemoteAudioSinkOptions = {},
): RemoteAudioSink {
  const createElement = options.createAudioElement ?? createDefaultAudioElement;
  const entries = new Map<string, Entry>();
  let blocked = false;

  function setBlocked(next: boolean): void {
    if (blocked === next) return;
    blocked = next;
    options.onNeedsUnlockChange?.(next);
  }

  async function play(entry: Entry): Promise<boolean> {
    try {
      await entry.element.play();
      return true;
    } catch {
      return false;
    }
  }

  function apply(entry: Entry): void {
    for (const track of entry.stream.getAudioTracks()) {
      track.enabled = !entry.muted;
    }
    entry.element.muted = entry.muted;
    if (entry.muted) {
      entry.element.pause();
      return;
    }
    void play(entry).then((ok) => {
      if (!ok && entries.get(entry.peerId) === entry) setBlocked(true);
    });
  }

  return {
    attach(peerId, stream, muted) {
      entries.get(peerId)?.element.pause();
      const element = createElement();
      element.autoplay = true;
      element.srcObject = stream;
      const entry: Entry = { peerId, element, stream, muted };
      entries.set(peerId, entry);
      apply(entry);
    },
    setMuted(peerId, muted) {
      const entry = entries.get(peerId);
      if (!entry) return;
      entry.muted = muted;
      apply(entry);
    },
    detach(peerId) {
      const entry = entries.get(peerId);
      if (!entry) return;
      entry.element.pause();
      entry.element.srcObject = null;
      entries.delete(peerId);
    },
    async resume() {
      let allPlayed = true;
      for (const entry of entries.values()) {
        if (entry.muted) continue;
        if (!(await play(entry))) allPlayed = false;
      }
      setBlocked(!allPlayed);
    },
    needsAudioUnlock: () => blocked,
    dispose() {
      for (const peerId of [...entries.keys()]) this.detach(peerId);
      blocked = false;
    },
  };
}
