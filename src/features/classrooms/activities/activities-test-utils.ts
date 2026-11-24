import { fireEvent, screen, within } from '@testing-library/react';
import { activityMessages } from './messages';

/** Opens the per-row overflow menu with the keyboard, like a real user would. */
export async function openRowMenu(title: string): Promise<HTMLElement> {
  const trigger = await screen.findByRole('button', {
    name: activityMessages.board.moreActionsAriaLabel(title),
  });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return trigger;
}

export type RowAction = 'edit' | 'publish' | 'deactivate';

const ACTION_LABELS: Record<RowAction, string> = {
  edit: activityMessages.actions.editAction,
  publish: activityMessages.actions.publishAction,
  deactivate: activityMessages.actions.deactivateAction,
};

/** Opens a row menu and chooses one of its actions. */
export async function chooseRowAction(
  title: string,
  action: RowAction,
): Promise<HTMLElement> {
  const trigger = await openRowMenu(title);
  const menu = await screen.findByRole('menu');
  fireEvent.click(
    within(menu).getByRole('menuitem', { name: ACTION_LABELS[action] }),
  );
  return trigger;
}

/** The overflow-menu trigger of a row (the focus target after dialogs close). */
export function getRowMenuTrigger(title: string): HTMLElement {
  return screen.getByRole('button', {
    name: activityMessages.board.moreActionsAriaLabel(title),
  });
}
