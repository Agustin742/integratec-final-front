import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  isEditableTarget,
  isInteractionBlocked,
} from '@/lib/input-arbitration';

/**
 * The E key as "interact with the nearby object". `onInteract` returns true
 * when it handled the press (a target existed); only then is the event
 * consumed. Text controls, open dialogs, modifier chords, key repeat and
 * already-handled events are ignored, so typing and shortcuts like Alt+M are
 * never affected. Matches `event.code`, so it works on any keyboard layout.
 */
export function useInteractKey(
  enabled: boolean,
  onInteract: () => boolean,
): void {
  const latest = useRef(onInteract);
  useLayoutEffect(() => {
    latest.current = onInteract;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat || event.defaultPrevented) {
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;
      if (isEditableTarget(document.activeElement)) return;
      if (isInteractionBlocked()) return;
      if (latest.current()) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
