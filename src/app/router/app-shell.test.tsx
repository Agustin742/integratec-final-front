import { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { createSession, type SessionSnapshot } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { profile, storageKey, tokens } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createChatInboxStore,
  createLogoutHandler,
  createOwnProfileHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ClaimedNotificationCenter } from '@/features/notifications/notification-host';
import { toast } from '@/components/ui/toast';
import { messages } from '../messages';
import { fakeSession } from './fake-session';
import { createAppRoutes } from './routes';
import { waitForRoute } from './wait-for-route.test-helper';

function renderAt(
  path: string,
  options: {
    signedIn?: boolean;
    protectedRoutes?: RouteObject[];
    session?: ReturnType<typeof fakeSession>;
  } = {},
) {
  const { service } =
    options.session ??
    fakeSession(
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

test('mounts the floating chat dock for signed-in users with chats only', async () => {
  mswServer.listen();
  const classroomId = '00000000-0000-4000-8000-000000000051';
  mswServer.use(
    ...createChatInboxStore({
      currentUserId: profile.id,
      classrooms: [
        {
          classroomId,
          classroomName: 'Matemática',
          messages: [
            {
              id: '00000000-0000-4000-8000-600000000001',
              authorId: '00000000-0000-4000-8000-000000007002',
              authorDisplayName: 'Sofía Martínez',
              body: 'Hola',
              createdAt: '2026-11-19T03:00:00.000Z',
            },
          ],
        },
      ],
    }).handlers,
  );
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  renderAt('/', { session });
  try {
    expect(
      await screen.findByRole('button', {
        name: 'Mensajes, 1 mensaje sin leer',
      }),
    ).toBeVisible();
  } finally {
    mswServer.resetHandlers();
    mswServer.close();
  }
});

test('shows no chat dock to signed-out visitors', async () => {
  renderAt('/login', { signedIn: false });
  await heading(messages.pages.login.title);
  expect(screen.queryByRole('button', { name: /^Mensajes/ })).toBeNull();
});

test('does not steal focus when the first load is redirected to login', async () => {
  const router = renderAt('/', { signedIn: false });
  // Flush the initial lazy route first so its guard can start the redirect.
  await act(async () => {
    if (!router.state.initialized) {
      await new Promise<void>((resolve) => {
        const unsubscribe = router.subscribe((state) => {
          if (state.initialized) {
            unsubscribe();
            resolve();
          }
        });
      });
    }
  });
  await act(() => waitForRoute(router, '/login'));
  await heading(messages.pages.login.title);

  expect(router.state.location.pathname).toBe('/login');
  expect(document.body).toHaveFocus();
});

test('focuses home after signing in from the initial login page', async () => {
  const session = fakeSession({ status: 'initializing' });
  renderAt('/login', { session });
  session.set({ status: 'unauthenticated' });
  await heading(messages.pages.login.title);
  expect(document.body).toHaveFocus();

  session.set({ status: 'authenticated', user: profile });

  const home = await heading(messages.pages.home.title);
  await waitFor(() => expect(home).toHaveFocus());
});

test('focuses the destination after an explicit replace navigation', async () => {
  const router = renderAt('/invitations/accept');
  await heading(messages.pages.invitationAccept.title);

  await act(() => router.navigate('/nowhere', { replace: true }));

  const notFound = await heading(messages.pages.notFound.title);
  await waitFor(() => expect(notFound).toHaveFocus());
});

for (const initialPath of ['/', '/login']) {
  test(`does not steal focus during delayed initial session resolution at ${initialPath}`, async () => {
    const session = fakeSession({ status: 'initializing' });
    renderAt(initialPath, { session });
    await screen.findByText(messages.session.verifying);
    const resolved: SessionSnapshot =
      initialPath === '/'
        ? { status: 'unauthenticated' }
        : { status: 'authenticated', user: profile };

    session.set(resolved);

    await heading(
      initialPath === '/'
        ? messages.pages.login.title
        : messages.pages.home.title,
    );
    expect(document.body).toHaveFocus();
  });
}

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

function seedTabOwnedSession(tabId: string) {
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      ...tokens,
      expiresAt: Date.now() + 900_000,
      tabOwner: tabId,
    }),
  );
  return createSession({
    baseUrl: TEST_API_BASE_URL,
    tabOwner: () => tabId,
  });
}

describe('AppShell logout control (#28)', () => {
  beforeAll(() => {
    mswServer.listen({ onUnhandledFrame: 'error' });
  });

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubEnv('VITE_APP_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
    vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
  });

  afterEach(() => {
    toast.dismiss();
    mswServer.resetHandlers();
    window.sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    mswServer.close();
  });

  test('S4: confirmed logout sends Bearer token, clears protected view, storage and private query cache, and redirects to /login', async () => {
    let observedLogoutAuth: string | null = null;
    let laterMeAuth: string | null = 'not-captured';

    mswServer.use(
      createOwnProfileHandler({
        onRequest: (request) => {
          laterMeAuth = request.headers.get('Authorization');
        },
        response: {
          displayName: 'Ana López',
        },
      }),
      createLogoutHandler({
        onRequest: (request) => {
          observedLogoutAuth = request.headers.get('Authorization');
        },
      }),
    );

    const session = seedTabOwnedSession('tab-logout-confirmed');
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(['user', 'u1', 'classrooms'], ['Aula 4A']);

    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: ['/'],
    });
    const { container } = render(
      <SessionProvider service={session}>
        <RouterProvider router={router} />
      </SessionProvider>,
      { queryClient },
    );

    expect(await heading(messages.pages.home.title)).toBeVisible();

    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Ana López')).toBeVisible();
    const logoutButton = within(banner).getByRole('button', {
      name: messages.shell.logoutAction,
    });
    await expectAccessible(container);

    fireEvent.click(logoutButton);

    await heading(messages.pages.login.title);
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2F');
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: messages.pages.home.title,
      }),
    ).not.toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();

    await waitFor(() =>
      expect(observedLogoutAuth).toBe(`Bearer ${tokens.accessToken}`),
    );
    expect(
      await screen.findByText(messages.shell.logoutConfirmedTitle),
    ).toBeVisible();

    // Subsequent API calls via the session client carry no Bearer token.
    await expect(session.client.GET('/users/me')).resolves.toBeDefined();
    expect(laterMeAuth).toBeNull();
  });

  test('rapid double click on logout sends one non-aborted request and confirms once', async () => {
    const success = vi.spyOn(toast, 'success');
    let logoutCalls = 0;
    let aborted = false;
    let releaseLogout: (() => void) | undefined;

    mswServer.use(
      createOwnProfileHandler({ response: { displayName: 'Ana López' } }),
      http.post(`${TEST_API_BASE_URL}/auth/logout`, ({ request }) => {
        logoutCalls += 1;
        request.signal.addEventListener('abort', () => {
          aborted = true;
        });
        return new Promise<Response>((resolve) => {
          releaseLogout = () => resolve(new Response(null, { status: 204 }));
        });
      }),
    );

    const session = seedTabOwnedSession('tab-logout-double-click');
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: ['/'],
    });
    render(
      <SessionProvider service={session}>
        <RouterProvider router={router} />
      </SessionProvider>,
    );

    await heading(messages.pages.home.title);

    const logoutButton = within(screen.getByRole('banner')).getByRole(
      'button',
      {
        name: messages.shell.logoutAction,
      },
    );
    fireEvent.click(logoutButton);
    fireEvent.click(logoutButton);

    await waitFor(() => expect(logoutCalls).toBe(1));
    expect(aborted).toBe(false);

    releaseLogout?.();

    await heading(messages.pages.login.title);
    expect(
      await screen.findByText(messages.shell.logoutConfirmedTitle),
    ).toBeVisible();
    expect(
      screen.queryByText(messages.shell.logoutLocalOnlyTitle),
    ).not.toBeInTheDocument();
    expect(logoutCalls).toBe(1);
    expect(aborted).toBe(false);
    expect(success).toHaveBeenCalledTimes(1);
  });

  test.each(['service-unavailable', 'network'] as const)(
    'unconfirmed logout (%s) clears local session and cache while warning without claiming remote revocation',
    async (failureMode) => {
      mswServer.use(
        createOwnProfileHandler({
          response: { displayName: 'Ana López' },
        }),
        failureMode === 'service-unavailable'
          ? createLogoutHandler({
              error: {
                status: 503,
                body: {
                  code: 'SERVICE_UNAVAILABLE',
                  message: 'Backend unavailable',
                  correlationId: 'corr-logout-503',
                },
              },
            })
          : http.post(`${TEST_API_BASE_URL}/auth/logout`, () =>
              HttpResponse.error(),
            ),
      );

      const session = seedTabOwnedSession(`tab-logout-${failureMode}`);
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      queryClient.setQueryData(['user', 'u1', 'private'], { secret: true });

      const router = createMemoryRouter(createAppRoutes(), {
        initialEntries: ['/'],
      });
      render(
        <SessionProvider service={session}>
          <RouterProvider router={router} />
        </SessionProvider>,
        { queryClient },
      );

      await heading(messages.pages.home.title);

      fireEvent.click(
        within(screen.getByRole('banner')).getByRole('button', {
          name: messages.shell.logoutAction,
        }),
      );

      await heading(messages.pages.login.title);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      expect(window.sessionStorage.getItem(storageKey)).toBeNull();

      expect(
        await screen.findByText(messages.shell.logoutLocalOnlyTitle),
      ).toBeVisible();
      expect(
        screen.getByText(messages.shell.logoutLocalOnlyBody),
      ).toBeVisible();
      expect(
        screen.queryByText(messages.shell.logoutConfirmedTitle),
      ).not.toBeInTheDocument();
    },
  );

  test.each([true, false])(
    'warns honestly when local cleanup fails (serverConfirmed=%s)',
    async (serverConfirmed) => {
      const session = fakeSession({ status: 'authenticated', user: profile });
      vi.spyOn(session.service.controller, 'logout').mockResolvedValue({
        serverConfirmed,
        cleanupFailed: true,
      });
      const warning = vi.spyOn(toast, 'warning');
      const success = vi.spyOn(toast, 'success');
      renderAt('/', { session });
      await heading(messages.pages.home.title);

      fireEvent.click(
        screen.getByRole('button', { name: messages.shell.logoutAction }),
      );

      await waitFor(() =>
        expect(warning).toHaveBeenCalledWith(
          'No pudimos borrar todos los datos locales de sesión',
          {
            id: 'session-logout',
            description:
              'Cerrá el navegador o borrá los datos de este sitio antes de volver a usarlo en un equipo compartido.',
          },
        ),
      );
      expect(success).not.toHaveBeenCalled();
      expect(
        screen.queryByText(messages.shell.logoutLocalOnlyTitle),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(messages.shell.logoutConfirmedTitle),
      ).not.toBeInTheDocument();
    },
  );

  test('renders no logout chrome when signed out on catch-all 404', async () => {
    renderAt('/unknown-route', { signedIn: false });

    await heading(messages.pages.notFound.title);
    expect(
      within(screen.getByRole('banner')).queryByRole('button', {
        name: messages.shell.logoutAction,
      }),
    ).not.toBeInTheDocument();
  });
});

test('marks the shell header inert and aria-hidden while ClaimedNotificationCenter is mounted and restores it on unmount', async () => {
  function ClaimingPage() {
    const [covering, setCovering] = useState(false);
    return (
      <div>
        <h2>Covering route</h2>
        <button type="button" onClick={() => setCovering((v) => !v)}>
          toggle-cover
        </button>
        {covering && (
          <nav aria-label="Floating bar">
            <ClaimedNotificationCenter />
          </nav>
        )}
      </div>
    );
  }
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const url = (input as Request).url;
        if (url.includes('/notifications')) {
          return Response.json({ items: [], page: 1, pageSize: 20, total: 0 });
        }
        if (url.endsWith('/chats')) {
          return Response.json({ items: [] });
        }
        if (url.includes('/users/me/daily-review')) {
          return Response.json({ status: 'not_due' });
        }
        return Response.json({});
      },
    }),
  );
  renderAt('/claim-test', {
    session,
    protectedRoutes: [{ path: 'claim-test', Component: ClaimingPage }],
  });

  await heading('Covering route');
  const shellHeader = screen.getByRole('banner');
  expect(shellHeader).not.toHaveAttribute('inert');
  expect(shellHeader).not.toHaveAttribute('aria-hidden');

  fireEvent.click(screen.getByRole('button', { name: 'toggle-cover' }));
  await waitFor(() => {
    expect(shellHeader).toHaveAttribute('inert');
    expect(shellHeader).toHaveAttribute('aria-hidden', 'true');
  });

  fireEvent.click(screen.getByRole('button', { name: 'toggle-cover' }));
  await waitFor(() => {
    expect(shellHeader).not.toHaveAttribute('inert');
    expect(shellHeader).not.toHaveAttribute('aria-hidden');
  });
  expect(screen.getByRole('banner')).toBe(shellHeader);
});
