import { screen, within } from '@testing-library/react';
import { RouterProvider } from 'react-router/dom';
import { createMemoryRouter } from 'react-router';
import { expect, test } from 'vitest';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { messages } from '../messages';
import { createAppRoutes } from './routes';

function renderAt(path: string, options?: { showcase?: boolean }) {
  const router = createMemoryRouter(createAppRoutes(options), {
    initialEntries: [path],
  });
  return { router, ...render(<RouterProvider router={router} />) };
}

const pages = [
  ['/login', messages.pages.login.title],
  ['/register', messages.pages.register.title],
  ['/password-reset', messages.pages.passwordReset.title],
  ['/invitations/accept', messages.pages.invitationAccept.title],
  ['/', messages.pages.home.title],
] as const;

test.each(pages)(
  'renders %s lazily inside the application shell',
  async (path, title) => {
    renderAt(path);

    expect(
      await screen.findByRole('heading', { level: 2, name: title }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('main')).getByRole('heading', { name: title }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('banner')).getByRole('heading', {
        level: 1,
        name: messages.title,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Saltar al contenido/ }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('region', { name: /Notificaciones/ }),
    ).toHaveLength(1);
  },
);

test('renders the not found page for an unknown path', async () => {
  const { container } = renderAt('/no-such-page');

  expect(
    await screen.findByRole('heading', {
      level: 2,
      name: messages.pages.notFound.title,
    }),
  ).toBeVisible();
  expect(screen.getByRole('banner')).toBeVisible();
  await expectAccessible(container);
});

test('serves the component showcase at /dev/ui when it is enabled', async () => {
  renderAt('/dev/ui', { showcase: true });

  expect(
    await screen.findByRole(
      'heading',
      { name: messages.showcase.title },
      { timeout: 5000 },
    ),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: messages.showcase.title }),
  ).toHaveAttribute('href', '/dev/ui');
});

test('does not register the showcase route when it is disabled', async () => {
  renderAt('/dev/ui', { showcase: false });

  expect(
    await screen.findByRole('heading', {
      name: messages.pages.notFound.title,
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: messages.showcase.title }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: messages.showcase.title }),
  ).not.toBeInTheDocument();
});
