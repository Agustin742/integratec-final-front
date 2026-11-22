import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useEscapeKey } from './use-escape-key';

afterEach(() => {
  document.body.innerHTML = '';
});

function press(init: KeyboardEventInit = {}, target: EventTarget = window) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: 'Escape',
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

describe('useEscapeKey', () => {
  test('calls onEscape on Escape', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey({ enabled: true, onEscape }));
    press();
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  test('does nothing while disabled or after unmount', () => {
    const onEscape = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useEscapeKey({ enabled, onEscape }),
      { initialProps: { enabled: false } },
    );
    press();
    expect(onEscape).not.toHaveBeenCalled();
    rerender({ enabled: true });
    unmount();
    press();
    expect(onEscape).not.toHaveBeenCalled();
  });

  test('ignores other keys and modifier chords', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey({ enabled: true, onEscape }));
    press({ code: 'KeyA', key: 'a' });
    press({ ctrlKey: true });
    expect(onEscape).not.toHaveBeenCalled();
  });

  test('ignores Escape typed in a text control', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey({ enabled: true, onEscape }));
    const input = document.createElement('input');
    document.body.append(input);
    press({}, input);
    expect(onEscape).not.toHaveBeenCalled();
  });

  test('ignores Escape while a dialog is open', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey({ enabled: true, onEscape }));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    press();
    expect(onEscape).not.toHaveBeenCalled();
  });

  test('ignores an event another handler already consumed', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey({ enabled: true, onEscape }));
    window.addEventListener('keydown', (e) => e.preventDefault(), {
      capture: true,
      once: true,
    });
    press();
    expect(onEscape).not.toHaveBeenCalled();
  });
});
