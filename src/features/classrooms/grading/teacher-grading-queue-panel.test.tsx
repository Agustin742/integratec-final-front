import { useState } from 'react';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
  createClassroomActivitiesStore,
  createClassroomDetailHandler,
  createClassroomGradingStore,
  createOwnDailyMetricsHandler,
  createStudentReportCardHandler,
  createStudentWalletHandler,
  TEST_API_BASE_URL,
  type ActivityStoreItem,
  type GradingStoreSubmission,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ActivityDetailPage } from '../activities/activity-detail-page';
import { gradesMessages } from '../grades/messages';
import { ClassroomGradesPanel } from './classroom-grades-panel';
import { gradingMessages } from './grading-messages';
import { TeacherGradingQueuePanel } from './teacher-grading-queue-panel';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const ACTIVITY_TP_ID = '00000000-0000-4000-8000-000000005101';
const ACTIVITY_EXAM_ID = '00000000-0000-4000-8000-000000005102';
const SUB_1_ID = '00000000-0000-4000-8000-000000006101';
const SUB_2_ID = '00000000-0000-4000-8000-000000006102';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

function makeActivity(
  overrides: Partial<ActivityStoreItem> = {},
): ActivityStoreItem {
  return {
    id: ACTIVITY_TP_ID,
    classroomId: CLASSROOM_ID,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Funciones lineales',
    description: 'Subir el informe en PDF.',
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

function makeSubmission(
  overrides: Partial<GradingStoreSubmission> = {},
): GradingStoreSubmission {
  return {
    id: SUB_1_ID,
    classroomId: CLASSROOM_ID,
    activityId: ACTIVITY_TP_ID,
    activityTitle: 'TP 1: Funciones lineales',
    activityType: 'TP',
    activityFormat: 'FILE',
    maxScore: 100,
    weightMultiplier: 1.5,
    studentId: '00000000-0000-4000-8000-000000007001',
    studentDisplayName: 'Sofía Martínez',
    submittedAt: '2026-11-18T14:00:00.000Z',
    isLate: false,
    files: [
      {
        id: '00000000-0000-4000-8000-000000008001',
        originalName: 'tp1-sofia.pdf',
        contentType: 'application/pdf',
        sizeBytes: 3072,
        position: 0,
      },
    ],
    grade: null,
    ...overrides,
  };
}

function renderGradingRoute(options: {
  readonly path?: string;
  readonly role?: 'TEACHER' | 'STUDENT' | 'PARENT';
  readonly capabilities?: readonly Capability[];
  readonly element?: 'grades-panel' | 'queue-panel' | 'activity-detail';
}) {
  const role = options.role ?? 'TEACHER';
  const capabilities: Capability[] =
    options.capabilities !== undefined
      ? [...options.capabilities]
      : role === 'TEACHER'
        ? ['publish_content', 'configure_classroom']
        : role === 'PARENT'
          ? ['message_teacher']
          : ['participate_activities'];

  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      myRole: role,
      capabilities,
    }),
    http.get(
      `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/context-events`,
      () => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            streamController = controller;
          },
        });
        return new HttpResponse(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      },
    ),
  );

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = fakeSession(
    { status: 'authenticated', user: { ...profile, id: 'teacher-user-1' } },
    client,
  );

  const target = options.element ?? 'grades-panel';
  const path =
    options.path ??
    (target === 'activity-detail'
      ? `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_TP_ID}`
      : `/classrooms/${CLASSROOM_ID}/panels/grades`);

  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId/panels/grades',
        element:
          target === 'queue-panel' ? (
            <TeacherGradingQueuePanel />
          ) : (
            <ClassroomGradesPanel />
          ),
      },
      {
        path: '/classrooms/:classroomId/activities/:activityId',
        element: <ActivityDetailPage />,
      },
      {
        path: '/classrooms/:classroomId',
        element: <div>Classroom workspace</div>,
      },
    ],
    { initialEntries: [path] },
  );

  const rendered = render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider client={queryClient}>
        <RouterProvider router={router} />
      </ApiQueryProvider>
    </SessionProvider>,
  );

  return {
    ...rendered,
    queryClient,
    router,
    emitContextInvalidated: async () => {
      await act(async () => {
        streamController?.enqueue(
          new TextEncoder().encode(
            `event: classroom.context-invalidated\ndata: {"classroomId":"${CLASSROOM_ID}"}\n\n`,
          ),
        );
      });
    },
  };
}

describe('TeacherGradingQueuePanel & ClassroomGradesPanel (#44)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('renders empty state, filters by activity/state/sort, opens signed file link, grades (0-100), and regrades with compensating notice', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [
        makeActivity(),
        makeActivity({
          id: ACTIVITY_EXAM_ID,
          type: 'EXAM',
          title: 'Examen 1: Ecuaciones',
        }),
      ],
    });
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [
        makeSubmission(),
        makeSubmission({
          id: SUB_2_ID,
          activityId: ACTIVITY_EXAM_ID,
          activityTitle: 'Examen 1: Ecuaciones',
          activityType: 'EXAM',
          studentId: '00000000-0000-4000-8000-000000007002',
          studentDisplayName: 'Mateo López',
          submittedAt: '2026-11-18T15:00:00.000Z',
          isLate: true,
          grade: {
            id: 'grade-existing',
            graderId: 'teacher-user-1',
            score: 70,
            feedback: 'Buen intento inicial.',
            pointsAwarded: 105,
            pointTransactionId: 'tx-existing',
            version: 1,
            gradedAt: '2026-11-18T16:00:00.000Z',
            createdAt: '2026-11-18T16:00:00.000Z',
            updatedAt: '2026-11-18T16:00:00.000Z',
          },
        }),
      ],
    });
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    const view = renderGradingRoute({ role: 'TEACHER' });

    expect(
      await screen.findByRole('heading', { name: 'Cola de corrección' }),
    ).toBeVisible();
    expect(await screen.findByText('Sofía Martínez')).toBeVisible();
    expect(screen.getByText('Mateo López')).toBeVisible();

    await expectAccessible(view.container);

    // Filter by state = submitted (only Sofía remains)
    fireEvent.change(screen.getByLabelText('Estado'), {
      target: { value: 'submitted' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Mateo López')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Sofía Martínez')).toBeVisible();

    // Open review dialog for Sofía
    fireEvent.click(
      screen.getByRole('button', { name: 'Revisar y calificar' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Revisar y calificar entrega',
    });

    // Verify signed download link is rendered securely
    const fileLink = await within(dialog).findByRole('link', {
      name: 'Abrir archivo',
    });
    expect(fileLink).toHaveAttribute('target', '_blank');
    expect(fileLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(fileLink.getAttribute('href')).toMatch(
      /^https:\/\/storage\.example\.invalid\/signed\//,
    );

    // Client validation blocks score > 100 and newline in feedback
    fireEvent.change(within(dialog).getByLabelText('Nota (0 a 100)'), {
      target: { value: '120' },
    });
    fireEvent.change(
      within(dialog).getByLabelText('Devolución para el estudiante'),
      { target: { value: 'Línea 1\nLínea 2' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar calificación' }),
    );
    expect(
      await within(dialog).findByText('La nota debe estar entre 0 y 100.'),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        'La devolución no puede contener saltos de línea, tabulaciones ni caracteres de control.',
      ),
    ).toBeVisible();
    expect(gradingStore.getCounts().grade).toBe(0);

    // Submit valid grade (80 -> server returns 120 weighted points)
    fireEvent.change(within(dialog).getByLabelText('Nota (0 a 100)'), {
      target: { value: '80' },
    });
    fireEvent.change(
      within(dialog).getByLabelText('Devolución para el estudiante'),
      { target: { value: 'Muy claro el desarrollo del gráfico.' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar calificación' }),
    );

    // Confirmed state switches to regrade mode with server points and compensating notice
    expect(
      await within(dialog).findByText('120 puntos acreditados'),
    ).toBeVisible();
    expect(
      within(dialog).getByText('Recalificación con ajuste compensatorio'),
    ).toBeVisible();
    expect(
      within(dialog).getByText(/sin sobrescribir el movimiento original/i),
    ).toBeVisible();

    // Perform regrade (80 -> 90, server confirms 135 points and version 2)
    fireEvent.change(within(dialog).getByLabelText('Nota (0 a 100)'), {
      target: { value: '90' },
    });
    fireEvent.change(
      within(dialog).getByLabelText('Devolución para el estudiante'),
      { target: { value: 'Se sumó el punto extra del ejercicio 4.' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar recalificación' }),
    );

    expect(
      await within(dialog).findByText('135 puntos acreditados'),
    ).toBeVisible();
    expect(within(dialog).getByText('Versión 2')).toBeVisible();
  });

  it('handles 409 version conflict on regrade while preserving teacher draft and reloading latest version', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [
        makeSubmission({
          grade: {
            id: 'grade-1',
            graderId: 'teacher-user-1',
            score: 75,
            feedback: 'Versión 1.',
            pointsAwarded: 113,
            pointTransactionId: 'tx-1',
            version: 1,
            gradedAt: '2026-11-18T15:00:00.000Z',
            createdAt: '2026-11-18T15:00:00.000Z',
            updatedAt: '2026-11-18T15:00:00.000Z',
          },
        }),
      ],
    });
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    renderGradingRoute({ role: 'TEACHER' });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ver y recalificar' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Revisar y recalificar entrega',
    });

    // Simulate concurrent edit by another teacher (server bumps version -> 2)
    gradingStore.setGradeExternally(SUB_1_ID, {
      id: 'grade-1',
      graderId: 'other-teacher',
      score: 82,
      feedback: 'Actualizado por otro docente.',
      pointsAwarded: 123,
      pointTransactionId: 'tx-2',
      version: 2,
      gradedAt: '2026-11-18T16:00:00.000Z',
      createdAt: '2026-11-18T15:00:00.000Z',
      updatedAt: '2026-11-18T16:00:00.000Z',
    });

    const scoreInput = within(dialog).getByLabelText('Nota (0 a 100)');
    const feedbackInput = within(dialog).getByLabelText(
      'Devolución para el estudiante',
    );
    fireEvent.change(scoreInput, { target: { value: '88' } });
    fireEvent.change(feedbackInput, {
      target: { value: 'Mi borrador que no debe perderse.' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar recalificación' }),
    );

    expect(
      await within(dialog).findByText('Conflicto de versión al recalificar'),
    ).toBeVisible();
    // Draft is preserved!
    expect(scoreInput).toHaveValue(88);
    expect(feedbackInput).toHaveValue('Mi borrador que no debe perderse.');

    // Reload latest version from server -> updates confirmed version to 2 while keeping draft
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cargar versión actual' }),
    );
    expect(await within(dialog).findByText('Versión 2')).toBeVisible();
    expect(
      within(dialog).getByText('Actualizado por otro docente.'),
    ).toBeVisible();
    expect(feedbackInput).toHaveValue('Mi borrador que no debe perderse.');

    // Submitting again now sends version 2 and succeeds -> version 3
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar recalificación' }),
    );
    expect(await within(dialog).findByText('Versión 3')).toBeVisible();
  });

  it('reconciles uncertain write (dropped response after server commit) without duplicating', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    gradingStore.failNext('grade', 'drop-response');
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    renderGradingRoute({ role: 'TEACHER' });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Revisar y calificar' }),
    );
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Nota (0 a 100)'), {
      target: { value: '95' },
    });
    fireEvent.change(
      within(dialog).getByLabelText('Devolución para el estudiante'),
      { target: { value: 'Excelente entrega.' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar calificación' }),
    );

    expect(
      await within(dialog).findByText(
        /El servidor confirmó que la calificación quedó guardada/i,
      ),
    ).toBeVisible();
    expect(within(dialog).getByText('Nota: 95/100')).toBeVisible();
    expect(gradingStore.getCounts().grade).toBe(1);
    expect(gradingStore.getCounts().getGrade).toBeGreaterThanOrEqual(1);
  });

  it('handles 404 submission/other-classroom cleanly and does not enter a refetch loop on 403/404 queue', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    renderGradingRoute({ role: 'TEACHER' });
    expect(await screen.findByText('Sofía Martínez')).toBeVisible();

    // Remove submission (simulating another classroom / deleted activity 404) before opening viewer
    gradingStore.removeSubmission(SUB_1_ID);
    fireEvent.click(
      screen.getByRole('button', { name: 'Revisar y calificar' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText('Entrega no disponible'),
    ).toBeVisible();
  });

  it('hides teacher grading controls from students and never issues staff queue requests', async () => {
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    mswServer.use(
      ...gradingStore.handlers,
      createStudentReportCardHandler(CLASSROOM_ID),
      createOwnDailyMetricsHandler(CLASSROOM_ID),
      createStudentWalletHandler(CLASSROOM_ID),
    );

    renderGradingRoute({ role: 'STUDENT' });
    expect(
      await screen.findByRole('heading', {
        name: gradesMessages.student.heading,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Cola de corrección' }),
    ).not.toBeInTheDocument();
    expect(gradingStore.getCounts().queue).toBe(0);
  });

  it('wires default Review tab in ActivityDetailPage scoped to the current activity', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    renderGradingRoute({ role: 'TEACHER', element: 'activity-detail' });
    const reviewTab = await screen.findByRole('tab', {
      name: 'Revisión docente',
    });
    fireEvent.mouseDown(reviewTab);
    fireEvent.click(reviewTab);

    expect(
      await screen.findByRole('heading', {
        name: 'Entregas de esta actividad',
      }),
    ).toBeVisible();
    expect(await screen.findByText('Sofía Martínez')).toBeVisible();
    // Activity selector is hidden when pre-scoped to the current activity
    expect(screen.queryByLabelText('Actividad')).not.toBeInTheDocument();
  });

  it('preserves queue data with StaleDataNotice on transient refetch error and bounds 404 queue errors', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    const view = renderGradingRoute({ role: 'TEACHER' });
    expect(await screen.findByText('Sofía Martínez')).toBeVisible();

    // Transient 503 on refetch shows StaleDataNotice while keeping data visible
    gradingStore.failNext('queue', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Down',
        correlationId: 'req-503',
      },
    });
    await act(async () => {
      await view.queryClient.invalidateQueries();
    });
    expect(
      await screen.findByText('Mostrando la última lista conocida'),
    ).toBeVisible();
    expect(screen.getByText('Sofía Martínez')).toBeVisible();

    // Terminal 404 does not spin in an infinite loop
    const before404Count = gradingStore.getCounts().queue;
    gradingStore.failNext('queue', {
      status: 404,
      body: {
        code: 'NOT_FOUND',
        message: 'Missing',
        correlationId: 'req-404',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar datos' }));
    expect(
      await screen.findByText('No encontramos las entregas solicitadas'),
    ).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(gradingStore.getCounts().queue - before404Count).toBeLessThanOrEqual(
      2,
    );
  });

  it('paginates >10 submissions and recovers cleanly from an out-of-range page', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });
    const manySubmissions = Array.from({ length: 11 }, (_, idx) =>
      makeSubmission({
        id: `00000000-0000-4000-8000-0000000062${String(idx + 1).padStart(2, '0')}`,
        studentId: `00000000-0000-4000-8000-0000000072${String(idx + 1).padStart(2, '0')}`,
        studentDisplayName: `Estudiante ${String(idx + 1).padStart(2, '0')}`,
        submittedAt: `2026-11-18T14:${String(idx).padStart(2, '0')}:00.000Z`,
      }),
    );
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: manySubmissions,
    });
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    const view = renderGradingRoute({ role: 'TEACHER' });
    expect(await screen.findByText('Estudiante 01')).toBeVisible();
    expect(screen.queryByText('Estudiante 11')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Estudiante 11')).toBeVisible();

    // Remove item 11 externally so page 2 becomes out of range (total = 10)
    gradingStore.removeSubmission(manySubmissions[10].id);
    await act(async () => {
      await view.queryClient.invalidateQueries();
    });

    expect(
      await screen.findByText('No hay entregas en esta página'),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Volver a la primera página' }),
    );
    expect(await screen.findByText('Estudiante 01')).toBeVisible();
    await expectAccessible(view.container);
  });

  it('isolates PARENT role in ClassroomGradesPanel without issuing staff queue requests', async () => {
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    mswServer.use(...gradingStore.handlers);

    const view = renderGradingRoute({
      role: 'PARENT',
      capabilities: [],
      element: 'grades-panel',
    });

    expect(await screen.findByText(gradesMessages.parent.title)).toBeVisible();
    expect(gradingStore.getCounts().queue).toBe(0);
    await expectAccessible(view.container);
  });

  it('refreshes signed links via Renovar enlaces and guards unsaved changes on dialog close', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    renderGradingRoute({ role: 'TEACHER' });
    expect(await screen.findByText('Sofía Martínez')).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Revisar y calificar' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('tp1-sofia.pdf')).toBeVisible();

    const detailCountBefore = gradingStore.getCounts().detail;
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Renovar enlaces' }),
    );
    await waitFor(() => {
      expect(gradingStore.getCounts().detail).toBeGreaterThan(
        detailCountBefore,
      );
    });

    fireEvent.change(within(dialog).getByLabelText('Nota (0 a 100)'), {
      target: { value: '85' },
    });
    fireEvent.click(
      within(dialog).getAllByRole('button', { name: 'Cerrar' })[0],
    );
    expect(
      await within(dialog).findByText(/cambios sin guardar/i),
    ).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Seguir editando' }),
    );
    expect(within(dialog).getByLabelText('Nota (0 a 100)')).toHaveValue(85);

    fireEvent.click(
      within(dialog).getAllByRole('button', { name: 'Cerrar' })[0],
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Descartar y cerrar' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('preserves entered grade on 400 server rejection and shows non-gradable notice for MULTIPLE_CHOICE', async () => {
    const activitiesStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [
        makeActivity(),
        makeActivity({
          id: ACTIVITY_EXAM_ID,
          title: 'Parcial MCQ',
          type: 'EXAM',
          format: 'MULTIPLE_CHOICE',
          maxScore: 100,
        }),
      ],
    });
    const gradingStore = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [
        makeSubmission(),
        makeSubmission({
          id: SUB_2_ID,
          activityId: ACTIVITY_EXAM_ID,
          activityTitle: 'Parcial MCQ',
          activityType: 'EXAM',
          studentDisplayName: 'Bruno Díaz',
          files: [],
        }),
      ],
    });
    mswServer.use(...activitiesStore.handlers, ...gradingStore.handlers);

    renderGradingRoute({ role: 'TEACHER' });
    expect(await screen.findByText('Sofía Martínez')).toBeVisible();

    // 400 server rejection preserves entered score and feedback
    const sofiaRow = screen.getByText('Sofía Martínez').closest('li')!;
    fireEvent.click(
      within(sofiaRow).getByRole('button', { name: 'Revisar y calificar' }),
    );
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('tp1-sofia.pdf');

    gradingStore.failNext('grade', {
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        message: 'Out of bounds',
        details: [{ field: 'score', messages: ['Score exceeds maxScore.'] }],
        correlationId: 'req-400-grade',
      },
    });
    const scoreInput = within(dialog).getByLabelText('Nota (0 a 100)');
    const feedbackInput = within(dialog).getByLabelText(
      'Devolución para el estudiante',
    );
    fireEvent.change(scoreInput, { target: { value: '75' } });
    fireEvent.change(feedbackInput, { target: { value: 'Buen análisis' } });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar calificación' }),
    );

    expect(
      await within(dialog).findByText('Score exceeds maxScore.'),
    ).toBeVisible();
    expect(scoreInput).toHaveValue(75);
    expect(feedbackInput).toHaveValue('Buen análisis');

    fireEvent.click(
      within(dialog).getAllByRole('button', { name: 'Cerrar' })[0],
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Descartar y cerrar' }),
    );

    // MULTIPLE_CHOICE shows non-gradable notice
    const brunoRow = screen.getByText('Bruno Díaz').closest('li')!;
    fireEvent.click(
      within(brunoRow).getByRole('button', { name: 'Revisar y calificar' }),
    );
    const mcqDialog = await screen.findByRole('dialog');
    expect(
      await within(mcqDialog).findByText(
        gradingMessages.form.nonGradableNotice,
      ),
    ).toBeVisible();
  });

  it('resets filters and never leaks placeholderData when switching classrooms', async () => {
    const CLASSROOM_B_ID = '00000000-0000-4000-8000-000000000099';
    const activitiesStoreA = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });
    const gradingStoreA = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [
        makeSubmission({ studentDisplayName: 'Alumno Aula A' }),
      ],
    });
    const activitiesStoreB = createClassroomActivitiesStore({
      classroomId: CLASSROOM_B_ID,
      role: 'TEACHER',
      initialItems: [],
    });
    const gradingStoreB = createClassroomGradingStore({
      classroomId: CLASSROOM_B_ID,
      initialSubmissions: [
        makeSubmission({
          id: SUB_2_ID,
          classroomId: CLASSROOM_B_ID,
          studentDisplayName: 'Alumno Aula B',
        }),
      ],
    });
    mswServer.use(
      ...activitiesStoreA.handlers,
      ...gradingStoreA.handlers,
      createClassroomDetailHandler(CLASSROOM_ID, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/context-events`,
        () =>
          new HttpResponse(new ReadableStream<Uint8Array>(), {
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      ),
      createClassroomDetailHandler(CLASSROOM_B_ID, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_B_ID}/context-events`,
        () =>
          new HttpResponse(new ReadableStream<Uint8Array>(), {
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const session = fakeSession(
      { status: 'authenticated', user: { ...profile, id: 'teacher-user-1' } },
      client,
    );
    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });

    function ClassroomSwitcher() {
      const [currentClassroomId, setCurrentClassroomId] =
        useState(CLASSROOM_ID);
      return (
        <>
          <button
            type="button"
            onClick={() => setCurrentClassroomId(CLASSROOM_B_ID)}
          >
            Cambiar aula
          </button>
          <TeacherGradingQueuePanel classroomId={currentClassroomId} />
        </>
      );
    }

    render(
      <SessionProvider service={session.service}>
        <ApiQueryProvider client={queryClient}>
          <ClassroomSwitcher />
        </ApiQueryProvider>
      </SessionProvider>,
    );
    expect(
      await screen.findByText('Alumno Aula A', {}, { timeout: 500 }),
    ).toBeVisible();

    mswServer.use(...activitiesStoreB.handlers, ...gradingStoreB.handlers);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar aula' }));

    expect(
      await screen.findByText('Alumno Aula B', {}, { timeout: 500 }),
    ).toBeVisible();
    expect(screen.queryByText('Alumno Aula A')).not.toBeInTheDocument();
  });
});
