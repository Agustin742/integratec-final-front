import { afterEach, describe, expect, test } from 'vitest';
import {
  isEditableTarget,
  isInteractionBlocked,
  usesArrowNavigation,
} from './input-arbitration';

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

describe('usesArrowNavigation', () => {
  test.each([
    '<div role="tablist"><button id="t" role="tab"></button></div>',
    '<div role="menu"><div id="t" role="menuitem"></div></div>',
    '<div role="menubar"><div id="t" tabindex="0"></div></div>',
    '<div role="listbox"><div id="t" role="option"></div></div>',
    '<div id="t" role="slider"></div>',
    '<div role="radiogroup"><div id="t" role="radio"></div></div>',
    '<div role="grid"><div id="t" tabindex="0"></div></div>',
    '<div role="tree"><div id="t" tabindex="0"></div></div>',
    '<div id="t" role="combobox"></div>',
    '<div id="t" role="spinbutton"></div>',
    '<input id="t" type="range" />',
    '<select id="t"></select>',
  ])('is true inside %s', (html) => {
    document.body.innerHTML = html;
    expect(usesArrowNavigation(document.querySelector('#t'))).toBe(true);
  });

  test('is true when the focused element is a widget even if the target is body', () => {
    document.body.innerHTML = '<div id="t" role="slider" tabindex="0"></div>';
    (document.querySelector('#t') as HTMLElement).focus();
    expect(usesArrowNavigation(document.body)).toBe(true);
  });

  test('is false for plain elements, body and null', () => {
    document.body.innerHTML = '<button id="t">ok</button>';
    expect(usesArrowNavigation(document.querySelector('#t'))).toBe(false);
    expect(usesArrowNavigation(document.body)).toBe(false);
    expect(usesArrowNavigation(null)).toBe(false);
  });
});
