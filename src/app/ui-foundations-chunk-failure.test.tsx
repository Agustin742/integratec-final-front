import { screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { render } from '@/test/render';
import { UiFoundations } from './ui-foundations';
import { messages } from './messages';

// Lives in its own file because a rejected `vi.mock` factory result is cached
// after the first import, which would leak into the success-path tests.
vi.mock('@/features/world', () =>
  Promise.reject(new Error('chunk load failed')),
);

test('shows the world fallback and keeps controls when the lazy chunk fails', async () => {
  render(<UiFoundations />);
  expect(
    await screen.findByText('La vista 3D no está disponible'),
  ).toBeVisible();
  expect(
    screen.getByRole('textbox', { name: messages.showcase.fieldLabel }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: messages.showcase.openDialog }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Referencia técnica 3D' }),
  ).not.toBeInTheDocument();
});
