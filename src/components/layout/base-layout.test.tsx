import { fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { expectAccessible } from '../../test/accessibility';
import { render } from '../../test/render';
import { BaseLayout } from './base-layout';
import { layoutMessages } from './messages';

test('renders header and main landmarks without an absent sidebar', async () => {
  const { container } = render(
    <BaseLayout header={<p>Header</p>}>
      <h1>Page</h1>
    </BaseLayout>,
  );
  expect(screen.getByRole('banner')).toHaveTextContent('Header');
  expect(
    within(screen.getByRole('main')).getByRole('heading'),
  ).toHaveTextContent('Page');
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  await expectAccessible(container);
});

test('names the optional sidebar and permits a caller-owned main destination', () => {
  render(
    <BaseLayout
      header="Header"
      sidebar={<p>Sidebar</p>}
      sidebarLabel="Sections"
      mainId="page-content"
    >
      <h1>Page</h1>
    </BaseLayout>,
  );
  expect(
    screen.getByRole('complementary', { name: 'Sections' }),
  ).toHaveTextContent('Sidebar');
  expect(
    screen.getByRole('link', { name: layoutMessages.skipToContent }),
  ).toHaveAttribute('href', '#page-content');
});

test('places the skip link first and focuses main when activated', () => {
  render(
    <BaseLayout header={<button>Header action</button>}>
      <h1>Page</h1>
    </BaseLayout>,
  );
  const skip = screen.getByRole('link', { name: layoutMessages.skipToContent });
  expect(skip.parentElement?.firstElementChild).toBe(skip);
  skip.focus();
  expect(skip).toHaveFocus();
  fireEvent.click(skip);
  expect(screen.getByRole('main')).toHaveFocus();
  expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
});

test('uses a localized default name for an optional sidebar', () => {
  render(
    <BaseLayout header="Header" sidebar="Sidebar">
      <h1>Page</h1>
    </BaseLayout>,
  );
  expect(
    screen.getByRole('complementary', { name: layoutMessages.sidebar }),
  ).toBeInTheDocument();
});
