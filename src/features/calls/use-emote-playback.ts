import { useEffect, useRef, useState } from 'react';
import { planEmote, type FaceMorph } from './call-emotes';

export interface EmotePlayback {
  /** Clip for `AvatarModel`: `Idle` or the running emote clip. */
  readonly animation: string;
  readonly morph: FaceMorph | null;
}

const IDLE: EmotePlayback = { animation: 'Idle', morph: null };

/**
 * Turns the room's `emote` + `emoteSeq` into an animation/morph pair that
 * returns to idle after the emote's duration. The emote already active when
 * the tile mounts is not replayed; only later sequence changes play.
 */
export function useEmotePlayback({
  emote,
  emoteSeq,
  clipNames,
  reduced,
}: {
  readonly emote: string;
  readonly emoteSeq: number;
  readonly clipNames: readonly string[];
  readonly reduced: boolean;
}): EmotePlayback {
  const [playback, setPlayback] = useState<EmotePlayback>(IDLE);
  const seen = useRef(emoteSeq);
  const latest = useRef({ emote, clipNames, reduced });
  useEffect(() => {
    latest.current = { emote, clipNames, reduced };
  });

  useEffect(() => {
    if (seen.current === emoteSeq) return;
    seen.current = emoteSeq;
    const current = latest.current;
    const plan = planEmote(current.emote, current.clipNames, current.reduced);
    if (!plan) return;
    setPlayback({ animation: plan.clip ?? 'Idle', morph: plan.morph });
    const timer = setTimeout(() => setPlayback(IDLE), plan.seconds * 1000);
    return () => clearTimeout(timer);
  }, [emoteSeq]);

  return playback;
}
