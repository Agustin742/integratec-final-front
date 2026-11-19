import { afterEach, describe, expect, test } from 'vitest';
import { isEditableTarget, isInteractionBlocked } from './input-arbitration';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe('isEditableTarget', () => {
  test.each(['<input />', '<textarea></textarea>', '<select></select>'])(
    'treats %s as editable',
    (html) => {
      expect(isEditableTarget(mount(html))).toBe(true);
    },
  );

  test('treats contenteditable hosts and their descendants as editable', () => {
    const host = mount(
      '<div contenteditable="true"><span id="in">x</span></div>',
    );
    expect(isEditableTarget(host)).toBe(true);
    expect(isEditableTarget(host.querySelector('#in'))).toBe(true);
    expect(isEditableTarget(mount('<div contenteditable=""></div>'))).toBe(
      true,
    );
    expect(
      isEditableTarget(mount('<div contenteditable="plaintext-only"></div>')),
    ).toBe(true);
  });

  test('ignores plain elements, non-elements and null', () => {
    expect(isEditableTarget(mount('<button>ok</button>'))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('isInteractionBlocked', () => {
  test('is false with no dialog open', () => {
    mount('<main>content</main>');
    expect(isInteractionBlocked()).toBe(false);
  });

  test('is true while a role=dialog, role=alertdialog or aria-modal node is mounted', () => {
    mount('<div role="dialog"></div>');
    expect(isInteractionBlocked()).toBe(true);
    mount('<div role="alertdialog"></div>');
    expect(isInteractionBlocked()).toBe(true);
    mount('<div aria-modal="true"></div>');
    expect(isInteractionBlocked()).toBe(true);
    mount('<div aria-modal="false"></div>');
    expect(isInteractionBlocked()).toBe(false);
  });
});
