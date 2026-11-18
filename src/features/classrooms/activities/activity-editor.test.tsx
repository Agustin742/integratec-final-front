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
import { classroomMessages } from '../messages';
import { ClassroomActivitiesPanel } from './classroom-activities-panel';

// Multi-step dialog flows (several submits, MSW round trips, a11y scans)
// exceed the 5s default in this file.
vi.setConfig({ testTimeout: 20_000 });

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
const editorCopy = classroomMessages.activities.editor;
const questionsCopy = editorCopy.questions;
const validationCopy = classroomMessages.activities.validation;
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
      id: '6a6b6c6d-0000-4000-8000-0000000000q1',
      position: 0,
      prompt: '¿Cuánto es 2 + 2?',
      options: [
        {
          id: '6a6b6c6d-0000-4000-8000-00000000o11',
          position: 0,
          label: '3',
          isCorrect: false,
        },
        {
          id: '6a6b6c6d-0000-4000-8000-00000000o12',
          position: 1,
          label: '4',
          isCorrect: true,
        },
      ],
    },
    {
      id: '6a6b6c6d-0000-4000-8000-0000000000q2',
      position: 1,
      prompt: '¿Capital de Argentina?',
      options: [
        {
          id: '6a6b6c6d-0000-4000-8000-00000000o21',
          position: 0,
          label: 'Córdoba',
          isCorrect: false,
        },
        {
          id: '6a6b6c6d-0000-4000-8000-00000000o22',
          position: 1,
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
    <SessionProvider service={session.service}>
      <Toast />
      <ClassroomActivitiesPanel classroomId={classroomId} />
    </SessionProvider>,
    { queryClient },
  );
  return { queryClient, session, ...view };
}

async function openCreateDialog(): Promise<HTMLElement> {
  renderActivitiesPanel();
  const trigger = await screen.findByRole('button', {
    name: copy.createAction,
  });
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', {
    name: editorCopy.createTitle,
  });
  return dialog;
}

async function openEditDialog(title: string): Promise<HTMLElement> {
  renderActivitiesPanel();
  const trigger = await screen.findByRole('button', {
    name: copy.editAriaLabel(title),
  });
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', {
    name: editorCopy.editTitle,
  });
  // Wait for the teacher detail to load before interacting with the form.
  await within(dialog).findByLabelText(editorCopy.fields.title.label);
  return dialog;
}

function fillInput(
  dialog: HTMLElement,
  label: string,
  value: string,
): HTMLInputElement {
  const input = within(dialog).getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  return input as HTMLInputElement;
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

describe('ActivityEditorDialog (#39 T3)', () => {
  test('create success converts school-zone datetimes into UTC instants, reconciles the list, and offers publishing', async () => {
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
              ? { items: [], page: 1, pageSize: 20, total: 0 }
              : {
                  items: [summaryFromPayload(created)],
                  page: 1,
                  pageSize: 20,
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
              id: `question-${index}`,
              position: index,
              prompt: question.prompt,
              options: question.options.map((option, optionIndex) => ({
                id: `option-${index}-${optionIndex}`,
                position: optionIndex,
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

    // School timezone (UTC-3): 20:00 local on 2026-12-01 is 23:00 UTC.
    fillInput(dialog, editorCopy.fields.title.label, '  TP Nuevo Fracciones  ');
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');
    fillInput(dialog, editorCopy.fields.maxScore.label, '10');
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
      dueAt: '2026-12-01T23:00:00.000Z',
      allowLate: false,
      maxScore: 10,
      weightMultiplier: 1,
    });
    expect(createBody?.opensAt).toBeUndefined();
    expect(createBody?.questions).toBeUndefined();

    // Confirmed draft appears in the reconciled list.
    expect(await screen.findByText('TP Nuevo Fracciones')).toBeVisible();
    expect(screen.getByText(copy.states.DRAFT)).toBeVisible();
    expect(screen.getByText(editorCopy.createdTitle)).toBeVisible();

    // Publishing the fresh draft is offered with the one-way confirmation.
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
    // Closing the offer returns focus to the opener.
    const createTrigger = screen.getByRole('button', {
      name: copy.createAction,
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

    // Safe editable input is preserved after the rejection.
    expect(titleInput).toHaveValue('TP Duplicado');
    expect(
      within(dialog).getByLabelText(editorCopy.fields.dueAt.label),
    ).toHaveValue('2026-12-01T20:00');
    expect(dialog).toBeVisible();
  });

  test('create uncertain failure (5xx) keeps input, shows the uncertain message, and reconciles the list', async () => {
    let listCalls = 0;
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({
        classroomId,
        resolveResponse: () => {
          listCalls += 1;
          return HttpResponse.json({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          });
        },
      }),
      createCreateActivityHandler({
        classroomId,
        error: {
          status: 500,
          body: {
            code: 'INTERNAL_ERROR',
            message: 'DB write failed; must never leak',
            correlationId: 'corr-create-500',
          },
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
    submitCreate(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(writeCopy.uncertain);
    expect(alert).not.toHaveTextContent('DB write failed');
    expect(titleInput).toHaveValue('TP Incierto');

    await waitFor(() => {
      expect(listCalls).toBeGreaterThanOrEqual(2);
    });
    expect(dialog).toBeVisible();
  });

  test('required fields and numeric boundaries surface the contract messages', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
      createCreateActivityHandler({ classroomId }),
    );

    const dialog = await openCreateDialog();

    // Blank submit: title, dueAt and maxScore are required.
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

    // Fill everything valid, then break one numeric bound at a time.
    fillInput(dialog, editorCopy.fields.title.label, 'TP Límites');
    fillInput(dialog, editorCopy.fields.dueAt.label, '2026-12-01T20:00');
    fillInput(dialog, editorCopy.fields.maxScore.label, '10');

    fillInput(dialog, editorCopy.fields.maxScore.label, '0');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.maxScorePositive),
    ).toBeVisible();

    fillInput(dialog, editorCopy.fields.maxScore.label, '10');
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
    // The browser sanitizes garbage entered into a datetime-local input to an
    // empty value; the cleared deadline surfaces the required message instead
    // of a silently shifted date.
    fillInput(dialog, editorCopy.fields.dueAt.label, 'fecha-invalida');
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(editorCopy.validation.dueAtRequired),
    ).toBeVisible();
  });

  test('exam window boundaries: opensAt must strictly precede dueAt and is TP-forbidden', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
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

    // Switching to TP keeps the entered window; the refusal is visible next
    // to the TP hint instead of a silently dropped value.
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

    // The teacher can drop the lingering window explicitly.
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: editorCopy.fields.opensAt.removeAction,
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByText(validationCopy.opensAtOnlyForExams),
      ).not.toBeInTheDocument();
    });
  });

  test('multiple-choice builder boundaries: questions are required and exactly one option is correct', async () => {
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

    // MULTIPLE_CHOICE without questions is rejected.
    submitCreate(dialog);
    expect(
      await within(dialog).findByText(validationCopy.questionsRequired),
    ).toBeVisible();

    // A blank question: prompt and option labels are required, and zero
    // correct options violate the exactly-one-correct rule.
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

    // Zero correct options after filling labels.
    submitCreate(dialog);
    expect(
      await within(question).findByText(validationCopy.exactlyOneCorrectOption),
    ).toBeVisible();

    // The radio semantics keep a single selection: marking one option correct
    // satisfies the rule and unmarks every other option automatically, so a
    // multiple-correct state cannot be produced from the UI (covered at
    // schema level instead).
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
    expect(
      within(firstQuestion).getByRole('radio', {
        name: questionsCopy.markCorrect(2),
      }),
    ).toBeChecked();
    expect(
      within(firstQuestion).getByRole('radio', {
        name: questionsCopy.markCorrect(1),
      }),
    ).not.toBeChecked();

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

    // First question cannot move up; last cannot move down.
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

    // Reorder questions with the accessible buttons.
    fireEvent.click(
      within(secondQuestion).getByRole('button', {
        name: questionsCopy.moveQuestionUp(2),
      }),
    );
    const prompts = within(dialog)
      .getAllByLabelText(questionsCopy.prompt.label)
      .map((input) => (input as HTMLInputElement).value);
    expect(prompts).toEqual(['Pregunta dos', 'Pregunta uno']);

    // Reorder and remove options; the correct marking follows the row.
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
    expect(
      within(dialog).queryByRole('group', {
        name: questionsCopy.questionLegend(2),
      }),
    ).not.toBeInTheDocument();
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

    // Build a valid MCQ question, then switch the format to FILE.
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

    // The questions stay visible next to the FILE hint; the payload schema
    // refuses questions for FILE activities.
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

    // Removing the questions lets the FILE draft through, without questions.
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

    // UTC instants are displayed as school-zone datetime-local values.
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

    // Type and format are immutable after creation and disabled with an
    // explanation.
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

    // The builder shows the server-confirmed questions with correct answers
    // (teacher view only).
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

  test('edit draft success sends the converted payload and offers publishing', async () => {
    let patchBody: UpdateActivityRequestPayload | undefined;
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
          patchBody = body;
        },
        resolveResponse: ({ body }) =>
          HttpResponse.json({
            ...draftExamDetail,
            title: body.title ?? draftExamDetail.title,
            updatedAt: '2026-11-18T14:00:00.000Z',
          } satisfies TeacherActivityPayload),
      }),
    );

    const dialog = await openEditDialog(draftExamSummary.title);
    fillInput(dialog, editorCopy.fields.title.label, 'Examen Parcial v2');
    submitEdit(dialog);

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: editorCopy.editTitle }),
      ).not.toBeInTheDocument();
    });

    // School-zone values are converted back into UTC instants, and the
    // questions are replaced as a full set.
    expect(patchBody).toMatchObject({
      title: 'Examen Parcial v2',
      dueAt: '2026-11-30T23:00:00.000Z',
      opensAt: '2026-11-25T13:00:00.000Z',
      allowLate: true,
      maxScore: 10,
      weightMultiplier: 1.5,
    });
    expect(patchBody?.questions?.[0]).toMatchObject({
      prompt: '¿Cuánto es 2 + 2?',
    });
    expect(patchBody?.questions?.[0]?.options[1]).toMatchObject({
      label: '4',
      isCorrect: true,
    });
    expect(patchBody?.questions?.[1]?.options[1]?.isCorrect).toBe(true);

    await waitFor(() => {
      expect(screen.getByText(editorCopy.updatedTitle)).toBeVisible();
    });

    // The updated draft is offered for publishing.
    const publishOffer = await screen.findByRole('dialog', {
      name: editorCopy.publish.title('Examen Parcial v2'),
    });
    fireEvent.click(
      within(publishOffer).getByRole('button', {
        name: editorCopy.publish.cancel,
      }),
    );
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
    const titleInput = fillInput(
      dialog,
      editorCopy.fields.title.label,
      'Examen Bloqueado',
    );
    submitEdit(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(writeCopy.updateQuestionsLocked);
    expect(alert).not.toHaveTextContent('after a submission exists');
    expect(titleInput).toHaveValue('Examen Bloqueado');
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
              ? { items: [publishedFileTp], page: 1, pageSize: 20, total: 1 }
              : { items: [draftFileTp], page: 1, pageSize: 20, total: 1 },
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
    fireEvent.click(
      await screen.findByRole('button', {
        name: copy.publishAriaLabel(draftFileTp.title),
      }),
    );

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
    expect(screen.getByText(editorCopy.publishedTitle)).toBeVisible();
    expect(
      screen.getByText(editorCopy.publishedDescription(draftFileTp.title)),
    ).toBeVisible();
    expect(await screen.findByText(copy.states.PUBLISHED)).toBeVisible();
    expect(listCalls).toBeGreaterThanOrEqual(2);
    // After a confirmed publish the per-item trigger disappears, so focus
    // lands on the panel heading.
    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { level: 3, name: copy.heading }),
        ).toHaveFocus();
      },
      { timeout: 5000 },
    );
  });

  test('publish 400 surfaces publishNotPublishable and keeps the confirmation open', async () => {
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
            code: 'BAD_REQUEST',
            message: 'dueAt is in the past',
            correlationId: 'corr-publish-400',
          },
        },
      }),
    );

    renderActivitiesPanel();
    fireEvent.click(
      await screen.findByRole('button', {
        name: copy.publishAriaLabel(draftFileTp.title),
      }),
    );
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

  test('publish 409 surfaces publishAlreadyPublished and keeps the confirmation open', async () => {
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
          status: 409,
          body: {
            code: 'CONFLICT',
            message: 'Activity is already published',
            correlationId: 'corr-publish-409',
          },
        },
      }),
    );

    renderActivitiesPanel();
    fireEvent.click(
      await screen.findByRole('button', {
        name: copy.publishAriaLabel(draftFileTp.title),
      }),
    );
    const confirmDialog = await screen.findByRole('dialog', {
      name: editorCopy.publish.title(draftFileTp.title),
    });
    fireEvent.click(
      within(confirmDialog).getByRole('button', {
        name: editorCopy.publish.submit,
      }),
    );

    const alert = await within(confirmDialog).findByRole('alert');
    expect(alert).toHaveTextContent(writeCopy.publishAlreadyPublished);
    expect(alert).not.toHaveTextContent('already published by the server');
    expect(confirmDialog).toBeVisible();
  });

  test('dialog traps focus, guards unsaved changes, and returns focus to the opener', async () => {
    mswServer.use(
      staffDetailHandler(),
      createClassroomActivitiesListHandler({ classroomId, items: [] }),
    );

    const dialog = await openCreateDialog();

    // Focus moved into the dialog when it opened.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tab keeps focus trapped inside the modal.
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

    // Unsaved changes: dismissal is blocked unless the teacher confirms.
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
      screen.getByRole('button', { name: copy.createAction }),
    ).toHaveFocus();
  });
});
