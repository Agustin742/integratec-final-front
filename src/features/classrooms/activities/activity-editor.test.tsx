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
import { fakeSession } from '@/app/router/fake-session';
import { Toast } from '@/components/ui/toast';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createActivityDetailHandler,
  createClassroomActivitiesListHandler,
  createClassroomDetailHandler,
  createCreateActivityHandler,
  createPublishActivityHandler,
  createUpdateActivityHandler,
  type ActivitySummaryPayload,
  type CreateActivityRequestPayload,
  type TeacherActivityPayload,
  type UpdateActivityRequestPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ActivitiesPanel } from './activities-panel';
import { chooseRowAction } from './activities-test-utils';
import { activityMessages } from './messages';

// Multi-step dialog flows (several submits, MSW round trips, a11y scans)
// exceed the 5s default in this file.
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
const editorCopy = activityMessages.editor;
const questionsCopy = editorCopy.questions;
const validationCopy = activityMessages.validation;
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

/** Published version of the draft above, after a confirmed publish. */
const publishedFileTp: ActivitySummaryPayload = {
  ...draftFileTp,
  state: 'PUBLISHED',
  publishedAt: '2026-11-18T13:00:00.000Z',
  updatedAt: '2026-11-18T13:00:00.000Z',
};

/** Draft multiple-choice exam with an opensAt window, used for edit mode. */
const draftExamSummary: ActivitySummaryPayload = {
  id: '6a6b6c6d-0000-4000-8000-0000000000a3',
  classroomId,
  type: 'EXAM',
  format: 'MULTIPLE_CHOICE',
  state: 'DRAFT',
  title: 'Examen Parcial',
  description: 'Opción múltiple sobre fracciones.',
  opensAt: '2026-11-25T13:00:00.000Z',
  dueAt: '2026-11-30T23:00:00.000Z',
  allowLate: true,
  maxScore: 10,
  weightMultiplier: 1.5,
  publishedAt: null,
  timeZone: 'America/Argentina/Buenos_Aires',
  questionCount: 2,
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

/** Teacher view of the draft exam: includes `isCorrect` per option. */
const draftExamDetail: TeacherActivityPayload = {
  id: draftExamSummary.id,
  classroomId,
  type: 'EXAM',
  format: 'MULTIPLE_CHOICE',
  state: 'DRAFT',
  title: draftExamSummary.title,
  description: draftExamSummary.description,
  opensAt: draftExamSummary.opensAt,
  dueAt: draftExamSummary.dueAt,
  allowLate: draftExamSummary.allowLate,
  maxScore: draftExamSummary.maxScore,
  weightMultiplier: draftExamSummary.weightMultiplier,
  publishedAt: null,
  timeZone: 'America/Argentina/Buenos_Aires',
  questionCount: 2,
  createdAt: draftExamSummary.createdAt,
  updatedAt: draftExamSummary.updatedAt,
  createdById: profile.id,
  questions: [
    {
      id: '6a6b6c6d-0000-4000-8000-000000000101',
      position: 1,
      prompt: '¿Cuánto es 2 + 2?',
      options: [
        {
          id: '6a6b6c6d-0000-4000-8000-000000001011',
          position: 1,
          label: '3',
          isCorrect: false,
        },
        {
          id: '6a6b6c6d-0000-4000-8000-000000001012',
          position: 2,
          label: '4',
          isCorrect: true,
        },
      ],
    },
    {
      id: '6a6b6c6d-0000-4000-8000-000000000102',
      position: 2,
      prompt: '¿Capital de Argentina?',
      options: [
        {
          id: '6a6b6c6d-0000-4000-8000-000000001021',
          position: 1,
          label: 'Córdoba',
          isCorrect: false,
        },
        {
          id: '6a6b6c6d-0000-4000-8000-000000001022',
          position: 2,
          label: 'Buenos Aires',
          isCorrect: true,
        },
      ],
    },
  ],
};

function summaryFromPayload(
  payload: TeacherActivityPayload,
): ActivitySummaryPayload {
  return {
    id: payload.id,
    classroomId: payload.classroomId,
    type: payload.type,
    format: payload.format,
    state: payload.state,
    title: payload.title,
    description: payload.description,
    opensAt: payload.opensAt,
    dueAt: payload.dueAt,
    allowLate: payload.allowLate,
    maxScore: payload.maxScore,
    weightMultiplier: payload.weightMultiplier,
    publishedAt: payload.publishedAt,
    timeZone: payload.timeZone,
    questionCount: payload.questionCount,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

function staffDetailHandler() {
  return createClassroomDetailHandler(classroomId, {
    myRole: 'TEACHER',
    capabilities: ['publish_content'],
  });
}

function renderActivitiesPanel() {
  const queryClient = new QueryClient({
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

async function openCreateDialog(): Promise<HTMLElement> {
  renderActivitiesPanel();
  const trigger = await screen.findByRole('button', {
    name: actionsCopy.createAction,
  });
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', {
    name: editorCopy.createTitle,
  });
  return dialog;
}

async function openEditDialog(title: string): Promise<HTMLElement> {
  renderActivitiesPanel();
  await chooseRowAction(title, 'edit');
  const dialog = await screen.findByRole('dialog', {
    name: editorCopy.editTitle,
  });
  await within(dialog).findByLabelText(editorCopy.fields.title.label);
  return dialog;
}

function fillInput(
  dialog: HTMLElement,
  label: string,
  value: string,
): HTMLInputElement | HTMLTextAreaElement {
  const input = within(dialog).getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  return input as HTMLInputElement | HTMLTextAreaElement;
}

function submitCreate(dialog: HTMLElement): void {
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: editorCopy.actions.createSubmit,
    }),
  );
}

function submitEdit(dialog: HTMLElement): void {
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: editorCopy.actions.editSubmit,
    }),
  );
}

describe('ActivityEditorDialog and PublishActivityDialog (#39)', () => {
  test('create success converts school-zone datetimes into UTC instants, uses multiline description, reconciles, and offers publishing', async () => {
    let createBody: CreateActivityRequestPayload | undefined;
    let listCalls = 0;
    let created: TeacherActivityPayload | null = null;

    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        resolveResponse: () => {
          listCalls += 1;
          return HttpResponse.json(
            created === null
              ? { items: [], page: 1, pageSize: 10, total: 0 }
              : {
                  items: [summaryFromPayload(created)],
                  page: 1,
                  pageSize: 10,
                  total: 1,
                },
          );
        },
      }),
      createCreateActivityHandler({
        classroomId,
        onRequest: (_request, body) => {
          createBody = body;
        },
        resolveResponse: ({ body }) => {
          created = {
            id: '6a6b6c6d-0000-4000-8000-0000000000a9',
            classroomId,
            type: body.type,
            format: body.format,
            state: 'DRAFT',
            title: body.title,
            description: body.description ?? '',
            opensAt: body.opensAt ?? null,
            dueAt: body.dueAt,
            allowLate: body.allowLate ?? false,
            maxScore: body.maxScore,
            weightMultiplier: body.weightMultiplier ?? 1,
            publishedAt: null,
            timeZone: 'America/Argentina/Buenos_Aires',
            questionCount: body.questions?.length ?? 0,
            createdAt: '2026-11-18T12:00:00.000Z',
            updatedAt: '2026-11-18T12:00:00.000Z',
            createdById: profile.id,
            questions: (body.questions ?? []).map((question, index) => ({
              id: `00000000-0000-4000-8000-${String(3000 + index).padStart(12, '0')}`,
              position: index + 1,
              prompt: question.prompt,
              options: question.options.map((option, optionIndex) => ({
                id: `00000000-0000-4000-8000-${String(4000 + index * 10 + optionIndex).padStart(12, '0')}`,
                position: optionIndex + 1,
                label: option.label,
                isCorrect: option.isCorrect,
              })),
            })),
          };
          return HttpResponse.json(created, { status: 201 });
        },
      }),
    );

    const dialog = await openCreateDialog();

    const descInput = fillInput(
      dialog,
      editorCopy.fields.description.label,
      'Punto 1\nPunto 2',
    );
    expect(descInput.tagName).toBe('TEXTAREA');

    // School timezone (UTC-3): 20:00 local on 2026-12-01 is 23:00 UTC.
    fillInput(dialog, editorCopy.fields.title.label, '  TP Nuevo Fracciones  ');
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');
    fillInput(dialog, editorCopy.fields.maxScore.label, '0');
    submitCreate(dialog);

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: editorCopy.createTitle }),
      ).not.toBeInTheDocument();
    });

    expect(createBody).toMatchObject({
      type: 'TP',
      format: 'FILE',
      title: 'TP Nuevo Fracciones',
      description: 'Punto 1\nPunto 2',
      dueAt: '2026-12-01T23:00:00.000Z',
      allowLate: false,
      maxScore: 0,
      weightMultiplier: 1,
    });
    expect(createBody?.opensAt).toBeUndefined();
    expect(createBody?.questions).toBeUndefined();

    expect(screen.getByText(editorCopy.createdTitle)).toBeVisible();

    const publishOffer = await screen.findByRole('dialog', {
      name: editorCopy.publish.title('TP Nuevo Fracciones'),
    });
    expect(publishOffer).toHaveTextContent(editorCopy.publish.description);
    expect(publishOffer).toHaveTextContent('America/Argentina/Buenos_Aires');

    fireEvent.click(
      within(publishOffer).getByRole('button', {
        name: editorCopy.publish.cancel,
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: editorCopy.publish.title('TP Nuevo Fracciones'),
        }),
      ).not.toBeInTheDocument();
    });

    const list = await screen.findByRole('group', {
      name: activityMessages.listRegionLabel,
    });
    expect(within(list).getByText('TP Nuevo Fracciones')).toBeVisible();
    expect(
      within(list).getByText(activityMessages.stateLabels.DRAFT),
    ).toBeVisible();

    const createTrigger = screen.getByRole('button', {
      name: actionsCopy.createAction,
    });
    expect(createTrigger).toHaveFocus();
    expect(listCalls).toBeGreaterThanOrEqual(2);
  });

  test('create keeps field errors and all entered input after a server 400 validation rejection', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
      createCreateActivityHandler({
        classroomId,
        error: {
          status: 400,
          body: {
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            correlationId: 'corr-create-400',
            details: [
              {
                field: 'title',
                messages: ['title already exists in this classroom'],
              },
            ],
          },
        },
      }),
    );

    const dialog = await openCreateDialog();
    const titleInput = fillInput(
      dialog,
      editorCopy.fields.title.label,
      'TP Duplicado',
    );
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');
    fillInput(dialog, editorCopy.fields.maxScore.label, '10');
    submitCreate(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('title already exists in this classroom');

    expect(titleInput).toHaveValue('TP Duplicado');
    expect(
      within(dialog).getByLabelText(editorCopy.fields.dueAt.label),
    ).toHaveValue('2026-12-01T20:00');
    expect(dialog).toBeVisible();
  });

  test('create uncertain failure (5xx and malformed 201) keeps input, shows uncertain message, and reconciles list', async () => {
    let listCalls = 0;
    let createCalls = 0;
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        resolveResponse: () => {
          listCalls += 1;
          return HttpResponse.json({
            items: [],
            page: 1,
            pageSize: 10,
            total: 0,
          });
        },
      }),
      createCreateActivityHandler({
        classroomId,
        resolveResponse: () => {
          createCalls += 1;
          if (createCalls === 1) {
            // Malformed 201 must still be recognized as an uncertain write and reconcile.
            return HttpResponse.json({ broken: true }, { status: 201 });
          }
          return HttpResponse.json(
            {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'DB write failed; must never leak',
                correlationId: 'corr-create-500',
              },
            },
            { status: 500 },
          );
        },
      }),
    );

    const dialog = await openCreateDialog();
    const titleInput = fillInput(
      dialog,
      editorCopy.fields.title.label,
      'TP Incierto',
    );
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');
    fillInput(dialog, editorCopy.fields.maxScore.label, '10');

    // First submit: malformed 201 response.
    submitCreate(dialog);
    const alert1 = await within(dialog).findByRole('alert');
    expect(alert1).toHaveTextContent(writeCopy.uncertain);
    expect(titleInput).toHaveValue('TP Incierto');
    await waitFor(() => {
      expect(listCalls).toBeGreaterThanOrEqual(2);
    });

    // Second submit: 500 failure.
    const callsBefore500 = listCalls;
    submitCreate(dialog);
    const alert2 = await within(dialog).findByRole('alert');
    expect(alert2).toHaveTextContent(writeCopy.uncertain);
    expect(alert2).not.toHaveTextContent('DB write failed');
    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(callsBefore500);
    });
    expect(dialog).toBeVisible();
  });

  test('required fields and contract numeric boundaries surface validation messages', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
      createCreateActivityHandler({ classroomId }),
    );

    const dialog = await openCreateDialog();

    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.titleRequired),
    ).toBeVisible();
    expect(
      within(dialog).getByText(editorCopy.validation.dueAtRequired),
    ).toBeVisible();
    expect(
      within(dialog).getByText(editorCopy.validation.maxScoreRequired),
    ).toBeVisible();

    fillInput(dialog, editorCopy.fields.title.label, 'TP Límites');
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');

    // Decimal maxScore is rejected (must be integer 0..100).
    fillInput(dialog, editorCopy.fields.maxScore.label, '10.5');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.maxScoreRange),
    ).toBeVisible();

    // Out-of-range maxScore (> 100) is rejected.
    fillInput(dialog, editorCopy.fields.maxScore.label, '101');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.maxScoreRange),
    ).toBeVisible();

    fillInput(dialog, editorCopy.fields.maxScore.label, '10');
    fillInput(dialog, editorCopy.fields.weightMultiplier.label, '0.4');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.weightMultiplierRange),
    ).toBeVisible();

    fillInput(dialog, editorCopy.fields.weightMultiplier.label, '1.234');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.weightMultiplierDecimals),
    ).toBeVisible();

    fillInput(dialog, editorCopy.fields.weightMultiplier.label, '');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(
        editorCopy.validation.weightMultiplierRequired,
      ),
    ).toBeVisible();

    fillInput(dialog, editorCopy.fields.weightMultiplier.label, '1.5');
    fillInput(dialog, editorCopy.fields.dueAt.label, 'fecha-invalida');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(editorCopy.validation.dueAtRequired),
    ).toBeVisible();
  });

  test('exam window boundaries: opensAt must strictly precede dueAt, is TP-forbidden, and switching EXAM -> TP with DST-gap opensAt never crashes', async () => {
    const dstExamSummary: ActivitySummaryPayload = {
      ...draftExamSummary,
      id: '6a6b6c6d-0000-4000-8000-0000000000a8',
      opensAt: null,
      dueAt: '2026-03-09T16:00:00.000Z',
      timeZone: 'America/New_York',
    };
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [dstExamSummary],
      }),
      createCreateActivityHandler({ classroomId }),
    );

    const dialog = await openCreateDialog();
    fillInput(dialog, editorCopy.fields.title.label, 'Examen Ventanas');
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');
    fillInput(dialog, editorCopy.fields.maxScore.label, '10');

    // EXAM with opensAt equal to dueAt is rejected (strictly before).
    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.type.options.EXAM.label,
      }),
    );
    fillInput(dialog, editorCopy.fields.opensAt.label, '2026-12-01T20:00');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.opensAtBeforeDueAt),
    ).toBeVisible();

    // Switching to TP keeps the entered window without crashing render.
    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.type.options.TP.label,
      }),
    );
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.opensAtOnlyForExams),
    ).toBeVisible();
    expect(
      within(dialog).getByText(editorCopy.fields.opensAt.tpHint),
    ).toBeVisible();

    // Switch back to EXAM, force an invalid/nonexistent value, and switch to TP:
    // rendering lingeringOpensAt must safely fall back without throwing.
    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.type.options.EXAM.label,
      }),
    );
    fillInput(dialog, editorCopy.fields.opensAt.label, '2026-02-30T10:00');
    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.type.options.TP.label,
      }),
    );
    expect(
      within(dialog).getByText(editorCopy.fields.opensAt.tpHint),
    ).toBeVisible();

    // Drop the lingering window cleanly if present.
    const removeButton = within(dialog).queryByRole('button', {
      name: editorCopy.fields.opensAt.removeAction,
    });
    if (removeButton !== null) {
      fireEvent.click(removeButton);
    }
  });

  test('multiple-choice builder boundaries: questions required, 2..6 options, and exactly one option correct', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
      createCreateActivityHandler({ classroomId }),
    );

    const dialog = await openCreateDialog();
    fillInput(dialog, editorCopy.fields.title.label, 'Examen Opción Múltiple');
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');
    fillInput(dialog, editorCopy.fields.maxScore.label, '10');
    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.format.options.MULTIPLE_CHOICE.label,
      }),
    );

    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.questionsRequired),
    ).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole('button', { name: questionsCopy.addQuestion }),
    );
    const question = within(dialog).getByRole('group', {
      name: questionsCopy.questionLegend(1),
    });
    submitCreate(dialog);
    expect(
      await within(question).findByText(validationCopy.exactlyOneCorrectOption),
    ).toBeVisible();
    expect(
      within(dialog).getAllByText(validationCopy.questionPromptRequired).length,
    ).toBeGreaterThan(0);
    expect(
      within(dialog).getAllByText(validationCopy.optionLabelRequired).length,
    ).toBe(2);

    fillInput(question, questionsCopy.prompt.label, '¿Cuánto es 2 + 2?');
    fillInput(question, questionsCopy.optionLabel(1), '3');
    fillInput(question, questionsCopy.optionLabel(2), '4');

    submitCreate(dialog);
    expect(
      await within(question).findByText(validationCopy.exactlyOneCorrectOption),
    ).toBeVisible();

    fireEvent.click(
      within(question).getByRole('radio', {
        name: questionsCopy.markCorrect(2),
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByText(validationCopy.exactlyOneCorrectOption),
      ).not.toBeInTheDocument();
    });
    expect(
      within(question).getByRole('radio', {
        name: questionsCopy.markCorrect(2),
      }),
    ).toBeChecked();
    expect(
      within(question).getByRole('radio', {
        name: questionsCopy.markCorrect(1),
      }),
    ).not.toBeChecked();

    await expectAccessible(document.body);
  });

  test('builder interactions: add/remove/reorder questions and options and mark the correct option', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
    );

    const dialog = await openCreateDialog();
    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.format.options.MULTIPLE_CHOICE.label,
      }),
    );

    fireEvent.click(
      within(dialog).getByRole('button', { name: questionsCopy.addQuestion }),
    );
    const firstQuestion = within(dialog).getByRole('group', {
      name: questionsCopy.questionLegend(1),
    });
    fillInput(firstQuestion, questionsCopy.prompt.label, 'Pregunta uno');
    fillInput(firstQuestion, questionsCopy.optionLabel(1), 'a');
    fillInput(firstQuestion, questionsCopy.optionLabel(2), 'b');
    fireEvent.click(
      within(firstQuestion).getByRole('radio', {
        name: questionsCopy.markCorrect(2),
      }),
    );

    fireEvent.click(
      within(dialog).getByRole('button', { name: questionsCopy.addQuestion }),
    );
    const secondQuestion = within(dialog).getByRole('group', {
      name: questionsCopy.questionLegend(2),
    });
    fillInput(secondQuestion, questionsCopy.prompt.label, 'Pregunta dos');
    fillInput(secondQuestion, questionsCopy.optionLabel(1), 'c');
    fillInput(secondQuestion, questionsCopy.optionLabel(2), 'd');
    fireEvent.click(
      within(secondQuestion).getByRole('radio', {
        name: questionsCopy.markCorrect(1),
      }),
    );

    expect(
      within(firstQuestion).getByRole('button', {
        name: questionsCopy.moveQuestionUp(1),
      }),
    ).toBeDisabled();
    expect(
      within(secondQuestion).getByRole('button', {
        name: questionsCopy.moveQuestionDown(2),
      }),
    ).toBeDisabled();

    fireEvent.click(
      within(secondQuestion).getByRole('button', {
        name: questionsCopy.moveQuestionUp(2),
      }),
    );
    const prompts = within(dialog)
      .getAllByLabelText(questionsCopy.prompt.label)
      .map((input) => (input as HTMLInputElement).value);
    expect(prompts).toEqual(['Pregunta dos', 'Pregunta uno']);

    const movedFirst = within(dialog).getByRole('group', {
      name: questionsCopy.questionLegend(1),
    });
    fireEvent.click(
      within(movedFirst).getByRole('button', {
        name: questionsCopy.moveOptionUp(2),
      }),
    );
    expect(
      within(movedFirst).getByLabelText(questionsCopy.optionLabel(1)),
    ).toHaveValue('d');
    expect(
      within(movedFirst).getByLabelText(questionsCopy.optionLabel(2)),
    ).toHaveValue('c');

    fireEvent.click(
      within(movedFirst).getByRole('button', {
        name: questionsCopy.removeOption(1),
      }),
    );
    expect(
      within(movedFirst).queryByLabelText(questionsCopy.optionLabel(2)),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(movedFirst).getByRole('button', {
        name: questionsCopy.removeQuestion(1),
      }),
    );
    const remainingPrompts = within(dialog)
      .getAllByLabelText(questionsCopy.prompt.label)
      .map((input) => (input as HTMLInputElement).value);
    expect(remainingPrompts).toEqual(['Pregunta uno']);
  });

  test('FILE format with lingering questions is refused until the questions are removed', async () => {
    let createBody: CreateActivityRequestPayload | undefined;
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
      createCreateActivityHandler({
        classroomId,
        onRequest: (_request, body) => {
          createBody = body;
        },
        resolveResponse: ({ body }) =>
          HttpResponse.json(
            {
              id: '6a6b6c6d-0000-4000-8000-0000000000a9',
              classroomId,
              type: body.type,
              format: body.format,
              state: 'DRAFT',
              title: body.title,
              description: body.description ?? '',
              opensAt: body.opensAt ?? null,
              dueAt: body.dueAt,
              allowLate: body.allowLate ?? false,
              maxScore: body.maxScore,
              weightMultiplier: body.weightMultiplier ?? 1,
              publishedAt: null,
              timeZone: 'America/Argentina/Buenos_Aires',
              questionCount: body.questions?.length ?? 0,
              createdAt: '2026-11-18T12:00:00.000Z',
              updatedAt: '2026-11-18T12:00:00.000Z',
              createdById: profile.id,
              questions: [],
            } satisfies TeacherActivityPayload,
            { status: 201 },
          ),
      }),
    );

    const dialog = await openCreateDialog();
    fillInput(dialog, editorCopy.fields.title.label, 'TP Con Preguntas');
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');
    fillInput(dialog, editorCopy.fields.maxScore.label, '10');

    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.format.options.MULTIPLE_CHOICE.label,
      }),
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: questionsCopy.addQuestion }),
    );
    const question = within(dialog).getByRole('group', {
      name: questionsCopy.questionLegend(1),
    });
    fillInput(question, questionsCopy.prompt.label, '¿Cuánto es 2 + 2?');
    fillInput(question, questionsCopy.optionLabel(1), '3');
    fillInput(question, questionsCopy.optionLabel(2), '4');
    fireEvent.click(
      within(question).getByRole('radio', {
        name: questionsCopy.markCorrect(2),
      }),
    );

    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.format.options.FILE.label,
      }),
    );

    expect(
      within(dialog).getByText(questionsCopy.fileFormatHint),
    ).toBeVisible();
    expect(
      within(dialog).getByText(questionsCopy.fileFormatStored(1)),
    ).toBeVisible();
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.questionsForbiddenForFile),
    ).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: questionsCopy.removeQuestionsAction,
      }),
    );
    submitCreate(dialog);
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: editorCopy.createTitle }),
      ).not.toBeInTheDocument();
    });
    expect(createBody?.questions).toBeUndefined();
    expect(createBody?.format).toBe('FILE');
  });

  test('edit draft loads the teacher view with school-zone datetimes and immutable type/format', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftExamSummary],
      }),
      createActivityDetailHandler({
        classroomId,
        activityId: draftExamSummary.id,
        activity: draftExamDetail,
      }),
    );

    const dialog = await openEditDialog(draftExamSummary.title);

    expect(
      within(dialog).getByLabelText(editorCopy.fields.dueAt.label),
    ).toHaveValue('2026-11-30T20:00');
    expect(
      within(dialog).getByLabelText(editorCopy.fields.opensAt.label),
    ).toHaveValue('2026-11-25T10:00');
    expect(
      (
        within(dialog).getByLabelText(
          editorCopy.fields.weightMultiplier.label,
        ) as HTMLInputElement
      ).value,
    ).toBe('1.5');

    expect(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.type.options.TP.label,
      }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('radio', {
        name: editorCopy.fields.format.options.FILE.label,
      }),
    ).toBeDisabled();
    expect(
      within(dialog).getByText(editorCopy.fields.format.immutableNotice),
    ).toBeVisible();

    const prompts = within(dialog)
      .getAllByLabelText(questionsCopy.prompt.label)
      .map((input) => (input as HTMLInputElement).value);
    expect(prompts).toEqual(['¿Cuánto es 2 + 2?', '¿Capital de Argentina?']);
    const firstQuestion = within(dialog).getByRole('group', {
      name: questionsCopy.questionLegend(1),
    });
    expect(
      within(firstQuestion).getByRole('radio', {
        name: questionsCopy.markCorrect(2),
      }),
    ).toBeChecked();

    await expectAccessible(document.body);
  });

  test('edit omits questions on PATCH when only metadata changed and sends questions when modified', async () => {
    const patchBodies: UpdateActivityRequestPayload[] = [];
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftExamSummary],
      }),
      createActivityDetailHandler({
        classroomId,
        activityId: draftExamSummary.id,
        activity: draftExamDetail,
      }),
      createUpdateActivityHandler({
        classroomId,
        activityId: draftExamSummary.id,
        onRequest: (_request, body) => {
          patchBodies.push(body);
        },
        resolveResponse: ({ body }) =>
          HttpResponse.json({
            ...draftExamDetail,
            title: body.title ?? draftExamDetail.title,
            updatedAt: '2026-11-18T14:00:00.000Z',
          } satisfies TeacherActivityPayload),
      }),
    );

    // 1. Metadata-only edit: questions must be omitted so submitted exams do not hit 409.
    const dialog1 = await openEditDialog(draftExamSummary.title);
    fillInput(dialog1, editorCopy.fields.title.label, 'Examen Parcial v2');
    submitEdit(dialog1);

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: editorCopy.editTitle }),
      ).not.toBeInTheDocument();
    });

    expect(patchBodies[0]).toMatchObject({
      title: 'Examen Parcial v2',
      dueAt: '2026-11-30T23:00:00.000Z',
      opensAt: '2026-11-25T13:00:00.000Z',
      allowLate: true,
      maxScore: 10,
      weightMultiplier: 1.5,
    });
    expect(patchBodies[0]?.questions).toBeUndefined();

    const publishOffer = await screen.findByRole('dialog', {
      name: editorCopy.publish.title('Examen Parcial v2'),
    });
    fireEvent.click(
      within(publishOffer).getByRole('button', {
        name: editorCopy.publish.cancel,
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: editorCopy.publish.title('Examen Parcial v2'),
        }),
      ).not.toBeInTheDocument();
    });

    // 2. Question edit: questions must be included in the PATCH payload.
    await chooseRowAction(draftExamSummary.title, 'edit');
    const dialog2 = await screen.findByRole('dialog', {
      name: editorCopy.editTitle,
    });
    await within(dialog2).findByLabelText(editorCopy.fields.title.label);
    const firstQuestion = within(dialog2).getByRole('group', {
      name: questionsCopy.questionLegend(1),
    });
    fillInput(firstQuestion, questionsCopy.prompt.label, '¿Cuánto es 3 + 3?');
    submitEdit(dialog2);

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: editorCopy.editTitle }),
      ).not.toBeInTheDocument();
    });

    expect(patchBodies[1]?.questions?.[0]).toMatchObject({
      prompt: '¿Cuánto es 3 + 3?',
    });
    expect(patchBodies[1]?.questions?.[0]?.options[1]).toMatchObject({
      label: '4',
      isCorrect: true,
    });
  });

  test('edit load failure shows retry button and reconciles list on 404', async () => {
    let listCalls = 0;
    let detailCalls = 0;
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        resolveResponse: () => {
          listCalls += 1;
          return HttpResponse.json({
            items: [draftExamSummary],
            page: 1,
            pageSize: 10,
            total: 1,
          });
        },
      }),
      createActivityDetailHandler({
        classroomId,
        activityId: draftExamSummary.id,
        resolveResponse: () => {
          detailCalls += 1;
          if (detailCalls === 1) {
            return HttpResponse.json(
              {
                error: {
                  code: 'NOT_FOUND',
                  message: 'Activity deleted concurrently',
                  correlationId: 'corr-edit-load-404',
                },
              },
              { status: 404 },
            );
          }
          return HttpResponse.json(draftExamDetail);
        },
      }),
    );

    renderActivitiesPanel();
    await chooseRowAction(draftExamSummary.title, 'edit');

    const dialog = await screen.findByRole('dialog', {
      name: editorCopy.editTitle,
    });
    expect(
      await within(dialog).findByText(editorCopy.detailErrorTitle),
    ).toBeVisible();
    await waitFor(() => {
      expect(listCalls).toBeGreaterThanOrEqual(2);
    });
    expect(detailCalls).toBe(1);

    fireEvent.click(
      within(dialog).getByRole('button', { name: activityMessages.retryLabel }),
    );
    expect(
      await within(dialog).findByLabelText(editorCopy.fields.title.label),
    ).toHaveValue(draftExamDetail.title);
    expect(detailCalls).toBe(2);
  });

  test('edit 409 on questions after submissions explains the lock and keeps input', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftExamSummary],
      }),
      createActivityDetailHandler({
        classroomId,
        activityId: draftExamSummary.id,
        activity: draftExamDetail,
      }),
      createUpdateActivityHandler({
        classroomId,
        activityId: draftExamSummary.id,
        error: {
          status: 409,
          body: {
            code: 'CONFLICT',
            message: 'Questions cannot change after a submission exists',
            correlationId: 'corr-update-409',
          },
        },
      }),
    );

    const dialog = await openEditDialog(draftExamSummary.title);
    const firstQuestion = within(dialog).getByRole('group', {
      name: questionsCopy.questionLegend(1),
    });
    const promptInput = fillInput(
      firstQuestion,
      questionsCopy.prompt.label,
      '¿Nueva pregunta bloqueada?',
    );
    submitEdit(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(writeCopy.updateQuestionsLocked);
    expect(alert).not.toHaveTextContent('after a submission exists');
    expect(promptInput).toHaveValue('¿Nueva pregunta bloqueada?');
    expect(dialog).toBeVisible();
  });

  test('edit blocks removing a defined exam window (null is rejected by the contract)', async () => {
    let patchCalls = 0;
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftExamSummary],
      }),
      createActivityDetailHandler({
        classroomId,
        activityId: draftExamSummary.id,
        activity: draftExamDetail,
      }),
      createUpdateActivityHandler({
        classroomId,
        activityId: draftExamSummary.id,
        onRequest: () => {
          patchCalls += 1;
        },
      }),
    );

    const dialog = await openEditDialog(draftExamSummary.title);
    fillInput(dialog, editorCopy.fields.opensAt.label, '');
    submitEdit(dialog);

    expect(
      await within(dialog).findByText(
        editorCopy.validation.opensAtCannotBeRemoved,
      ),
    ).toBeVisible();
    expect(patchCalls).toBe(0);
    expect(dialog).toBeVisible();
  });

  test('publish success confirms and reconciles the list to PUBLISHED', async () => {
    let publishCalls = 0;
    let listCalls = 0;
    let published = false;

    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        resolveResponse: () => {
          listCalls += 1;
          return HttpResponse.json(
            published
              ? { items: [publishedFileTp], page: 1, pageSize: 10, total: 1 }
              : { items: [draftFileTp], page: 1, pageSize: 10, total: 1 },
          );
        },
      }),
      createPublishActivityHandler({
        classroomId,
        activityId: draftFileTp.id,
        onRequest: () => {
          publishCalls += 1;
        },
        resolveResponse: () => {
          published = true;
          return HttpResponse.json({
            ...draftFileTp,
            questions: [],
            createdById: profile.id,
            state: 'PUBLISHED' as const,
            publishedAt: '2026-11-18T13:00:00.000Z',
            updatedAt: '2026-11-18T13:00:00.000Z',
          } satisfies TeacherActivityPayload);
        },
      }),
    );

    renderActivitiesPanel();
    await chooseRowAction(draftFileTp.title, 'publish');

    const confirmDialog = await screen.findByRole('dialog', {
      name: editorCopy.publish.title(draftFileTp.title),
    });
    expect(confirmDialog).toHaveTextContent(editorCopy.publish.description);
    expect(confirmDialog).toHaveTextContent('America/Argentina/Buenos_Aires');

    fireEvent.click(
      within(confirmDialog).getByRole('button', {
        name: editorCopy.publish.submit,
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: editorCopy.publish.title(draftFileTp.title),
        }),
      ).not.toBeInTheDocument();
    });
    expect(publishCalls).toBe(1);
    await waitFor(() => {
      expect(screen.getByText(editorCopy.publishedTitle)).toBeVisible();
    });
    await waitFor(() => {
      expect(
        screen.getByText(editorCopy.publishedDescription(draftFileTp.title)),
      ).toBeVisible();
    });
    const list = screen.getByRole('group', {
      name: activityMessages.listRegionLabel,
    });
    expect(
      await within(list).findByText(activityMessages.stateLabels.PUBLISHED),
    ).toBeVisible();
    expect(listCalls).toBeGreaterThanOrEqual(2);
    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', {
            level: 3,
            name: activityMessages.heading,
          }),
        ).toHaveFocus();
      },
      { timeout: 5000 },
    );
  });

  test('publish 400 VALIDATION_FAILED surfaces publishNotPublishable and keeps the confirmation open', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        items: [draftFileTp],
      }),
      createPublishActivityHandler({
        classroomId,
        activityId: draftFileTp.id,
        error: {
          status: 400,
          body: {
            code: 'VALIDATION_FAILED',
            message: 'dueAt is in the past',
            correlationId: 'corr-publish-400',
            details: [
              { field: 'dueAt', messages: ['dueAt must be in the future'] },
            ],
          },
        },
      }),
    );

    renderActivitiesPanel();
    await chooseRowAction(draftFileTp.title, 'publish');
    const confirmDialog = await screen.findByRole('dialog', {
      name: editorCopy.publish.title(draftFileTp.title),
    });
    fireEvent.click(
      within(confirmDialog).getByRole('button', {
        name: editorCopy.publish.submit,
      }),
    );

    const alert = await within(confirmDialog).findByRole('alert');
    expect(alert).toHaveTextContent(writeCopy.publishNotPublishable);
    expect(alert).not.toHaveTextContent('dueAt is in the past');
    expect(confirmDialog).toBeVisible();
  });

  test('publish 409, 404, and 403 surface translated errors, keep confirmation open, and reconcile list', async () => {
    let listCalls = 0;
    let publishAttempt = 0;
    mswServer.use(
      staffDetailHandler(),
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
      createPublishActivityHandler({
        classroomId,
        activityId: draftFileTp.id,
        resolveResponse: () => {
          publishAttempt += 1;
          if (publishAttempt === 1) {
            return HttpResponse.json(
              {
                error: {
                  code: 'CONFLICT',
                  message: 'Activity is already published',
                  correlationId: 'corr-publish-409',
                },
              },
              { status: 409 },
            );
          }
          if (publishAttempt === 2) {
            return HttpResponse.json(
              {
                error: {
                  code: 'NOT_FOUND',
                  message: 'Activity missing',
                  correlationId: 'corr-publish-404',
                },
              },
              { status: 404 },
            );
          }
          return HttpResponse.json(
            {
              error: {
                code: 'FORBIDDEN',
                message: 'Role revoked',
                correlationId: 'corr-publish-403',
              },
            },
            { status: 403 },
          );
        },
      }),
    );

    renderActivitiesPanel();
    await chooseRowAction(draftFileTp.title, 'publish');
    const confirmDialog = await screen.findByRole('dialog', {
      name: editorCopy.publish.title(draftFileTp.title),
    });

    // 409 Conflict -> translated message + list reconciliation
    const before409 = listCalls;
    fireEvent.click(
      within(confirmDialog).getByRole('button', {
        name: editorCopy.publish.submit,
      }),
    );
    const alert409 = await within(confirmDialog).findByRole('alert');
    expect(alert409).toHaveTextContent(writeCopy.publishAlreadyPublished);
    expect(alert409).not.toHaveTextContent('Activity is already published');
    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(before409);
    });

    // 404 Not Found -> translated message + list reconciliation
    const before404 = listCalls;
    fireEvent.click(
      within(confirmDialog).getByRole('button', {
        name: editorCopy.publish.submit,
      }),
    );
    await waitFor(() => {
      expect(within(confirmDialog).getByRole('alert')).toHaveTextContent(
        writeCopy.notFound,
      );
    });
    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(before404);
    });

    // 403 Forbidden -> translated message + list reconciliation
    const before403 = listCalls;
    fireEvent.click(
      within(confirmDialog).getByRole('button', {
        name: editorCopy.publish.submit,
      }),
    );
    await waitFor(() => {
      expect(within(confirmDialog).getByRole('alert')).toHaveTextContent(
        writeCopy.forbidden,
      );
    });
    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(before403);
    });
    expect(confirmDialog).toBeVisible();
  });

  test('dialog traps focus, guards unsaved changes, and returns focus to the opener', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
    );

    const dialog = await openCreateDialog();

    expect(dialog.contains(document.activeElement)).toBe(true);

    for (let index = 0; index < 8; index += 1) {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Tab',
      });
      expect(
        screen
          .getByRole('dialog', { name: editorCopy.createTitle })
          .contains(document.activeElement),
      ).toBe(true);
    }

    fillInput(dialog, editorCopy.fields.title.label, 'TP Sin Guardar');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      screen.getByRole('dialog', { name: editorCopy.createTitle }),
    ).toBeVisible();
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: editorCopy.createTitle }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: actionsCopy.createAction }),
    ).toHaveFocus();
  });
});
