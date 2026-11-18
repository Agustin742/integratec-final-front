import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter, useOutletContext } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { expect, test, vi } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { classroomDetailQueryKey } from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import { messages } from '@/app/messages';
import { fakeSession } from '@/app/router/fake-session';
import { createAppRoutes } from '@/app/router/routes';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { ClassroomWorkspace } from './classroom-workspace';
import { classroomMessages } from './messages';
import { useClassroomCapabilities } from './use-classroom-capabilities';

type Detail = components['schemas']['ClassroomDetailResponseDto'];
const detail = (id: string): Detail => ({
  id,
  name: `Classroom ${id}`,
  subject: null,
  schoolId: null,
  independentTeacherId: null,
  adultMode: true,
  chatMuted: true,
  collaborationLocked: true,
  gamesDisabled: false,
  myRole: 'PARENT',
  capabilities: ['message_teacher'],
  deskCount: 0,
  pet: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
const response = (id: string) => Response.json(detail(id));

function ContextProbe() {
  const context = useOutletContext<Detail>();
  const capabilities = useClassroomCapabilities(context.id);
  return <output>{JSON.stringify({ context, capabilities })}</output>;
}

function setup(fetch: typeof globalThis.fetch, path = '/classrooms/a') {
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: (input, init) =>
        (input as Request).url.endsWith('/context-events')
          ? Promise.resolve(
              new Response(new ReadableStream(), {
                headers: { 'content-type': 'text/event-stream' },
              }),
            )
          : fetch(input, init),
    }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  const router = createMemoryRouter(
    createAppRoutes({
      protectedRoutes: [
        {
          path: 'context/:classroomId',
          Component: ClassroomWorkspace,
          children: [{ index: true, Component: ContextProbe }],
        },
      ],
    }),
    { initialEntries: [path] },
  );
  const view = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );
  return { ...view, session, queryClient, router };
}

function controlledFetch() {
  const pending: { request: Request; resolve: (value: Response) => void }[] =
    [];
  const fetch = vi.fn(
    (input: RequestInfo | URL) =>
      new Promise<Response>((resolve) => {
        pending.push({ request: input as Request, resolve });
      }),
  );
  return {
    pending: () => pending.filter(({ request }) => !request.signal.aborted),
    fetch,
  };
}

test('loads the public protected route with server name and neutral parent role only', async () => {
  const { fetch, pending } = controlledFetch();
  const { container } = setup(fetch);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      classroomMessages.loading,
    ),
  );
  expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
  pending()[0].resolve(response('a'));
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Classroom a' }),
  ).toBeVisible();
  expect(screen.getByText(/Tu rol en esta aula: Familiar/)).toBeVisible();
  expect(document.title).toContain('Classroom a');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('main')).queryByRole('button'),
  ).not.toBeInTheDocument();
  await expectAccessible(container);
});

test('exposes exact persisted context through Outlet and shares the capability cache', async () => {
  const fetch = vi.fn(() => Promise.resolve(response('a')));
  const { queryClient } = setup(fetch, '/context/a');
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('"adultMode":true'),
  );
  const output = screen.getByRole('status');
  expect(output).toHaveTextContent('"chatMuted":true');
  expect(output).toHaveTextContent('"collaborationLocked":true');
  expect(output).toHaveTextContent('"gamesDisabled":false');
  expect(output).toHaveTextContent('"capabilities":["message_teacher"]');
  expect(
    queryClient.getQueryData(classroomDetailQueryKey(profile.id, 'a')),
  ).toEqual(detail('a'));
  expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
});

test('switching A to B aborts A, never flashes its name, and ignores its late response', async () => {
  const { fetch, pending } = controlledFetch();
  const { router } = setup(fetch);
  await waitFor(() => expect(pending()).toHaveLength(1));
  const previous = pending()[0];
  await act(() => router.navigate('/classrooms/b'));
  await waitFor(() => expect(pending()).toHaveLength(1));
  expect(previous.request.signal.aborted).toBe(true);
  previous.resolve(response('a'));
  expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
  pending()[0].resolve(response('b'));
  expect(
    await screen.findByRole('heading', { name: 'Classroom b' }),
  ).toBeVisible();
  expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
  await act(() => router.navigate('/classrooms/c'));
  expect(screen.queryByText('Classroom b')).not.toBeInTheDocument();
});

test('account switch fences pending results and logout removes context', async () => {
  const { fetch, pending } = controlledFetch();
  const { session } = setup(fetch);
  await waitFor(() => expect(pending()).toHaveLength(1));
  const previous = pending()[0];
  session.set({
    status: 'authenticated',
    user: { ...profile, id: 'second-user' },
  });
  await waitFor(() => expect(pending()).toHaveLength(1));
  expect(previous.request.signal.aborted).toBe(true);
  previous.resolve(response('old-user'));
  expect(screen.queryByText('Classroom old-user')).not.toBeInTheDocument();
  pending()[0].resolve(response('a'));
  await screen.findByRole('heading', { name: 'Classroom a' });
  session.set({ status: 'unauthenticated' });
  expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
  await screen.findByRole('heading', { name: messages.pages.login.title });
});

test.each([403, 404])(
  'a %i response has the same non-disclosing not-found presentation',
  async (status) => {
    setup(() => Promise.resolve(new Response(null, { status })));
    expect(
      await screen.findByRole('heading', {
        name: messages.pages.notFound.title,
      }),
    ).toBeVisible();
    expect(document.title).toBe(
      `${messages.pages.notFound.title} · ${messages.title}`,
    );
    expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: messages.pages.forbidden.title }),
    ).not.toBeInTheDocument();
  },
);

test.each([403, 404, 500, 'network'] as const)(
  'failed refresh %s removes loaded context and supports recovery where appropriate',
  async (failure) => {
    let failed = false;
    const fetch = vi.fn(() => {
      if (!failed) return Promise.resolve(response('a'));
      if (failure === 'network')
        return Promise.reject(new TypeError('synthetic offline'));
      return Promise.resolve(new Response(null, { status: failure }));
    });
    const { queryClient } = setup(fetch);
    await screen.findByRole('heading', { name: 'Classroom a' });
    failed = true;
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(profile.id, 'a'),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Classroom a')).not.toBeInTheDocument(),
    );
    expect(document.title).not.toContain('Classroom a');
    if (failure === 403 || failure === 404) {
      await screen.findByRole('heading', {
        name: messages.pages.notFound.title,
      });
      expect(document.title).toBe(
        `${messages.pages.notFound.title} · ${messages.title}`,
      );
    } else {
      await screen.findByRole('heading', {
        name: classroomMessages.errorTitle,
      });
      failed = false;
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await screen.findByRole('heading', { name: 'Classroom a' });
    }
  },
);
