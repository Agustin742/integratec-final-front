import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
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
import { classroomDetailQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { Toast } from '@/components/ui/toast';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomActivitiesListHandler,
  createClassroomDetailHandler,
  createDeactivateActivityHandler,
  type ActivitySummaryPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ActivitiesPanel } from './activities-panel';
import {
  chooseRowAction,
  getRowMenuTrigger,
  openRowMenu,
} from './activities-test-utils';
import { formatActivityDeadline } from './format-activity-deadline';
import { activityMessages } from './messages';

// Menu and dialog flows with axe scans exceed the 5s default on busy machines.
vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T12:00:00.000Z'));
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  vi.useRealTimers();
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

const actionsCopy = activityMessages.actions;
const writeCopy = activityMessages.write;
const classroomId = '4e5f6a7b-0000-4000-8000-000000000033';

/** Draft file-submission TP, only visible to staff. */
const draftFileTp: ActivitySummaryPayload = {
  id: '6a6b6c6d-0000-4000-8000-0000000000a1',
  classroomId,
  type: 'TP',
  format: 'FILE',
  state: 'DRAFT',
  title: 'TP Fracciones',
  description: 'Resolver los ejercicios del capítulo 3.',
  opensAt: null,
  dueAt: '2026-11-30T23:59:00.000Z',
  allowLate: false,
  maxScore: 10,
  weightMultiplier: 1,
  publishedAt: null,
  timeZone: 'America/Argentina/Buenos_Aires',
  questionCount: 0,
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

/** Published multiple-choice exam with an opensAt window (server-decided). */
const publishedExam: ActivitySummaryPayload = {
  id: '6a6b6c6d-0000-4000-8000-0000000000a2',
  classroomId,
  type: 'EXAM',
  format: 'MULTIPLE_CHOICE',
  state: 'PUBLISHED',
  title: 'Examen Parcial',
  description: 'Opción múltiple sobre fracciones.',
  opensAt: '2026-11-25T13:00:00.000Z',
  dueAt: '2026-11-25T15:00:00.000Z',
  allowLate: true,
  maxScore: 10,
  weightMultiplier: 1.5,
  publishedAt: '2026-11-20T10:00:00.000Z',
  timeZone: 'America/Argentina/Buenos_Aires',
  questionCount: 3,
  createdAt: '2026-11-05T09:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

function renderActivitiesPanel(
  options: { readonly queryClient?: QueryClient } = {},
) {
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const view = render(
    <MemoryRouter>
      <SessionProvider service={session.service}>
        <Toast />
        <ActivitiesPanel classroomId={classroomId} />
      </SessionProvider>
    </MemoryRouter>,
    { queryClient },
  );
  return { queryClient, session, ...view };
}

describe('ActivitiesPanel teacher management (#39 + #41 unified)', () => {
  test('renders staff list with badges, FD11 school IANA timezone deadlines, detail links, scores, and passes axe checks', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftFileTp, publishedExam],
      }),
    );

    const { container } = renderActivitiesPanel();

    expect(await screen.findByText(draftFileTp.title)).toBeVisible();
    expect(screen.getByText(publishedExam.title)).toBeVisible();

    const list = screen.getByRole('group', {
      name: activityMessages.listRegionLabel,
    });
    expect(
      within(list).getByText(activityMessages.stateLabels.DRAFT),
    ).toBeVisible();
    expect(
      within(list).getByText(activityMessages.stateLabels.PUBLISHED),
    ).toBeVisible();
    expect(
      within(list).getByText(activityMessages.typeLabels.TP),
    ).toBeVisible();
    expect(
      within(list).getByText(activityMessages.typeLabels.EXAM),
    ).toBeVisible();
    expect(
      within(list).getByText(activityMessages.formatLabels.FILE),
    ).toBeVisible();
    expect(
      within(list).getByText(activityMessages.formatLabels.MULTIPLE_CHOICE),
    ).toBeVisible();

    // Deadlines render in the server school IANA time zone (FD11).
    expect(
      within(list).getByText(
        formatActivityDeadline(draftFileTp.dueAt, draftFileTp.timeZone),
      ),
    ).toBeVisible();
    expect(
      within(list).getByText(
        formatActivityDeadline(publishedExam.dueAt, publishedExam.timeZone),
      ),
    ).toBeVisible();
    expect(
      within(list).getByText(
        formatActivityDeadline(
          publishedExam.opensAt as string,
          publishedExam.timeZone,
        ),
      ),
    ).toBeVisible();

    expect(
      within(list).getByText(
        activityMessages.questionCountLabel(publishedExam.questionCount),
      ),
    ).toBeVisible();
    expect(
      within(list).getAllByText(
        activityMessages.board.scoreLabel(publishedExam.maxScore),
      ),
    ).toHaveLength(2);

    // Detail links stay available alongside teacher controls.
    expect(
      screen.getByRole('link', {
        name: `${activityMessages.openDetailLabel}: ${draftFileTp.title}`,
      }),
    ).toHaveAttribute(
      'href',
      `/classrooms/${classroomId}/activities/${draftFileTp.id}`,
    );

    expect(
      screen.getByLabelText(activityMessages.stateFilterLabel),
    ).toBeVisible();
    expect(getRowMenuTrigger(draftFileTp.title)).toBeEnabled();
    expect(getRowMenuTrigger(publishedExam.title)).toBeEnabled();

    await expectAccessible(container);
  });

  test('student view renders published activities with detail link and without staff controls', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [publishedExam],
      }),
    );

    const { container } = renderActivitiesPanel();

    expect(await screen.findByText(publishedExam.title)).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: `${activityMessages.openDetailLabel}: ${publishedExam.title}`,
      }),
    ).toBeVisible();

    expect(
      screen.queryByRole('button', { name: /^Acciones de/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: actionsCopy.createAction }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: actionsCopy.editAction }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(activityMessages.stateFilterLabel),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('shows loading, initial error with retry, and stale refresh notice keeping confirmed rows', async () => {
    let releaseInitial!: () => void;
    const initialGate = new Promise<void>((resolve) => {
      releaseInitial = resolve;
    });
    let calls = 0;

    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        resolveResponse: async () => {
          calls += 1;
          if (calls === 1) {
            await initialGate;
            return HttpResponse.json(
              {
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'DB failure must never leak',
                  correlationId: 'corr-activities-1',
                },
              },
              { status: 500 },
            );
          }
          if (calls === 2) {
            return HttpResponse.json({
              items: [publishedExam],
              page: 1,
              pageSize: 10,
              total: 1,
            });
          }
          return HttpResponse.json(
            {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Background refresh failure',
                correlationId: 'corr-activities-3',
              },
            },
            { status: 500 },
          );
        },
      }),
    );

    const { queryClient } = renderActivitiesPanel();
    expect(
      await screen.findByText(activityMessages.loadingLabel),
    ).toBeVisible();

    releaseInitial();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(activityMessages.errorTitle);
    expect(alert).not.toHaveTextContent('DB failure');

    fireEvent.click(
      screen.getByRole('button', { name: activityMessages.retryLabel }),
    );
    expect(await screen.findByText(publishedExam.title)).toBeVisible();

    await act(() => queryClient.invalidateQueries());
    expect(await screen.findByText(activityMessages.staleTitle)).toBeVisible();
    expect(screen.getByText(publishedExam.title)).toBeVisible();
  });

  test('renders staff and student empty states with role-appropriate copy', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
    );

    renderActivitiesPanel();
    expect(
      await screen.findByText(activityMessages.emptyTitleStaff),
    ).toBeVisible();
    expect(
      screen.getByText(activityMessages.emptyDescriptionStaff),
    ).toBeVisible();
  });

  test('renders the student empty state without staff copy or controls', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
    );

    renderActivitiesPanel();
    expect(await screen.findByText(activityMessages.emptyTitle)).toBeVisible();
    expect(screen.getByText(activityMessages.emptyDescription)).toBeVisible();
    expect(
      screen.queryByLabelText(activityMessages.stateFilterLabel),
    ).not.toBeInTheDocument();
  });

  test('state filter DRAFT refetches with state=DRAFT and offers clear-filter recovery', async () => {
    const observedStates: Array<string | null> = [];
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [publishedExam],
        resolveResponse: ({ state }) => {
          observedStates.push(state);
        },
      }),
    );

    renderActivitiesPanel();

    expect(await screen.findByText(publishedExam.title)).toBeVisible();
    expect(observedStates).toEqual([null]);

    fireEvent.change(screen.getByLabelText(activityMessages.stateFilterLabel), {
      target: { value: 'DRAFT' },
    });
    expect(
      await screen.findByText(activityMessages.emptyFilteredDescription),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: activityMessages.clearFilterLabel }),
    ).toBeEnabled();
    expect(observedStates.at(-1)).toBe('DRAFT');

    fireEvent.click(
      screen.getByRole('button', { name: activityMessages.clearFilterLabel }),
    );
    expect(await screen.findByText(publishedExam.title)).toBeVisible();
    expect(observedStates.at(-1)).toBe(null);
  });

  test('renders non-disclosing 403 and 404 without activity data and invalidates classroom detail on 404', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Student role cannot read staff activities',
            correlationId: 'corr-activities-403',
          },
        },
      }),
    );

    const view403 = renderActivitiesPanel();
    const alert403 = await screen.findByRole('alert');
    expect(alert403).toHaveTextContent(activityMessages.forbiddenTitle);
    expect(alert403).not.toHaveTextContent('Student role');
    expect(screen.queryByText(publishedExam.title)).not.toBeInTheDocument();
    view403.unmount();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(classroomDetailQueryKey(profile.id, classroomId), {
      id: classroomId,
      name: 'Aula vieja',
      myRole: 'TEACHER',
      capabilities: [],
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mswServer.use(
      createClassroomActivitiesListHandler({
        classroomId,
        error: {
          status: 404,
          body: {
            code: 'NOT_FOUND',
            message: 'Classroom not found for user',
            correlationId: 'corr-activities-404',
          },
        },
      }),
    );

    renderActivitiesPanel({ queryClient });
    const alert404 = await screen.findByRole('alert');
    expect(alert404).toHaveTextContent(activityMessages.notFoundTitle);
    expect(alert404).not.toHaveTextContent('Classroom not found');
    expect(screen.queryByText(publishedExam.title)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: classroomDetailQueryKey(profile.id, classroomId),
        exact: true,
      });
    });
  });

  test('staff without publish_content see the list and detail link but no management actions', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: [],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftFileTp],
      }),
    );

    renderActivitiesPanel();

    expect(await screen.findByText(draftFileTp.title)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: actionsCopy.createAction }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Acciones de/ }),
    ).not.toBeInTheDocument();
  });

  test('staff actions: create in the header, edit and delete in every row menu, publish only for drafts', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftFileTp, publishedExam],
      }),
    );

    const { container } = renderActivitiesPanel();

    expect(await screen.findByText(draftFileTp.title)).toBeVisible();
    expect(
      screen.getByRole('button', { name: actionsCopy.createAction }),
    ).toBeEnabled();

    const menuItems = async (title: string): Promise<string[]> => {
      const trigger = await openRowMenu(title);
      const menu = await screen.findByRole('menu');
      const labels = within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent ?? '');
      fireEvent.keyDown(menu, { key: 'Escape' });
      await waitFor(() =>
        expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
      );
      await waitFor(() => expect(trigger).toHaveFocus());
      return labels;
    };
    expect(await menuItems(draftFileTp.title)).toEqual([
      actionsCopy.editAction,
      actionsCopy.publishAction,
      actionsCopy.deactivateAction,
    ]);
    expect(await menuItems(publishedExam.title)).toEqual([
      actionsCopy.editAction,
      actionsCopy.deactivateAction,
    ]);

    await expectAccessible(container);
  });

  test('deactivation confirms with focus management, cancels back to trigger, and reconciles on 204', async () => {
    const deactivatedActivityIds: string[] = [];
    let listCalls = 0;

    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        resolveResponse: () => {
          listCalls += 1;
          return listCalls === 1
            ? HttpResponse.json({
                items: [draftFileTp],
                page: 1,
                pageSize: 10,
                total: 1,
              })
            : HttpResponse.json({
                items: [],
                page: 1,
                pageSize: 10,
                total: 0,
              });
        },
      }),
      createDeactivateActivityHandler({
        classroomId,
        activityId: draftFileTp.id,
        resolveResponse: ({ activityId }) => {
          deactivatedActivityIds.push(activityId);
        },
      }),
    );

    renderActivitiesPanel();

    const trigger = await chooseRowAction(draftFileTp.title, 'deactivate');

    const confirmRegion = await screen.findByRole('region', {
      name: actionsCopy.deactivateConfirmTitle(draftFileTp.title),
    });
    expect(confirmRegion).toHaveTextContent(
      actionsCopy.deactivateConfirmDescription,
    );
    expect(
      within(confirmRegion).getByRole('heading', { level: 4 }),
    ).toHaveFocus();

    fireEvent.click(
      within(confirmRegion).getByRole('button', {
        name: actionsCopy.deactivateConfirmCancel,
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('region', {
          name: actionsCopy.deactivateConfirmTitle(draftFileTp.title),
        }),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => expect(trigger).toHaveFocus());

    await chooseRowAction(draftFileTp.title, 'deactivate');
    const activeConfirmRegion = await screen.findByRole('region', {
      name: actionsCopy.deactivateConfirmTitle(draftFileTp.title),
    });
    fireEvent.click(
      within(activeConfirmRegion).getByRole('button', {
        name: actionsCopy.deactivateConfirmSubmit,
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('region', {
          name: actionsCopy.deactivateConfirmTitle(draftFileTp.title),
        }),
      ).not.toBeInTheDocument();
    });
    expect(deactivatedActivityIds).toEqual([draftFileTp.id]);
    expect(await screen.findByText(actionsCopy.deactivatedTitle)).toBeVisible();
    expect(
      screen.getByText(actionsCopy.deactivatedDescription(draftFileTp.title)),
    ).toBeVisible();

    expect(
      await screen.findByText(activityMessages.emptyTitleStaff),
    ).toBeVisible();
    expect(screen.queryByText(draftFileTp.title)).not.toBeInTheDocument();
    expect(listCalls).toBe(2);
    expect(
      screen.getByRole('heading', { level: 3, name: activityMessages.heading }),
    ).toHaveFocus();
  });

  test('deactivation 409 keeps the confirmation open, reconciles, and explains the submissions refusal', async () => {
    let listCalls = 0;
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        resolveResponse: () => {
          listCalls += 1;
          return HttpResponse.json({
            items: [draftFileTp],
            page: 1,
            pageSize: 10,
            total: 1,
          });
        },
      }),
      createDeactivateActivityHandler({
        classroomId,
        activityId: draftFileTp.id,
        error: {
          status: 409,
          body: {
            code: 'CONFLICT',
            message: 'Activity has submissions and cannot be deactivated',
            correlationId: 'corr-deactivate-409',
          },
        },
      }),
    );

    renderActivitiesPanel();

    await chooseRowAction(draftFileTp.title, 'deactivate');
    const confirmRegion = await screen.findByRole('region', {
      name: actionsCopy.deactivateConfirmTitle(draftFileTp.title),
    });
    fireEvent.click(
      within(confirmRegion).getByRole('button', {
        name: actionsCopy.deactivateConfirmSubmit,
      }),
    );

    const alert = await within(confirmRegion).findByRole('alert');
    expect(alert).toHaveTextContent(actionsCopy.deactivateErrorTitle);
    expect(alert).toHaveTextContent(writeCopy.deactivateHasSubmissions);
    expect(alert).not.toHaveTextContent('cannot be deactivated');
    expect(confirmRegion).toBeVisible();
    await waitFor(() => {
      expect(listCalls).toBeGreaterThanOrEqual(2);
    });
  });

  test('aborts in-flight deactivation on unmount without unhandled rejections', async () => {
    let observedAbort = false;
    let releaseDeactivate!: () => void;
    const deactivateGate = new Promise<void>((resolve) => {
      releaseDeactivate = resolve;
    });

    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'TEACHER',
        capabilities: ['publish_content'],
      }),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftFileTp],
      }),
      createDeactivateActivityHandler({
        classroomId,
        activityId: draftFileTp.id,
        onRequest: (request) => {
          request.signal.addEventListener('abort', () => {
            observedAbort = true;
          });
        },
        resolveResponse: async () => {
          await deactivateGate;
        },
      }),
    );

    const view = renderActivitiesPanel();
    await chooseRowAction(draftFileTp.title, 'deactivate');
    fireEvent.click(
      await screen.findByRole('button', {
        name: actionsCopy.deactivateConfirmSubmit,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: actionsCopy.deactivateConfirmPending,
        }),
      ).toHaveAttribute('aria-disabled', 'true');
    });

    view.unmount();
    expect(observedAbort).toBe(true);
    releaseDeactivate();
    await act(async () => {
      await Promise.resolve();
    });
  });
});
