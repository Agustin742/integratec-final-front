import { useEffect, useRef } from 'react';
import {
  isEditableTarget,
  isInteractionBlocked,
} from '@/lib/input-arbitration';
import type { Direction } from '../movement';
import { createKeyboardState } from './keyboard-direction';

export interface UseKeyboardDirectionOptions {
  /** When false the hook listens to nothing and holds no keys. */
  enabled: boolean;
  /** Changing it (e.g. the classroom id) drops every held key. */
  resetKey: string;
  /** Called with the new world direction whenever the held keys change. */
  onChange: (direction: Direction) => void;
  /** Called on every accepted movement keydown, even if the net direction is unchanged. */
  onPress?: () => void;
}

const ZERO: Direction = { x: 0, z: 0 };

/**
 * WASD / arrow keys as a world-space direction. Keydown is ignored for text
 * controls, open dialogs, modifier chords and already-handled events. Held
 * keys are dropped on blur, hidden page, editable focus, dialog open, disable,
 * `resetKey` change and unmount, so no input is ever replayed later.
 */
export function useKeyboardDirection({
  enabled,
  resetKey,
  onChange,
  onPress,
}: UseKeyboardDirectionOptions): void {
  const callbacks = useRef({ onChange, onPress });
  useEffect(() => {
    callbacks.current = { onChange, onPress };
  });

  useEffect(() => {
    if (!enabled) return;
    const state = createKeyboardState();
    const emit = () => callbacks.current.onChange(state.direction());
    const clear = () => {
      if (!state.hasHeldKeys()) return;
      state.clear();
      callbacks.current.onChange(ZERO);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (isEditableTarget(event.target)) return;
      if (isInteractionBlocked()) {
        clear();
        return;
      }
      if (!state.press(event.code)) return;
      event.preventDefault();
      callbacks.current.onPress?.();
      emit();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      // Releases always count, wherever focus went, or a key could stay stuck.
      if (state.release(event.code)) emit();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clear();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isEditableTarget(event.target)) clear();
    };
    const observer = new MutationObserver(() => {
      if (isInteractionBlocked()) clear();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal'],
    });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('focusin', onFocusIn);
      observer.disconnect();
      clear();
    };
  }, [enabled, resetKey]);
}
