import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { HttpResponse } from 'msw';
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
import { formatInstant } from '@/lib/dates';
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
import { classroomMessages } from '../messages';
import { ClassroomActivitiesPanel } from './classroom-activities-panel';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

const copy = classroomMessages.activities.panel;
const writeCopy = classroomMessages.activities.write;
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

/** School-timezone display text for one summary instant (FD11: never the browser zone). */
function schoolInstantText(
  isoInstant: string,
  timeZone: string,
  label: string,
): string {
  return `${label}: ${formatInstant(isoInstant, { timeZone })}`;
}

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
    <SessionProvider service={session.service}>
      <Toast />
      <ClassroomActivitiesPanel classroomId={classroomId} />
    </SessionProvider>,
    { queryClient },
  );
  return { queryClient, session, ...view };
}

describe('ClassroomActivitiesPanel (#39)', () => {
  test('renders staff list with badges, school-timezone dates, scores, and passes accessibility checks', async () => {
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

    expect(screen.getByText(copy.states.DRAFT)).toBeVisible();
    expect(screen.getByText(copy.states.PUBLISHED)).toBeVisible();
    expect(screen.getByText(copy.types.TP)).toBeVisible();
    expect(screen.getByText(copy.types.EXAM)).toBeVisible();
    expect(screen.getByText(copy.formats.FILE)).toBeVisible();
    expect(screen.getByText(copy.formats.MULTIPLE_CHOICE)).toBeVisible();

    expect(
      screen.getByText(
        schoolInstantText(
          draftFileTp.dueAt,
          draftFileTp.timeZone,
          copy.dueAtLabel,
        ),
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        schoolInstantText(
          publishedExam.dueAt,
          publishedExam.timeZone,
          copy.dueAtLabel,
        ),
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        schoolInstantText(
          publishedExam.opensAt as string,
          publishedExam.timeZone,
          copy.opensAtLabel,
        ),
      ),
    ).toBeVisible();
    expect(screen.getByText(copy.allowLateLabel)).toBeVisible();
    expect(
      screen.getByText(copy.questionCountLabel(publishedExam.questionCount)),
    ).toBeVisible();
    expect(
      screen.getByText(
        `${copy.maxScoreLabel(publishedExam.maxScore)} · ${copy.weightLabel(publishedExam.weightMultiplier)}`,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        `${copy.maxScoreLabel(draftFileTp.maxScore)} · ${copy.weightLabel(draftFileTp.weightMultiplier)}`,
      ),
    ).toBeVisible();

    expect(screen.getByText(copy.stateFilterLabel)).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: copy.deactivateAriaLabel(draftFileTp.title),
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: copy.deactivateAriaLabel(publishedExam.title),
      }),
    ).toBeEnabled();

    await expectAccessible(container);
  });

  test('student view renders published activities without staff controls', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [publishedExam],
      }),
    );

    const { container } = renderActivitiesPanel();

    expect(await screen.findByText(publishedExam.title)).toBeVisible();
    expect(screen.getByText(copy.states.PUBLISHED)).toBeVisible();

    expect(
      screen.queryByRole('button', {
        name: copy.deactivateAriaLabel(publishedExam.title),
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(copy.stateFilterLabel)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.stateOptions.DRAFT }),
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
              pageSize: 20,
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
    expect(await screen.findByText(copy.loading)).toBeVisible();

    releaseInitial();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy.errorTitle);
    expect(alert).not.toHaveTextContent('DB failure');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(publishedExam.title)).toBeVisible();

    await act(() => queryClient.invalidateQueries());
    expect(await screen.findByText(copy.staleTitle)).toBeVisible();
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
    expect(await screen.findByText(copy.emptyTitleStaff)).toBeVisible();
    expect(screen.getByText(copy.emptyDescriptionStaff)).toBeVisible();
  });

  test('renders the student empty state without staff copy or controls', async () => {
    mswServer.use(
      createClassroomDetailHandler(classroomId),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
    );

    renderActivitiesPanel();
    expect(await screen.findByText(copy.emptyTitleStudent)).toBeVisible();
    expect(screen.getByText(copy.emptyDescriptionStudent)).toBeVisible();
    expect(screen.queryByText(copy.stateFilterLabel)).not.toBeInTheDocument();
  });

  test('state filter DRAFT refetches with state=DRAFT and offers clear-filters recovery', async () => {
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

    fireEvent.click(
      screen.getByRole('button', { name: copy.stateOptions.DRAFT }),
    );
    expect(await screen.findByText(copy.emptyFilteredTitle)).toBeVisible();
    expect(
      screen.getByRole('button', { name: copy.clearFiltersAction }),
    ).toBeEnabled();
    expect(observedStates.at(-1)).toBe('DRAFT');

    fireEvent.click(
      screen.getByRole('button', { name: copy.clearFiltersAction }),
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
    expect(alert403).toHaveTextContent(copy.forbiddenTitle);
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
    expect(alert404).toHaveTextContent(copy.notFoundTitle);
    expect(alert404).not.toHaveTextContent('Classroom not found');
    expect(screen.queryByText(publishedExam.title)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: classroomDetailQueryKey(profile.id, classroomId),
        exact: true,
      });
    });
  });

  test('deactivation confirms with focus management, cancels back to the trigger, and reconciles on 204', async () => {
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
                pageSize: 20,
                total: 1,
              })
            : HttpResponse.json({
                items: [],
                page: 1,
                pageSize: 20,
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

    const trigger = await screen.findByRole('button', {
      name: copy.deactivateAriaLabel(draftFileTp.title),
    });
    fireEvent.click(trigger);

    const confirmRegion = await screen.findByRole('region', {
      name: copy.deactivateConfirmTitle(draftFileTp.title),
    });
    expect(confirmRegion).toHaveTextContent(copy.deactivateConfirmDescription);
    expect(
      within(confirmRegion).getByRole('heading', { level: 4 }),
    ).toHaveFocus();

    fireEvent.click(
      within(confirmRegion).getByRole('button', {
        name: copy.deactivateConfirmCancel,
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('region', {
          name: copy.deactivateConfirmTitle(draftFileTp.title),
        }),
      ).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    const activeConfirmRegion = await screen.findByRole('region', {
      name: copy.deactivateConfirmTitle(draftFileTp.title),
    });
    fireEvent.click(
      within(activeConfirmRegion).getByRole('button', {
        name: copy.deactivateConfirmSubmit,
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('region', {
          name: copy.deactivateConfirmTitle(draftFileTp.title),
        }),
      ).not.toBeInTheDocument();
    });
    expect(deactivatedActivityIds).toEqual([draftFileTp.id]);
    expect(await screen.findByText(copy.deactivatedTitle)).toBeVisible();
    expect(
      screen.getByText(copy.deactivatedDescription(draftFileTp.title)),
    ).toBeVisible();

    // Confirmed write reconciles the list through query invalidation.
    expect(await screen.findByText(copy.emptyTitleStaff)).toBeVisible();
    expect(screen.queryByText(draftFileTp.title)).not.toBeInTheDocument();
    expect(listCalls).toBe(2);
    expect(
      screen.getByRole('heading', { level: 3, name: copy.heading }),
    ).toHaveFocus();
  });

  test('deactivation 409 keeps the confirmation open and explains the submissions refusal', async () => {
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

    fireEvent.click(
      await screen.findByRole('button', {
        name: copy.deactivateAriaLabel(draftFileTp.title),
      }),
    );
    const confirmRegion = await screen.findByRole('region', {
      name: copy.deactivateConfirmTitle(draftFileTp.title),
    });
    fireEvent.click(
      within(confirmRegion).getByRole('button', {
        name: copy.deactivateConfirmSubmit,
      }),
    );

    const alert = await within(confirmRegion).findByRole('alert');
    expect(alert).toHaveTextContent(copy.deactivateErrorTitle);
    expect(alert).toHaveTextContent(writeCopy.deactivateHasSubmissions);
    expect(alert).not.toHaveTextContent('cannot be deactivated');
    expect(confirmRegion).toBeVisible();
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
    fireEvent.click(
      await screen.findByRole('button', {
        name: copy.deactivateAriaLabel(draftFileTp.title),
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: copy.deactivateConfirmSubmit }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: copy.deactivateConfirmPending }),
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
