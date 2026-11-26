import type { RefObject } from 'react';
import type { NpcSpeech } from '../world/npc/npc-view';

export interface NpcSpeechBubbleProps {
  /**
   * Positioned wrapper. The world writes its screen anchor to it while the
   * phrase is visible (see `anchorProximityPrompt`), so following the bot
   * costs no re-render.
   */
  readonly anchorRef: RefObject<HTMLDivElement | null>;
  /** Phrase to show; undefined hides the bubble. */
  readonly speech: NpcSpeech | undefined;
}

/**
 * Speech bubble over a roaming NPC, plus the polite live region that reads the
 * phrase aloud. It lives in the DOM (not the canvas) so assistive tech gets the
 * text, and it is click-through so it never blocks the 3D world.
 */
export function NpcSpeechBubble({ anchorRef, speech }: NpcSpeechBubbleProps) {
  return (
    <>
      <div
        ref={anchorRef}
        hidden={speech === undefined}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pb-2"
      >
        {speech !== undefined && (
          <p
            data-testid="npc-speech-bubble"
            className="max-w-64 rounded-2xl border border-edge bg-card/95 px-3 py-2 text-center font-display text-sm font-semibold text-card-foreground shadow-panel backdrop-blur-md"
          >
            {speech.text}
          </p>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="npc-speech-status"
        className="sr-only"
      >
        {speech?.text ?? ''}
      </p>
    </>
  );
}
