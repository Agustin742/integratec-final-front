const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

const BLOCKING_OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"]';

/** Whether keyboard input aimed at `target` belongs to a text control and must not trigger shortcuts. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest(EDITABLE_SELECTOR) !== null;
}

/** Whether an open dialog or modal currently owns interaction, so background input must be ignored. */
export function isInteractionBlocked(): boolean {
  return document.querySelector(BLOCKING_OVERLAY_SELECTOR) !== null;
}

const ARROW_NAVIGATION_SELECTOR = [
  '[role="tablist"]',
  '[role="tab"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="radiogroup"]',
  '[role="radio"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="combobox"]',
  '[role="spinbutton"]',
  'input[type="range"]',
  'select',
].join(', ');

function insideArrowWidget(node: EventTarget | null): boolean {
  return (
    node instanceof HTMLElement &&
    node.closest(ARROW_NAVIGATION_SELECTOR) !== null
  );
}

/**
 * Whether the event target, or the focused element, is inside a widget that
 * uses the arrow keys natively (tabs, menus, sliders, selects...). Arrow keys
 * must stay with it instead of moving the avatar.
 */
export function usesArrowNavigation(target: EventTarget | null): boolean {
  return insideArrowWidget(target) || insideArrowWidget(document.activeElement);
}
