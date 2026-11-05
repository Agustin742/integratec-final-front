import { screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { App } from './App';
import { messages } from './messages';

test('renders the bootstrap landmark and heading accessibly', async () => {
  const { container } = render(<App />);
  const main = screen.getByRole('main');
  const banner = screen.getByRole('banner');

  expect(
    within(banner).getByRole('heading', { level: 1, name: messages.title }),
  ).toBeInTheDocument();
  expect(within(main).getByText(messages.bootstrapReady)).toBeVisible();
  expect(
    within(main).queryByRole('heading', { level: 1 }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: messages.showcase.title }),
  ).toHaveAttribute('href', '#ui-foundations');
  expect(
    await within(main).findByRole(
      'heading',
      { name: messages.showcase.title },
      { timeout: 5000 },
    ),
  ).toBeVisible();
  expect(
    screen.getAllByRole('region', { name: /Notificaciones/ }),
  ).toHaveLength(1);
  await expectAccessible(container);
});
