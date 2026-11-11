import { fireEvent, screen } from '@testing-library/react';
import { createMemoryRouter, data, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mapApiError } from '@/api/errors';
import type { SessionSnapshot } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { messages } from '../messages';
import { fakeSession } from './fake-session';
import { reloadPage } from './reload';
import { forbidden, notFound } from './route-errors';
import { createAppRoutes } from './routes';

vi.mock('./reload', () => ({ reloadPage: vi.fn() }));

const authenticated: SessionSnapshot = {
  status: 'authenticated',
  user: profile,
};

const SECRET = 'internal-detail-do-not-render';

const apiError = (status: number) =>
  mapApiError({}, { status, headers: new Headers() });

function renderAt(path: string, protectedRoutes: RouteObject[]) {
  const session = fakeSession(authenticated);
  const router = createMemoryRouter(createAppRoutes({ protectedRoutes }), {
    initialEntries: [path],
  });
  const view = render(
    <SessionProvider service={session.service}>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return { router, session, view };
}

const thrower = (error: unknown) => () => {
  throw error;
};

beforeEach(() => {
  // React logs every caught render error; the assertions are on the UI.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const expectShellIntact = () => {
  expect(screen.getByRole('banner')).toHaveTextContent(messages.title);
  expect(
    screen.getAllByRole('region', { name: /Notificaciones/ }),
  ).toHaveLength(1);
};

test('a page render error keeps the shell, hides internals and offers a retry', async () => {
  let fail = true;
  const { router } = renderAt('/boom', [
    {
      path: 'boom',
      Component: () => {
        if (fail) throw new Error(SECRET);
        return <h2>Recovered page</h2>;
      },
    },
  ]);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(messages.errors.unexpected.title);
  expect(document.body).not.toHaveTextContent(SECRET);
  expectShellIntact();

  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

  expect(
    await screen.findByRole('heading', { name: 'Recovered page' }),
  ).toBeVisible();
  expect(router.state.location.pathname).toBe('/boom');
});

test('a failed lazy chunk keeps the shell and offers a full reload', async () => {
  renderAt('/stale', [
    {
      path: 'stale',
      lazy: {
        Component: () =>
          Promise.reject(
            new TypeError(
              `Failed to fetch dynamically imported module: /${SECRET}.js`,
            ),
          ),
      },
    },
  ]);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    messages.errors.staleChunk.title,
  );
  expect(document.body).not.toHaveTextContent(SECRET);
  expectShellIntact();

  fireEvent.click(screen.getByRole('button', { name: messages.errors.reload }));
  expect(reloadPage).toHaveBeenCalledTimes(1);
});

test('a 404 route error response renders the not found view inside the shell', async () => {
  renderAt('/missing', [
    {
      path: 'missing',
      loader: thrower(data(null, { status: 404 })),
      Component: () => null,
    },
  ]);

  expect(
    await screen.findByRole('heading', {
      level: 2,
      name: messages.pages.notFound.title,
    }),
  ).toBeVisible();
  expectShellIntact();
});

test.each([
  ['an API 404', () => apiError(404)],
  ['the notFound helper', () => notFound()],
])('%s renders not found without revealing the resource', async (_, make) => {
  renderAt('/thing', [{ path: 'thing', Component: thrower(make()) }]);

  expect(
    await screen.findByRole('heading', { name: messages.pages.notFound.title }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: messages.pages.forbidden.title }),
  ).not.toBeInTheDocument();
});

test.each([
  ['an API 403', () => apiError(403)],
  ['the forbidden helper', () => forbidden()],
])('%s renders forbidden and never redirects to login', async (_, make) => {
  const { router } = renderAt('/secret', [
    { path: 'secret', Component: thrower(make()) },
  ]);

  expect(
    await screen.findByRole('heading', {
      level: 2,
      name: messages.pages.forbidden.title,
    }),
  ).toBeVisible();
  expect(router.state.location.pathname).toBe('/secret');
  expect(router.state.location.search).toBe('');
  expectShellIntact();
});

test('a 403 from a loader keeps the location and is accessible', async () => {
  const { router, view } = renderAt('/secret', [
    {
      path: 'secret',
      loader: thrower(data(null, { status: 403 })),
      Component: () => null,
    },
  ]);

  expect(
    await screen.findByRole('heading', {
      name: messages.pages.forbidden.title,
    }),
  ).toBeVisible();
  expect(router.state.location.pathname).toBe('/secret');
  await expectAccessible(view.container);
});

test('an API 401 inside a page shows a generic error and does not navigate', async () => {
  const { router } = renderAt('/auth', [
    { path: 'auth', Component: thrower(apiError(401)) },
  ]);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    messages.errors.unexpected.title,
  );
  expect(router.state.location.pathname).toBe('/auth');
});

test('the catch-all still renders the not found page with a way home', async () => {
  renderAt('/nowhere', []);

  expect(
    await screen.findByRole('heading', { name: messages.pages.notFound.title }),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: messages.errors.goHome }),
  ).toHaveAttribute('href', '/');
});

test('a loader error shows the generic error and Reintentar loads the page', async () => {
  let attempts = 0;
  const { router } = renderAt('/flaky', [
    {
      path: 'flaky',
      loader: () => {
        attempts += 1;
        if (attempts === 1) throw new Error(SECRET);
        return null;
      },
      Component: () => <h2>Loaded after retry</h2>,
    },
  ]);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(messages.errors.unexpected.title);
  expect(document.body).not.toHaveTextContent(SECRET);
  expect(document.title).toBe(
    `${messages.errors.unexpected.title} · ${messages.title}`,
  );
  expectShellIntact();

  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

  expect(
    await screen.findByRole('heading', { name: 'Loaded after retry' }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(router.state.location.pathname).toBe('/flaky');
});

test('the forbidden view sets its own document title', async () => {
  renderAt('/secret', [{ path: 'secret', Component: thrower(forbidden()) }]);

  await screen.findByRole('heading', { name: messages.pages.forbidden.title });
  expect(document.title).toBe(
    `${messages.pages.forbidden.title} · ${messages.title}`,
  );
});

const expectIllustrated = () => {
  const main = screen.getByRole('main');
  const scene = main.querySelector('svg');
  expect(scene).not.toBeNull();
  expect(scene).toHaveAttribute('aria-hidden', 'true');
  expect(
    screen.queryByRole('link', { name: messages.showcase.title }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
};

test('the unexpected error view is illustrated and offers retry and a way home', async () => {
  renderAt('/boom', [{ path: 'boom', Component: thrower(new Error(SECRET)) }]);

  await screen.findByRole('alert');
  expectIllustrated();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  expect(
    screen.getByRole('link', { name: messages.errors.goHome }),
  ).toHaveAttribute('href', '/');
});

test('the stale chunk view is illustrated and offers a reload and a way home', async () => {
  renderAt('/stale', [
    {
      path: 'stale',
      lazy: {
        Component: () =>
          Promise.reject(
            new TypeError('Failed to fetch dynamically imported module'),
          ),
      },
    },
  ]);

  await screen.findByRole('alert');
  expectIllustrated();
  expect(
    screen.getByRole('button', { name: messages.errors.reload }),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: messages.errors.goHome }),
  ).toHaveAttribute('href', '/');
});

test('the forbidden and not found views are illustrated with a way home', async () => {
  renderAt('/secret', [{ path: 'secret', Component: thrower(forbidden()) }]);
  await screen.findByRole('heading', { name: messages.pages.forbidden.title });
  expectIllustrated();
  expect(
    screen.getByRole('link', { name: messages.errors.goHome }),
  ).toHaveAttribute('href', '/');
});

test('the not found view is illustrated', async () => {
  renderAt('/nowhere', []);
  await screen.findByRole('heading', { name: messages.pages.notFound.title });
  expectIllustrated();
});
