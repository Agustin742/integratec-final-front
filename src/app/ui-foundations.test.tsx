import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { render } from '@/test/render';
import { UiFoundations } from './ui-foundations';
import { messages } from './messages';

test('identifies every feedback state as a local example', () => {
  render(<UiFoundations />);
  const copy = messages.showcase;
  expect(screen.getByText(copy.localOnly)).toBeVisible();
  expect(screen.getByRole('button', { name: copy.loading })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('button', { name: copy.loading })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.getByText(copy.empty)).toBeVisible();
  expect(screen.getByText(copy.success)).toBeVisible();
  expect(screen.getByText(copy.error)).toBeVisible();
  expect(screen.getByText(copy.errorHelp)).toBeVisible();
});

test('associates example validation with an editable input and preserves text', () => {
  render(<UiFoundations />);
  const input = screen.getByRole('textbox', {
    name: messages.showcase.fieldLabel,
  });
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(
    `${messages.showcase.fieldHelp} ${messages.showcase.validation}`,
  );
  fireEvent.change(input, { target: { value: 'Example' } });
  expect(input).toHaveValue('Example');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});

test('provides a named empty table and keyboard-operated example tabs', async () => {
  render(<UiFoundations />);
  const copy = messages.showcase;
  expect(
    screen.getByRole('region', { name: copy.tableRegion }),
  ).toHaveAttribute('tabindex', '0');
  expect(
    within(screen.getByRole('table', { name: copy.tableCaption })).getByRole(
      'columnheader',
    ),
  ).toHaveTextContent(copy.column);
  const tab = screen.getByRole('tab', { name: copy.controls });
  tab.focus();
  fireEvent.keyDown(tab, { key: 'ArrowRight' });
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: copy.overlays })).toHaveAttribute(
      'aria-selected',
      'true',
    ),
  );
  expect(screen.getByRole('button', { name: copy.openSheet })).toBeVisible();
});

test('opens a named modal, isolates background and restores the trigger', async () => {
  render(<UiFoundations />);
  const copy = messages.showcase;
  const trigger = screen.getByRole('button', { name: copy.openDialog });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: copy.dialogTitle });
  expect(dialog).toHaveAccessibleDescription(copy.dialogDescription);
  await waitFor(() =>
    expect(dialog).toContainElement(document.activeElement as HTMLElement),
  );
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  await waitFor(() => expect(trigger).toHaveFocus());
});

test('opens a named sheet from its tab and restores focus on close', async () => {
  render(<UiFoundations />);
  const copy = messages.showcase;
  fireEvent.mouseDown(screen.getByRole('tab', { name: copy.overlays }), {
    button: 0,
    ctrlKey: false,
  });
  const trigger = screen.getByRole('button', { name: copy.openSheet });
  trigger.focus();
  fireEvent.click(trigger);
  expect(
    await screen.findByRole('dialog', { name: copy.sheetTitle }),
  ).toHaveAccessibleDescription(copy.sheetDescription);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  await waitFor(() => expect(trigger).toHaveFocus());
});
