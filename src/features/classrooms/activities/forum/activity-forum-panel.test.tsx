import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  createActivityForumStore,
  createClassroomActivitiesStore,
  createClassroomDetailHandler,
  TEST_API_BASE_URL,
  type ActivityStoreItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ActivityDetailPage } from '../activity-detail-page';
import { ActivityForumPanel } from './activity-forum-panel';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000052';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000005101';
const STUDENT_ID = '00000000-0000-4000-8000-000000007001';
const TEACHER_ID = '00000000-0000-4000-8000-000000000001';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

function makeActivity(
  overrides: Partial<ActivityStoreItem> = {},
): ActivityStoreItem {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Funciones cuadráticas',
    description: 'Consigna del trabajo práctico.',
    opensAt: null,
    dueAt: '2026-11-25T02:30:00.000Z',
    allowLate: true,
    maxScore: 100,
    weightMultiplier: 1.5,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function renderForumRoute(options: {
  readonly userId?: string;
  readonly role?: 'STUDENT' | 'TEACHER' | 'PARENT';
  readonly capabilities?: readonly Capability[];
}) {
  const role = options.role ?? 'STUDENT';
  const currentUserId =
    options.userId ?? (role === 'TEACHER' ? TEACHER_ID : STUDENT_ID);
  const capabilities: Capability[] =
    options.capabilities !== undefined
      ? [...options.capabilities]
      : role === 'TEACHER'
        ? ['publish_content', 'configure_classroom', 'list_directory']
        : role === 'STUDENT'
          ? ['participate_activities', 'list_directory']
          : ['message_teacher'];

  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      myRole: role,
      capabilities,
    }),
    http.get(
      `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/context-events`,
      () =>
        new HttpResponse(
          new ReadableStream<Uint8Array>({
            start() {},
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    ),
  );

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = fakeSession(
    {
      status: 'authenticated',
      user: { ...profile, id: currentUserId },
    },
    client,
  );

  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId/activities/:activityId',
        element: (
          <ActivityDetailPage
            renderForumTab={(activity) => (
              <ActivityForumPanel activity={activity} />
            )}
          />
        ),
      },
      {
        path: '/classrooms/:classroomId',
        element: <div>Classroom</div>,
      },
    ],
    {
      initialEntries: [`/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`],
    },
  );

  const rendered = render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider client={queryClient}>
        <RouterProvider router={router} />
      </ApiQueryProvider>
    </SessionProvider>,
  );

  return { ...rendered, queryClient };
}

async function openForumTab() {
  const forumTab = await screen.findByRole('tab', {
    name: 'Foro de consultas',
  });
  fireEvent.mouseDown(forumTab, { button: 0 });
  fireEvent.click(forumTab);
}

describe('ActivityForumPanel (#52)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('shows empty state, posts a student question, renders teacher reply with plain text safety, and navigates cleanly', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [makeActivity()],
    });
    const forumStore = createActivityForumStore({
      classroomId: CLASSROOM_ID,
      activityId: ACTIVITY_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: [
        {
          id: 'm-1',
          userId: STUDENT_ID,
          displayName: 'Sofía Martínez',
          role: 'STUDENT',
        },
        {
          id: 'm-2',
          userId: TEACHER_ID,
          displayName: 'Prof. Ana García',
          role: 'TEACHER',
        },
      ],
    });
    mswServer.use(...activitiesStore.handlers, ...forumStore.handlers);

    const view = renderForumRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await openForumTab();

    expect(
      await screen.findByText('Todavía no hay consultas en esta actividad'),
    ).toBeVisible();

    const textarea = screen.getByLabelText('Tu pregunta sobre esta actividad');
    const xssPayload = '¿Se entrega en PDF?\n<script>alert(1)</script>';
    fireEvent.change(textarea, { target: { value: xssPayload } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar consulta' }));

    expect(await screen.findByText('Hilo de consulta')).toBeVisible();
    expect(
      await screen.findByText(/<script>alert\(1\)<\/script>/),
    ).toBeVisible();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('Sofía Martínez (Vos)')).toBeVisible();

    // Teacher posts a reply from backend
    forumStore.setRole('TEACHER');
    forumStore.setCurrentUserId(TEACHER_ID);
    const createdThreadId = forumStore.getThreads()[0].id;
    await fetch(
      `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}/forum/threads/${createdThreadId}/posts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Sí, en PDF con el gráfico adjunto.' }),
      },
    );
    forumStore.setRole('STUDENT');
    forumStore.setCurrentUserId(STUDENT_ID);

    await act(async () => {
      await view.queryClient.invalidateQueries();
    });

    expect(
      await screen.findByText('Sí, en PDF con el gráfico adjunto.'),
    ).toBeVisible();
    expect(screen.getByText('Prof. Ana García')).toBeVisible();
    expect(screen.getByText('Docente')).toBeVisible();

    await expectAccessible(view.container);

    // Back to thread list shows reply count 1
    fireEvent.click(
      screen.getByRole('button', { name: 'Volver a todas las consultas' }),
    );
    expect(await screen.findByText('1 respuesta')).toBeVisible();
  });

  it('preserves draft and reconciles server state on uncertain write without showing phantom confirmed posts', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [makeActivity()],
    });
    const forumStore = createActivityForumStore({
      classroomId: CLASSROOM_ID,
      activityId: ACTIVITY_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
    });
    forumStore.failNext('createThread', 'network');
    mswServer.use(...activitiesStore.handlers, ...forumStore.handlers);

    renderForumRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await openForumTab();

    const textarea = await screen.findByLabelText(
      'Tu pregunta sobre esta actividad',
    );
    fireEvent.change(textarea, {
      target: { value: 'Mi borrador ante corte de red' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar consulta' }));

    expect(
      await screen.findByText(/No pudimos confirmar si tu mensaje se publicó/i),
    ).toBeVisible();
    expect(textarea).toHaveValue('Mi borrador ante corte de red');
    expect(forumStore.getThreads()).toHaveLength(0);
  });

  it('blocks parents from viewing or requesting the forum tab', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'PARENT',
      initialItems: [makeActivity()],
    });
    const forumStore = createActivityForumStore({
      classroomId: CLASSROOM_ID,
      activityId: ACTIVITY_ID,
      role: 'PARENT',
    });
    mswServer.use(...activitiesStore.handlers, ...forumStore.handlers);

    renderForumRoute({ role: 'PARENT' });
    await waitFor(() => {
      expect(
        screen.getByText('No tenés acceso a esta actividad'),
      ).toBeVisible();
    });
    expect(
      screen.queryByRole('tab', { name: 'Foro de consultas' }),
    ).not.toBeInTheDocument();
    expect(forumStore.getCounts().listThreads).toBe(0);
  });

  it('denies access cleanly when mounted directly for a parent without issuing forum requests', async () => {
    const forumStore = createActivityForumStore({
      classroomId: CLASSROOM_ID,
      activityId: ACTIVITY_ID,
      role: 'PARENT',
    });
    mswServer.use(
      createClassroomDetailHandler(CLASSROOM_ID, {
        myRole: 'PARENT',
        capabilities: ['message_teacher'],
      }),
      ...forumStore.handlers,
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const session = fakeSession(
      { status: 'authenticated', user: { ...profile, id: 'parent-1' } },
      client,
    );
    const router = createMemoryRouter(
      [
        {
          path: '/classrooms/:classroomId/activities/:activityId',
          element: (
            <ActivityForumPanel
              activity={{
                ...makeActivity(),
                description: 'Consigna',
                questions: [],
              }}
            />
          ),
        },
      ],
      {
        initialEntries: [
          `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
        ],
      },
    );

    render(
      <SessionProvider service={session.service}>
        <ApiQueryProvider client={queryClient}>
          <RouterProvider router={router} />
        </ApiQueryProvider>
      </SessionProvider>,
    );

    expect(
      await screen.findByText('Sin acceso al foro de consultas'),
    ).toBeVisible();
    expect(forumStore.getCounts().listThreads).toBe(0);
  });

  it('guards against rapid double submit and allows student reply inside an existing thread', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [makeActivity()],
    });
    const forumStore = createActivityForumStore({
      classroomId: CLASSROOM_ID,
      activityId: ACTIVITY_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      writeDelayMs: 50,
    });
    mswServer.use(...activitiesStore.handlers, ...forumStore.handlers);

    renderForumRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await openForumTab();

    const textarea = await screen.findByLabelText(
      'Tu pregunta sobre esta actividad',
    );
    fireEvent.change(textarea, { target: { value: 'Duda única' } });
    const submitBtn = screen.getByRole('button', {
      name: 'Publicar consulta',
    });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Hilo de consulta')).toBeVisible();
    expect(forumStore.getCounts().createThread).toBe(1);

    // Reply inside thread
    const replyInput = screen.getByLabelText('Tu respuesta');
    fireEvent.change(replyInput, {
      target: { value: 'Agrego captura luego.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));

    expect(await screen.findByText('Agrego captura luego.')).toBeVisible();
  });
});
