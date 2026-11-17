import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { WorldReference } from './world-reference';
import { worldMessages as copy } from './messages';

vi.mock('./world-canvas', () => ({
  WorldCanvas: ({ label }: { label: string }) => (
    <div role="region" aria-label={label} />
  ),
}));

test('keeps the equivalent DOM action outside the canvas and reports only local selection', () => {
  render(<WorldReference />);
  const world = screen.getByRole('region', { name: copy.canvas });
  expect(within(world).queryByRole('button')).not.toBeInTheDocument();
  const button = screen.getByRole('button', { name: copy.select });
  button.focus();
  expect(button).toHaveFocus();
  expect(button.tagName).toBe('BUTTON');
  fireEvent.click(button);
  expect(screen.getByRole('status')).toHaveTextContent(copy.selected);
  expect(screen.getByText(copy.description)).toBeVisible();
});
