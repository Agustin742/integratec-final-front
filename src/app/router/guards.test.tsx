import { fireEvent, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { expect, test } from 'vitest';
import type { SessionSnapshot } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { render } from '@/test/render';
import { messages } from '../messages';
import { fakeSession } from './fake-session';
import { createAppRoutes } from './routes';

const authenticated: SessionSnapshot = {
  status: 'authenticated',
  user: profile,
};

function renderAt(path: string, initial: SessionSnapshot) {
  const session = fakeSession(initial);
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  const view = render(
    <SessionProvider service={session.service}>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return { router, session, view };
}

const home = () =>
  screen.findByRole('heading', { level: 2, name: messages.pages.home.title });
const login = () =>
  screen.findByRole('heading', { level: 2, name: messages.pages.login.title });

test('redirects an unauthenticated visitor to login and keeps the return target', async () => {
  const { router } = renderAt('/', { status: 'unauthenticated' });

  await login();
  expect(router.state.location.pathname).toBe('/login');
  expect(router.state.location.search).toBe('?next=%2F');
  expect(screen.queryByText(messages.pages.home.title)).not.toBeInTheDocument();
});

test('shows loading and no protected content while the session is unresolved', async () => {
  const { router } = renderAt('/', { status: 'initializing' });

  expect(await screen.findByText(messages.session.verifying)).toBeVisible();
  expect(screen.queryByText(messages.pages.home.title)).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/');
});

test('renders the protected content once the session resolves', async () => {
  const { session } = renderAt('/', { status: 'initializing' });
  await screen.findByText(messages.session.verifying);

  session.set(authenticated);

  expect(await home()).toBeVisible();
  expect(
    screen.queryByText(messages.session.verifying),
  ).not.toBeInTheDocument();
});

test('offers a retry that re-verifies the session when it cannot be verified', async () => {
  const { router, session } = renderAt('/', { status: 'unable-to-verify' });

  expect(await screen.findByRole('alert')).toHaveTextContent(
    messages.session.unableTitle,
  );
  expect(screen.queryByText(messages.pages.home.title)).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/');
  const before = session.initialize.mock.calls.length;

  fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));

  expect(session.initialize.mock.calls.length).toBe(before + 1);
});

test('redirects an authenticated user away from login to the safe target', async () => {
  const { router } = renderAt('/login?next=%2F', authenticated);

  await home();
  expect(router.state.location.pathname).toBe('/');
});

test('falls back to the root when the return target is hostile', async () => {
  const { router } = renderAt('/login?next=//evil.example', authenticated);

  await home();
  expect(router.state.location.pathname).toBe('/');
  expect(router.state.location.search).toBe('');
});

test.each(['/login', '/register', '/password-reset'])(
  'redirects an authenticated user away from %s',
  async (path) => {
    const { router } = renderAt(path, authenticated);

    await home();
    expect(router.state.location.pathname).toBe('/');
  },
);

test('keeps public pages out of the way while the session first initializes', async () => {
  renderAt('/login', { status: 'initializing' });

  expect(await screen.findByText(messages.session.verifying)).toBeVisible();
  expect(
    screen.queryByText(messages.pages.login.title),
  ).not.toBeInTheDocument();
});

test('does not unmount the public page when a login attempt re-enters initializing', async () => {
  const { session } = renderAt('/login', { status: 'unauthenticated' });
  await login();

  session.set({ status: 'initializing' });

  expect(
    screen.getByRole('heading', { name: messages.pages.login.title }),
  ).toBeVisible();
});

test.each([
  ['signed out', { status: 'unauthenticated' }],
  ['signed in', authenticated],
] as const)(
  'keeps invitation acceptance reachable when %s',
  async (_label, initial) => {
    const { router } = renderAt('/invitations/accept', initial);

    expect(
      await screen.findByRole('heading', {
        name: messages.pages.invitationAccept.title,
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/invitations/accept');
  },
);

test('does not redirect unknown paths to login', async () => {
  const { router } = renderAt('/no-such-page', { status: 'unauthenticated' });

  expect(
    await screen.findByRole('heading', {
      name: messages.pages.notFound.title,
    }),
  ).toBeVisible();
  expect(router.state.location.pathname).toBe('/no-such-page');
});
