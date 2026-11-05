import { screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { expectAccessible } from '../test/accessibility';
import { render } from '../test/render';
import { App } from './App';
import { messages } from './messages';

test('renders the bootstrap landmark and heading accessibly', async () => {
  const { container } = render(<App />);
  const main = screen.getByRole('main');

  expect(
    within(main).getByRole('heading', { level: 1, name: messages.title }),
  ).toBeInTheDocument();
  expect(within(main).getByText(messages.bootstrapReady)).toBeVisible();
  expect(screen.getByRole('banner')).toBeVisible();
  expect(
    screen.getByRole('link', { name: messages.showcase.title }),
  ).toHaveAttribute('href', '#ui-foundations');
  expect(
    within(main).getByRole('heading', { name: messages.showcase.title }),
  ).toBeVisible();
  expect(
    screen.getAllByRole('region', { name: /Notificaciones/ }),
  ).toHaveLength(1);
  await expectAccessible(container);
});
