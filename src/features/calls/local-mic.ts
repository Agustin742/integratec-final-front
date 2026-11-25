export interface LocalMicServerState {
  readonly forcedMuted: boolean;
  readonly allowSelfUnmute: boolean;
}

export interface LocalMicState extends LocalMicServerState {
  readonly selfMuted: boolean;
  /** The track is disabled: the user asked for it or a moderator did. */
  readonly effectiveMuted: boolean;
  /** An unmute request would be accepted right now. */
  readonly canUnmute: boolean;
  readonly hasMicrophone: boolean;
}

export interface LocalMicControl {
  /** Applies the authoritative forced-mute / self-unmute flags of the call state. */
  applyServer(server: LocalMicServerState): void;
  /** `refused` when a moderator holds the mute (or there is no microphone). */
  setMuted(muted: boolean): 'ok' | 'refused';
  getState(): LocalMicState;
  stop(): void;
}

/**
 * Owns the local audio track's `enabled` flag. A muted track sends silence, so
 * mute is enforced at the source; the room state is only informed.
 */
export function createLocalMicControl(options: {
  readonly stream: MediaStream | null;
}): LocalMicControl {
  const tracks = options.stream?.getAudioTracks() ?? [];
  let selfMuted = options.stream === null;
  let forcedMuted = false;
  let allowSelfUnmute = true;
  // Unmuting while force-muted is only allowed with allowSelfUnmute; the server
  // then clears forcedMuted itself, which its next state confirms.
  let forcedOverridden = false;

  const effectiveMuted = () => selfMuted || (forcedMuted && !forcedOverridden);
  const sync = () => {
    for (const track of tracks) track.enabled = !effectiveMuted();
  };
  sync();

  return {
    applyServer(server) {
      if (!server.forcedMuted) forcedOverridden = false;
      forcedMuted = server.forcedMuted;
      allowSelfUnmute = server.allowSelfUnmute;
      sync();
    },
    setMuted(muted) {
      if (muted) {
        selfMuted = true;
        sync();
        return 'ok';
      }
      if (options.stream === null) return 'refused';
      if (forcedMuted && !forcedOverridden) {
        if (!allowSelfUnmute) return 'refused';
        forcedOverridden = true;
      }
      selfMuted = false;
      sync();
      return 'ok';
    },
    getState: () => ({
      selfMuted,
      forcedMuted,
      allowSelfUnmute,
      effectiveMuted: effectiveMuted(),
      canUnmute:
        options.stream !== null &&
        (!forcedMuted || forcedOverridden || allowSelfUnmute),
      hasMicrophone: options.stream !== null,
    }),
    stop() {
      for (const track of tracks) track.stop();
    },
  };
}
