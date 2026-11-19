import { screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { createApiClient } from '@/api/client';
import { createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { paginationMessages } from '@/components/pagination/pagination-controls';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomContextHandler,
  createClassroomMetricsHandler,
  createOwnDailyMetricsHandler,
  createStudentReportCardHandler,
  createStudentWalletHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import type { ClassroomRole } from '../use-classroom-capabilities';
import { GradesPanel } from './grades-panel';
import { gradesMessages } from './messages';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000046';
const student = gradesMessages.student;
const teacher = gradesMessages.teacher;

// Synthetic diagnostics of the MSW error envelopes; they must never render.
const NOT_FOUND_DIAGNOSTIC = 'Classroom not found.';
const FORBIDDEN_DIAGNOSTIC =
  'Caller does not have the role this resource requires in this classroom.';

/** Table row that contains the given cell text, for within() assertions. */
function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest('tr');
  if (row === null) {
    throw new Error(`No table row contains the text "${text}".`);
  }
  return row;
}

function renderGradesPanel(
  options: {
    readonly role?: ClassroomRole;
  } = {},
) {
  const role = options.role ?? 'STUDENT';
  mswServer.use(createClassroomContextHandler(CLASSROOM_ID, { myRole: role }));

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: (
          <main>
            <GradesPanel />
          </main>
        ),
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
  );
  const rendered = render(
    <SessionProvider service={session.service}>
      <RouterProvider router={router} />
    </SessionProvider>,
    { queryClient },
  );
  return { ...rendered, queryClient };
}

/**
 * Registers the three student-view handlers, incl. the embedded wallet. The
 * wallet fixture is empty on purpose: `WalletPanel` renders its own pagination
 * whenever its total is positive, so grades-pagination assertions stay
 * deterministic only when the wallet shows no controls of its own.
 */
function useStudentHandlers() {
  mswServer.use(
    createStudentReportCardHandler(CLASSROOM_ID),
    createOwnDailyMetricsHandler(CLASSROOM_ID),
    createStudentWalletHandler(CLASSROOM_ID, {
      response: { items: [], total: 0, balance: 0 },
    }),
  );
}

describe('GradesPanel (#46, HU-ACT-005)', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  test('student view renders server-owned grades, verbatim feedback, signed points, late badge, school-zone dates, own metrics and the wallet slot', async () => {
    useStudentHandlers();
    const { container } = renderGradesPanel();

    expect(
      await screen.findByRole('heading', { name: student.heading, level: 3 }),
    ).toBeVisible();
    expect(screen.getByText(student.subtitle)).toBeVisible();

    // Graded activities with their contract type badges.
    expect(screen.getByText('Fracciones: guía de ejercicios')).toBeVisible();
    expect(screen.getByText('Examen de geometría')).toBeVisible();
    expect(screen.getByText('Práctica de porcentajes')).toBeVisible();
    expect(screen.getAllByText(student.typeLabels.TP)).toHaveLength(2);
    expect(screen.getByText(student.typeLabels.EXAM)).toBeVisible();
    // Only the late item carries the late badge.
    expect(screen.getByText(student.lateBadge)).toBeVisible();

    // Scores exactly as graded and feedback rendered verbatim.
    expect(screen.getByText('82 / 100')).toBeVisible();
    expect(screen.getByText('60 / 100')).toBeVisible();
    expect(screen.getByText('45 / 50')).toBeVisible();
    expect(
      screen.getByText(
        'Muy buen trabajo. Repasá la simplificación de fracciones.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Entregado fuera de término. Repasá triángulos y perímetros.',
      ),
    ).toBeVisible();

    // Signed points and grading instants in the school time zone.
    expect(screen.getByText(`${student.pointsLabel} +41`)).toBeVisible();
    expect(screen.getByText(`${student.pointsLabel} +30`)).toBeVisible();
    expect(screen.getByText(`${student.pointsLabel} +22`)).toBeVisible();
    expect(screen.getByText('12/11/2026, 12:30')).toBeVisible();
    expect(screen.getByText('16/11/2026, 06:15')).toBeVisible();
    expect(screen.getByText('19/11/2026, 08:05')).toBeVisible();

    // Own daily metrics: UTC calendar days, connected duration, raw counts.
    expect(
      screen.getByRole('columnheader', { name: student.metrics.dayColumn }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', {
        name: student.metrics.connectedColumn,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', {
        name: student.metrics.submissionsColumn,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', {
        name: student.metrics.messagesColumn,
      }),
    ).toBeVisible();
    const firstMetricRow = rowOf('18/11/2026');
    expect(within(firstMetricRow).getByText('1 h 15 min')).toBeVisible();
    expect(within(firstMetricRow).getByText('1')).toBeVisible();
    expect(within(firstMetricRow).getByText('3')).toBeVisible();
    const secondMetricRow = rowOf('17/11/2026');
    expect(within(secondMetricRow).getByText('15 min')).toBeVisible();
    expect(within(secondMetricRow).getAllByText('0')).toHaveLength(2);
    const thirdMetricRow = rowOf('16/11/2026');
    expect(within(thirdMetricRow).getByText('2 h 0 min')).toBeVisible();
    expect(within(thirdMetricRow).getByText('2')).toBeVisible();
    expect(within(thirdMetricRow).getByText('5')).toBeVisible();

    // The wallet component slot is part of the student panel.
    expect(
      screen.getByRole('heading', {
        name: student.wallet.heading,
        level: 4,
      }),
    ).toBeVisible();
    expect(screen.getByText(student.wallet.subtitle)).toBeVisible();

    // Three items fit one page: no pagination controls.
    expect(
      screen.queryByRole('navigation', {
        name: paginationMessages.navigationLabel,
      }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('student report card shows pagination controls only when total exceeds the page size', async () => {
    mswServer.use(
      createStudentReportCardHandler(CLASSROOM_ID, {
        response: { total: 45 },
      }),
      createOwnDailyMetricsHandler(CLASSROOM_ID),
      createStudentWalletHandler(CLASSROOM_ID, {
        response: { items: [], total: 0, balance: 0 },
      }),
    );
    renderGradesPanel();

    expect(
      await screen.findByText('Fracciones: guía de ejercicios'),
    ).toBeVisible();
    expect(
      screen.getByRole('navigation', {
        name: paginationMessages.navigationLabel,
      }),
    ).toBeVisible();
  });

  test('teacher view renders raw per-student metrics with display names as row headers and no sorting controls', async () => {
    mswServer.use(createClassroomMetricsHandler(CLASSROOM_ID));
    const { container } = renderGradesPanel({ role: 'TEACHER' });

    expect(
      await screen.findByRole('heading', { name: teacher.heading, level: 3 }),
    ).toBeVisible();
    expect(screen.getByText(teacher.subtitle)).toBeVisible();

    // Every column of the contract is labeled.
    expect(
      screen.getByRole('columnheader', { name: teacher.columns.student }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: teacher.columns.connected }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: teacher.columns.submissions }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: teacher.columns.messages }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: teacher.columns.graded }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: teacher.columns.ungraded }),
    ).toBeVisible();

    // Per-student rows expose the display name as the row header.
    const anaRow = rowOf('Ana Sánchez');
    expect(
      within(anaRow).getByRole('rowheader', { name: 'Ana Sánchez' }),
    ).toBeVisible();
    expect(within(anaRow).getByText('10 h 0 min')).toBeVisible();
    expect(within(anaRow).getByText('12')).toBeVisible();
    expect(within(anaRow).getByText('27')).toBeVisible();
    expect(within(anaRow).getByText('10')).toBeVisible();
    expect(within(anaRow).getByText('2')).toBeVisible();

    const brunoRow = rowOf('Bruno Díaz');
    expect(
      within(brunoRow).getByRole('rowheader', { name: 'Bruno Díaz' }),
    ).toBeVisible();
    expect(within(brunoRow).getByText('1 h 30 min')).toBeVisible();
    expect(within(brunoRow).getByText('3')).toBeVisible();
    expect(within(brunoRow).getByText('0')).toBeVisible();
    expect(within(brunoRow).getByText('1')).toBeVisible();
    expect(within(brunoRow).getByText('2')).toBeVisible();

    const carolinaRow = rowOf('Carolina Pérez');
    expect(
      within(carolinaRow).getByRole('rowheader', { name: 'Carolina Pérez' }),
    ).toBeVisible();
    expect(within(carolinaRow).getByText('3 h 36 min')).toBeVisible();
    expect(within(carolinaRow).getAllByText('8')).toHaveLength(2);
    expect(within(carolinaRow).getByText('12')).toBeVisible();
    expect(within(carolinaRow).getByText('0')).toBeVisible();

    // The contract has no sort: no sorting controls of any kind.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /ordenar/i }),
    ).not.toBeInTheDocument();
    // Three students fit one page: no pagination buttons either.
    expect(
      screen.queryByRole('navigation', {
        name: paginationMessages.navigationLabel,
      }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('teacher metrics show pagination controls only when total exceeds the page size', async () => {
    mswServer.use(
      createClassroomMetricsHandler(CLASSROOM_ID, {
        response: { total: 45 },
      }),
    );
    renderGradesPanel({ role: 'TEACHER' });

    expect(await screen.findByText('Ana Sánchez')).toBeVisible();
    expect(
      screen.getByRole('navigation', {
        name: paginationMessages.navigationLabel,
      }),
    ).toBeVisible();
  });

  test('a student with no grades and no metrics sees both empty states', async () => {
    mswServer.use(
      createStudentReportCardHandler(CLASSROOM_ID, {
        response: { items: [], total: 0 },
      }),
      createOwnDailyMetricsHandler(CLASSROOM_ID, {
        response: { items: [], total: 0 },
      }),
      createStudentWalletHandler(CLASSROOM_ID, {
        response: { items: [], total: 0, balance: 0 },
      }),
    );
    const { container } = renderGradesPanel();

    expect(
      await screen.findByRole('heading', { name: student.emptyTitle }),
    ).toBeVisible();
    expect(screen.getByText(student.emptyDescription)).toBeVisible();
    expect(
      await screen.findByRole('heading', {
        name: student.metrics.emptyTitle,
      }),
    ).toBeVisible();
    expect(screen.getByText(student.metrics.emptyDescription)).toBeVisible();
    expect(
      screen.queryByRole('navigation', {
        name: paginationMessages.navigationLabel,
      }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('a teacher with an empty classroom sees the teaching empty state', async () => {
    mswServer.use(
      createClassroomMetricsHandler(CLASSROOM_ID, {
        response: { items: [], total: 0 },
      }),
    );
    const { container } = renderGradesPanel({ role: 'TEACHER' });

    expect(
      await screen.findByRole('heading', { name: teacher.emptyTitle }),
    ).toBeVisible();
    expect(screen.getByText(teacher.emptyDescription)).toBeVisible();
    expect(
      screen.queryByRole('navigation', {
        name: paginationMessages.navigationLabel,
      }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('a 404 on a foreign classroom shows the student not-found state and never leaks data or the server diagnostic', async () => {
    mswServer.use(
      createStudentReportCardHandler(CLASSROOM_ID, { status: 404 }),
      createOwnDailyMetricsHandler(CLASSROOM_ID),
    );
    const { container } = renderGradesPanel();

    expect(
      await screen.findByRole('heading', { name: student.notFoundTitle }),
    ).toBeVisible();
    expect(screen.getByText(student.notFoundDescription)).toBeVisible();
    // No report card data leaks once the server says the classroom is foreign.
    expect(
      screen.queryByText('Fracciones: guía de ejercicios'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: student.heading }),
    ).not.toBeInTheDocument();
    // The synthetic server diagnostic never renders.
    expect(screen.queryByText(NOT_FOUND_DIAGNOSTIC)).not.toBeInTheDocument();
    // 404 is terminal: no retry action is offered.
    expect(
      screen.queryByRole('button', { name: student.retryLabel }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('a 404 on a foreign classroom shows the teacher not-found state without student data', async () => {
    mswServer.use(createClassroomMetricsHandler(CLASSROOM_ID, { status: 404 }));
    renderGradesPanel({ role: 'TEACHER' });

    expect(
      await screen.findByRole('heading', { name: teacher.notFoundTitle }),
    ).toBeVisible();
    expect(screen.queryByText('Ana Sánchez')).not.toBeInTheDocument();
    expect(screen.queryByText(NOT_FOUND_DIAGNOSTIC)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: teacher.retryLabel }),
    ).not.toBeInTheDocument();
  });

  test('a forbidden student report card endpoint shows the student forbidden state', async () => {
    mswServer.use(
      createStudentReportCardHandler(CLASSROOM_ID, { status: 403 }),
      createOwnDailyMetricsHandler(CLASSROOM_ID),
    );
    const { container } = renderGradesPanel();

    expect(
      await screen.findByRole('heading', { name: student.forbiddenTitle }),
    ).toBeVisible();
    expect(screen.getByText(student.forbiddenDescription)).toBeVisible();
    // No report card data and no server diagnostic render.
    expect(
      screen.queryByText('Fracciones: guía de ejercicios'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(FORBIDDEN_DIAGNOSTIC)).not.toBeInTheDocument();
    // 403 is terminal: no retry action is offered.
    expect(
      screen.queryByRole('button', { name: student.retryLabel }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('a forbidden teacher metrics endpoint shows the teaching forbidden state', async () => {
    mswServer.use(createClassroomMetricsHandler(CLASSROOM_ID, { status: 403 }));
    const { container } = renderGradesPanel({ role: 'TEACHER' });

    expect(
      await screen.findByRole('heading', { name: teacher.forbiddenTitle }),
    ).toBeVisible();
    expect(screen.getByText(teacher.forbiddenDescription)).toBeVisible();
    expect(screen.queryByText('Ana Sánchez')).not.toBeInTheDocument();
    expect(screen.queryByText(FORBIDDEN_DIAGNOSTIC)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: teacher.retryLabel }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('shows the loading state while the server answer is pending', async () => {
    // A handler whose request hook never settles keeps the query pending.
    const neverSettles = new Promise<never>(() => {});
    mswServer.use(
      createStudentReportCardHandler(CLASSROOM_ID, {
        onRequest: () => neverSettles,
      }),
      createOwnDailyMetricsHandler(CLASSROOM_ID),
    );
    const studentView = renderGradesPanel();

    expect(screen.getByRole('status')).toHaveTextContent(student.loadingLabel);
    await expectAccessible(studentView.container);
    studentView.unmount();

    mswServer.use(
      createClassroomMetricsHandler(CLASSROOM_ID, {
        onRequest: () => neverSettles,
      }),
    );
    const teacherView = renderGradesPanel({ role: 'TEACHER' });

    // The classroom context resolves first; then the gated metrics query
    // keeps the teaching loading state on screen.
    expect(await screen.findByText(teacher.loadingLabel)).toBeVisible();
    await expectAccessible(teacherView.container);
    teacherView.unmount();
  });
});
