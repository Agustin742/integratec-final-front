import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useKeyboardDirection } from './use-keyboard-direction';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function key(
  type: 'keydown' | 'keyup',
  code: string,
  init: KeyboardEventInit = {},
  target: EventTarget = window,
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function setup(initial: { enabled?: boolean; resetKey?: string } = {}) {
  const onChange = vi.fn();
  const onPress = vi.fn();
  const hook = renderHook(
    (props: { enabled: boolean; resetKey: string }) =>
      useKeyboardDirection({ ...props, onChange, onPress }),
    {
      initialProps: {
        enabled: initial.enabled ?? true,
        resetKey: initial.resetKey ?? 'a',
      },
    },
  );
  return { ...hook, onChange, onPress };
}

const ZERO = { x: 0, z: 0 };

describe('useKeyboardDirection', () => {
  test('holds keys and reports the world direction, then releases', () => {
    const { onChange, onPress } = setup();
    const down = key('keydown', 'KeyW');
    expect(down.defaultPrevented).toBe(true);
    expect(onPress).toHaveBeenCalledTimes(1);
    const last = onChange.mock.lastCall![0] as { x: number; z: number };
    expect(last.x).toBeCloseTo(-Math.SQRT1_2);
    expect(last.z).toBeCloseTo(-Math.SQRT1_2);
    key('keyup', 'KeyW');
    expect(onChange).toHaveBeenLastCalledWith(ZERO);
  });

  test('ignores keydown from editable targets without preventing default', () => {
    const { onChange, onPress } = setup();
    const input = document.createElement('input');
    document.body.append(input);
    const event = key('keydown', 'KeyW', {}, input);
    expect(event.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  test.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'ignores keydown with modifier %o',
    (modifier) => {
      const { onChange } = setup();
      key('keydown', 'KeyW', modifier);
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  test('ignores arrow keys, but not WASD, inside focused navigation widgets', () => {
    const { onChange, onPress } = setup();
    document.body.innerHTML =
      '<div role="tablist"><button id="t" role="tab"></button></div>';
    const tab = document.querySelector('#t') as HTMLElement;
    tab.focus();
    const arrow = key('keydown', 'ArrowRight', {}, tab);
    expect(arrow.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    const wasd = key('keydown', 'KeyD', {}, tab);
    expect(wasd.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalled();
  });

  test('ignores keydown that another handler already prevented', () => {
    const { onChange } = setup();
    const el = document.createElement('div');
    document.body.append(el);
    el.addEventListener('keydown', (e) => e.preventDefault());
    key('keydown', 'KeyW', {}, el);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('ignores keydown while a dialog is open', () => {
    const { onChange } = setup();
    document.body.innerHTML = '<div role="dialog"></div>';
    key('keydown', 'KeyW');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('clears held keys on window blur', () => {
    const { onChange } = setup();
    key('keydown', 'KeyD');
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(onChange).toHaveBeenLastCalledWith(ZERO);
  });

  test('clears held keys when the page becomes hidden', () => {
    const { onChange } = setup();
    key('keydown', 'KeyD');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onChange).toHaveBeenLastCalledWith(ZERO);
  });

  test('clears held keys when an editable control takes focus', () => {
    const { onChange } = setup();
    key('keydown', 'KeyD');
    const input = document.createElement('input');
    document.body.append(input);
    act(() => {
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith(ZERO);
  });

  test('clears held keys when a dialog opens, so closing it never replays input', async () => {
    const { onChange } = setup();
    key('keydown', 'KeyD');
    act(() => {
      document.body.innerHTML = '<div role="dialog"></div>';
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(ZERO));
    act(() => {
      document.body.innerHTML = '';
    });
    onChange.mockClear();
    key('keyup', 'KeyD');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('clears on unmount and stops listening', () => {
    const { onChange, unmount } = setup();
    key('keydown', 'KeyD');
    unmount();
    expect(onChange).toHaveBeenLastCalledWith(ZERO);
    onChange.mockClear();
    key('keydown', 'KeyD');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('clears when disabled and ignores keys while disabled', () => {
    const { onChange, rerender } = setup();
    key('keydown', 'KeyD');
    rerender({ enabled: false, resetKey: 'a' });
    expect(onChange).toHaveBeenLastCalledWith(ZERO);
    onChange.mockClear();
    key('keydown', 'KeyD');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('clears when the reset key changes', () => {
    const { onChange, rerender } = setup();
    key('keydown', 'KeyD');
    rerender({ enabled: true, resetKey: 'b' });
    expect(onChange).toHaveBeenLastCalledWith(ZERO);
    onChange.mockClear();
    key('keyup', 'KeyD');
    expect(onChange).not.toHaveBeenCalled();
  });
});
