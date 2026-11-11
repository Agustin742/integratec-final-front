import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, Outlet } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import type { SessionSnapshot } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomDetailHandler,
  createErrorEnvelopeResponse,
  type ClassroomDetailPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { messages } from '../messages';
import { fakeSession } from './fake-session';
import { RequireCapability } from './require-capability';
import { createAppRoutes } from './routes';

const CLASSROOM_A = '11111111-1111-4111-8111-111111111111';
const CLASSROOM_B = '22222222-2222-4222-8222-222222222222';

const authenticated: SessionSnapshot = {
  status: 'authenticated',
  user: profile,
};

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  // React logs every caught render error; the assertions are on the UI.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

// Test-only routes: real classroom pages arrive with later stories.
const gatedRoutes = [
  {
    path: 'classrooms/:classroomId',
    Component: () => (
      <RequireCapability capability="moderate_chat">
        <h2>Moderation tools</h2>
      </RequireCapability>
    ),
  },
  {
    // Route-level wrapper: the gate renders the nested route through <Outlet />.
    path: 'wrapped/:classroomId',
    Component: () => (
      <RequireCapability capability="view_metrics">
        <Outlet />
      </RequireCapability>
    ),
    children: [{ index: true, Component: () => <h2>Metrics page</h2> }],
  },
];

function renderAt(path: string) {
  const session = fakeSession(
    authenticated,
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const router = createMemoryRouter(
    createAppRoutes({ protectedRoutes: gatedRoutes }),
    { initialEntries: [path] },
  );
  const view = render(
    <SessionProvider service={session.service}>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return { router, session, view };
}

const detailPath = `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_A}`;

const teacherPayload: ClassroomDetailPayload = {
  id: CLASSROOM_A,
  name: 'Synthetic classroom',
  subject: null,
  schoolId: null,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'TEACHER',
  capabilities: ['moderate_chat'],
  deskCount: 0,
  pet: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('renders the content when the server grants the capability', async () => {
  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_A, {
      myRole: 'TEACHER',
      capabilities: ['moderate_chat'],
    }),
  );
  renderAt(`/classrooms/${CLASSROOM_A}`);

  expect(
    await screen.findByRole('heading', { name: 'Moderation tools' }),
  ).toBeVisible();
});

test('shows loading while pending and never flashes the protected content', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  mswServer.use(
    http.get(detailPath, async () => {
      await gate;
      return HttpResponse.json(teacherPayload);
    }),
  );
  renderAt(`/classrooms/${CLASSROOM_A}`);

  expect(await screen.findByText(messages.access.checking)).toBeInTheDocument();
  expect(screen.queryByText('Moderation tools')).not.toBeInTheDocument();

  release();
  expect(await screen.findByText('Moderation tools')).toBeVisible();
  expect(screen.queryByText(messages.access.checking)).not.toBeInTheDocument();
});

test('shows forbidden, without leaving the URL, when the capability is missing', async () => {
  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_A, {
      myRole: 'STUDENT',
      capabilities: ['chat_classmates'],
    }),
  );
  const { router, view } = renderAt(`/classrooms/${CLASSROOM_A}`);

  expect(
    await screen.findByRole('heading', {
      name: messages.pages.forbidden.title,
    }),
  ).toBeVisible();
  expect(screen.queryByText('Moderation tools')).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe(`/classrooms/${CLASSROOM_A}`);
  await expectAccessible(view.container);
});

test('shows not found for a 404 and does not reveal that the classroom exists', async () => {
  mswServer.use(
    http.get(detailPath, () =>
      createErrorEnvelopeResponse(404, {
        code: 'NOT_FOUND',
        message: 'Classroom exists but belongs to another school',
        correlationId: 'corr-404',
      }),
    ),
  );
  const { router } = renderAt(`/classrooms/${CLASSROOM_A}`);

  expect(
    await screen.findByRole('heading', {
      name: messages.pages.notFound.title,
    }),
  ).toBeVisible();
  expect(document.body).not.toHaveTextContent('belongs to another school');
  expect(
    screen.queryByRole('heading', { name: messages.pages.forbidden.title }),
  ).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe(`/classrooms/${CLASSROOM_A}`);
});

test('shows forbidden for a 403 on a reachable classroom', async () => {
  mswServer.use(
    http.get(detailPath, () =>
      createErrorEnvelopeResponse(403, {
        code: 'FORBIDDEN',
        message: 'synthetic',
        correlationId: 'corr-403',
      }),
    ),
  );
  const { router } = renderAt(`/classrooms/${CLASSROOM_A}`);

  expect(
    await screen.findByRole('heading', {
      name: messages.pages.forbidden.title,
    }),
  ).toBeVisible();
  expect(router.state.location.pathname).toBe(`/classrooms/${CLASSROOM_A}`);
});

test('the same user is allowed in one classroom and forbidden in another', async () => {
  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_A, {
      myRole: 'TEACHER',
      capabilities: ['moderate_chat'],
    }),
    createClassroomDetailHandler(CLASSROOM_B, {
      myRole: 'STUDENT',
      capabilities: [],
    }),
  );
  const { router } = renderAt(`/classrooms/${CLASSROOM_A}`);
  expect(await screen.findByText('Moderation tools')).toBeVisible();

  await router.navigate(`/classrooms/${CLASSROOM_B}`);

  expect(
    await screen.findByRole('heading', {
      name: messages.pages.forbidden.title,
    }),
  ).toBeVisible();
  expect(screen.queryByText('Moderation tools')).not.toBeInTheDocument();
});

test('works as a route-level wrapper around nested routes', async () => {
  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_A, {
      myRole: 'TEACHER',
      capabilities: ['view_metrics'],
    }),
  );
  renderAt(`/wrapped/${CLASSROOM_A}`);

  expect(
    await screen.findByRole('heading', { name: 'Metrics page' }),
  ).toBeVisible();
});

test('an unexpected failure shows the generic error, never login', async () => {
  mswServer.use(
    http.get(detailPath, () =>
      createErrorEnvelopeResponse(500, {
        code: 'INTERNAL_ERROR',
        message: 'synthetic',
        correlationId: 'corr-500',
      }),
    ),
  );
  const { router } = renderAt(`/classrooms/${CLASSROOM_A}`);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    messages.errors.unexpected.title,
  );
  expect(router.state.location.pathname).toBe(`/classrooms/${CLASSROOM_A}`);
});
