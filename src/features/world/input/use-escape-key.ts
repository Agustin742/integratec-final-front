import { useEffect, useRef } from 'react';
import {
  isEditableTarget,
  isInteractionBlocked,
} from '@/lib/input-arbitration';

export interface UseEscapeKeyOptions {
  enabled: boolean;
  onEscape: () => void;
}

/**
 * Calls `onEscape` for a plain Escape press. Skipped for text controls, open
 * dialogs (which own Escape), modifier chords and already-handled events.
 * Never prevents the default, so other Escape handlers keep working.
 */
export function useEscapeKey({ enabled, onEscape }: UseEscapeKeyOptions): void {
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' && event.key !== 'Escape') return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
        return;
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;
      if (isInteractionBlocked()) return;
      latest.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
