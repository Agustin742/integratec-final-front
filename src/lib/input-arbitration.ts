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
