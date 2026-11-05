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
  await expectAccessible(container);
});
