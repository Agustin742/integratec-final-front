import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider } from 'react-router/dom';
import { createMemoryRouter } from 'react-router';
import { expect, test } from 'vitest';
import { expectAccessible } from '@/test/accessibility';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { render } from '@/test/render';
import { messages } from '../messages';
import { fakeSession } from './fake-session';
import { createAppRoutes } from './routes';

/** Signed out by default; the protected home needs an authenticated session. */
function renderAt(
  path: string,
  options?: { showcase?: boolean; authenticated?: boolean },
) {
  const { service } = fakeSession(
    options?.authenticated
      ? { status: 'authenticated', user: profile }
      : { status: 'unauthenticated' },
  );
  const router = createMemoryRouter(createAppRoutes(options), {
    initialEntries: [path],
  });
  return {
    router,
    ...render(
      <SessionProvider service={service}>
        <RouterProvider router={router} />
      </SessionProvider>,
    ),
  };
}

const authPages = [
  ['/login', messages.pages.login.title],
  ['/register', messages.pages.register.title],
  ['/password-reset', messages.pages.passwordReset.title],
  ['/invitations/accept', messages.pages.invitationAccept.title],
] as const;

const pages = [...authPages, ['/', messages.pages.home.title]] as const;

const noShowcaseLink = () =>
  expect(
    screen.queryByRole('link', { name: messages.showcase.title }),
  ).not.toBeInTheDocument();

test.each(pages)(
  'renders %s lazily with one h1, one main and one toast host',
  async (path, title) => {
    const { container } = renderAt(path, { authenticated: path === '/' });

    expect(
      await screen.findByRole('heading', { level: 2, name: title }),
    ).toBeVisible();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: title })).toBeVisible();
    // The layout header owns the only h1; pages must not add another.
    expect(
      within(main).queryByRole('heading', { level: 1 }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).getByRole('heading', {
        level: 1,
        name: messages.title,
      }),
    ).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getAllByRole('region', { name: /Notificaciones/ }),
    ).toHaveLength(1);
    await expectAccessible(container);
  },
);

test.each(pages)(
  'never shows a sidebar or the showcase link on %s, even when the showcase is enabled',
  async (path, title) => {
    renderAt(path, { authenticated: path === '/', showcase: true });
    await screen.findByRole('heading', { level: 2, name: title });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    noShowcaseLink();
  },
);

test.each(authPages)(
  'the auth layout on %s puts the brand panel above the form column and reserves a form slot',
  async (path, title) => {
    renderAt(path);
    await screen.findByRole('heading', { level: 2, name: title });

    const banner = screen.getByRole('banner');
    const main = screen.getByRole('main');
    // DOM order is the mobile stacking order: the panel comes first.
    expect(
      banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(banner).toHaveTextContent(messages.auth.tagline);
    // The scene is decorative.
    expect(banner.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // Future forms drop into this slot.
    expect(main.querySelector('[data-auth-slot]')).toContainElement(
      within(main).getByRole('heading', { name: title }),
    );
  },
);

test.each(pages)(
  'the skip link on %s reaches the focusable main landmark',
  async (path, title) => {
    renderAt(path, { authenticated: path === '/' });
    await screen.findByRole('heading', { level: 2, name: title });

    const skipLink = screen.getByRole('link', { name: /Saltar al contenido/ });
    const main = screen.getByRole('main');
    expect(skipLink).toHaveAttribute('href', `#${main.id}`);
    expect(main).toHaveAttribute('tabindex', '-1');

    fireEvent.click(skipLink);
    expect(main).toHaveFocus();
  },
);

test.each(pages)('sets the document title on %s', async (path, title) => {
  renderAt(path, { authenticated: path === '/' });
  await screen.findByRole('heading', { level: 2, name: title });

  // The title is written in an effect, which can land just after the heading.
  await waitFor(() =>
    expect(document.title).toBe(`${title} · ${messages.title}`),
  );
});

test('renders the not found page for an unknown path', async () => {
  const { container } = renderAt('/no-such-page');

  expect(
    await screen.findByRole('heading', {
      level: 2,
      name: messages.pages.notFound.title,
    }),
  ).toBeVisible();
  expect(screen.getByRole('banner')).toBeVisible();
  expect(document.title).toBe(
    `${messages.pages.notFound.title} · ${messages.title}`,
  );
  await expectAccessible(container);
});

test('the catch-all 404 for a signed-out visitor shows no app-only chrome', async () => {
  renderAt('/no-such-page', { showcase: true });

  await screen.findByRole('heading', {
    level: 2,
    name: messages.pages.notFound.title,
  });
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  noShowcaseLink();
  expect(
    screen.getByRole('link', { name: messages.errors.goHome }),
  ).toHaveAttribute('href', '/');
  expect(
    screen.getByRole('main').querySelector('svg[aria-hidden="true"]'),
  ).not.toBeNull();
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
  expect(document.title).toBe(`${messages.showcase.title} · ${messages.title}`);
  // Reachable by URL only: no page links to it.
  noShowcaseLink();
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
