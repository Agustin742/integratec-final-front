import { act, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { render } from '@/test/render';
import { messages } from '../messages';
import { fakeSession } from './fake-session';
import { createAppRoutes } from './routes';

function renderAt(
  path: string,
  options: { signedIn?: boolean; protectedRoutes?: RouteObject[] } = {},
) {
  const { service } = fakeSession(
    options.signedIn === false
      ? { status: 'unauthenticated' }
      : { status: 'authenticated', user: profile },
  );
  const router = createMemoryRouter(
    createAppRoutes({ protectedRoutes: options.protectedRoutes }),
    { initialEntries: [path] },
  );
  render(
    <SessionProvider service={service}>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return router;
}

const heading = (name: string) =>
  screen.findByRole('heading', { level: 2, name });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  (document.activeElement as HTMLElement | null)?.blur();
});

test('does not steal focus on the first render', async () => {
  renderAt('/invitations/accept');
  await heading(messages.pages.invitationAccept.title);

  expect(document.body).toHaveFocus();
});

test('does not steal focus when the first load is redirected to login', async () => {
  const router = renderAt('/', { signedIn: false });
  await heading(messages.pages.login.title);

  expect(router.state.location.pathname).toBe('/login');
  expect(document.body).toHaveFocus();
});

test('moves focus to the page heading after a client-side navigation', async () => {
  const router = renderAt('/invitations/accept');
  await heading(messages.pages.invitationAccept.title);

  await act(() => router.navigate('/nowhere'));

  const notFound = await heading(messages.pages.notFound.title);
  await waitFor(() => expect(notFound).toHaveFocus());
});

test('focuses the main landmark when the new page has no heading', async () => {
  const router = renderAt('/invitations/accept', {
    protectedRoutes: [{ path: 'plain', Component: () => <p>Plain page</p> }],
  });
  await heading(messages.pages.invitationAccept.title);

  await act(() => router.navigate('/plain'));

  await screen.findByText('Plain page');
  await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
});

test('keeps focus where it is when only the search or hash changes', async () => {
  const router = renderAt('/invitations/accept');
  await heading(messages.pages.invitationAccept.title);
  const skipLink = screen.getByRole('link', { name: /Saltar al contenido/ });
  skipLink.focus();

  await act(() => router.navigate('/invitations/accept?token=abc#top'));

  expect(skipLink).toHaveFocus();
});
