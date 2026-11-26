import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { activityMessages } from '../src/features/classrooms/activities/messages';
import { classroomMessages } from '../src/features/classrooms/messages';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '00000000-0000-4000-8000-000000000039';
const schoolTimeZone = 'America/Argentina/Buenos_Aires';
const activitiesPath = `/classrooms/${classroomId}/activities`;
const syntheticNow = '2026-11-18T15:00:00.000Z';

const actionsCopy = activityMessages.actions;
const editorCopy = activityMessages.editor;

type ClassroomContext = components['schemas']['ClassroomContextResponseDto'];
type TeacherActivity = components['schemas']['TeacherActivityResponseDto'];
type ActivitySummary = components['schemas']['ActivitySummaryDto'];
type CreateActivityBody = components['schemas']['CreateActivityDto'];

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'docente@example.test',
  displayName: 'Prof. Ana García',
  avatar: {
    bodyId: 'female',
    hairId: 'classic-short',
    topId: 'basic-tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

function classroomContext(role: 'TEACHER' | 'STUDENT'): ClassroomContext {
  return {
    id: classroomId,
    name: '3.º Año B - Física',
    subject: 'Mecánica clásica',
    schoolId: null,
    independentTeacherId: userId,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    tutorBotSkin: 'none',
    myRole: role,
    capabilities:
      role === 'TEACHER'
        ? ['publish_content', 'configure_classroom']
        : ['participate_activities'],
    availablePanels: ['activities', 'members'],
    deskCount: 12,
    pet: null,
    createdAt: syntheticNow,
    updatedAt: syntheticNow,
  };
}

/** Strips the teacher-only fields the list endpoint never includes. */
function toSummary(activity: TeacherActivity): ActivitySummary {
  return {
    id: activity.id,
    classroomId: activity.classroomId,
    type: activity.type,
    format: activity.format,
    state: activity.state,
    title: activity.title,
    description: activity.description,
    opensAt: activity.opensAt,
    dueAt: activity.dueAt,
    allowLate: activity.allowLate,
    maxScore: activity.maxScore,
    weightMultiplier: activity.weightMultiplier,
    publishedAt: activity.publishedAt,
    timeZone: activity.timeZone,
    questionCount: activity.questionCount,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  };
}

function errorBody(code: string) {
  return {
    error: {
      code,
      message: `Synthetic ${code} diagnostic`,
      correlationId: `corr-e2e-${code.toLowerCase()}`,
    },
  };
}

let syntheticSequence = 0;

function syntheticId(): string {
  syntheticSequence += 1;
  return `00000000-0000-4000-8000-${String(syntheticSequence).padStart(12, '0')}`;
}

/** Server-like mutable state the intercepted routes act on. */
interface ActivitiesApiState {
  readonly store: TeacherActivity[];
  readonly context: ClassroomContext;
}

/**
 * Intercepts the API origin with an in-test activities "server": the list is
 * role-filtered (students receive published activities only), create appends
 * a DRAFT teacher view, publish flips the stored state one way (400 when the
 * stored `dueAt` is in the past, 409 when already published) and deactivate
 * removes the stored row.
 */
async function interceptClassroomApi(
  page: Page,
  testInfo: TestInfo,
  state: ActivitiesApiState,
): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL && url.origin === new URL(baseURL).origin) {
      return route.continue();
    }

    if (url.origin !== apiOrigin) {
      return route.abort();
    }

    if (url.pathname === '/users/me') {
      return route.fulfill({ json: profile });
    }
    if (url.pathname === '/chats' && request.method() === 'GET') {
      return route.fulfill({ json: { items: [] } });
    }
    if (url.pathname === '/notifications' && request.method() === 'GET') {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/points` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: {
          classroomId,
          studentId: userId,
          balance: 0,
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
        },
      });
    }
    if (url.pathname === `/classrooms/${classroomId}`) {
      return route.fulfill({ json: state.context });
    }
    if (url.pathname === `/classrooms/${classroomId}/context-events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      });
    }
    if (url.pathname === activitiesPath && request.method() === 'GET') {
      const stateFilter = url.searchParams.get('state');
      const visibleToCaller = (activity: TeacherActivity): boolean =>
        state.context.myRole === 'TEACHER' || activity.state === 'PUBLISHED';
      const items = state.store
        .filter(visibleToCaller)
        .filter((activity) =>
          stateFilter === 'DRAFT' || stateFilter === 'PUBLISHED'
            ? activity.state === stateFilter
            : true,
        );
      return route.fulfill({
        json: {
          items: items.map(toSummary),
          page: 1,
          pageSize: 10,
          total: items.length,
        },
      });
    }
    if (url.pathname === activitiesPath && request.method() === 'POST') {
      const body = request.postDataJSON() as CreateActivityBody;
      const titleValid =
        typeof body.title === 'string' && body.title.trim() !== '';
      const questionsValid =
        body.format !== 'MULTIPLE_CHOICE' ||
        (Array.isArray(body.questions) &&
          body.questions.length > 0 &&
          body.questions.every(
            (question) =>
              question.options.length >= 2 &&
              question.options.filter((option) => option.isCorrect).length ===
                1,
          ));
      if (!titleValid || !questionsValid) {
        return route.fulfill({
          status: 400,
          json: errorBody('VALIDATION_FAILED'),
        });
      }
      const questions = (body.questions ?? []).map(
        (question, questionIndex) => ({
          id: syntheticId(),
          position: questionIndex + 1,
          prompt: question.prompt,
          options: question.options.map((option, optionIndex) => ({
            id: syntheticId(),
            position: optionIndex + 1,
            label: option.label,
            isCorrect: option.isCorrect,
          })),
        }),
      );
      const created: TeacherActivity = {
        id: syntheticId(),
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
        timeZone: schoolTimeZone,
        questionCount: questions.length,
        createdAt: syntheticNow,
        updatedAt: syntheticNow,
        createdById: userId,
        questions,
      };
      state.store.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    const publishMatch = url.pathname.match(
      new RegExp(`^${activitiesPath}/([^/]+)/publish$`),
    );
    if (publishMatch !== null && request.method() === 'POST') {
      const index = state.store.findIndex(
        (entry) => entry.id === publishMatch[1],
      );
      if (index === -1) {
        return route.fulfill({ status: 404, json: errorBody('NOT_FOUND') });
      }
      const activity = state.store[index];
      if (activity === undefined || activity.state === 'PUBLISHED') {
        return route.fulfill({
          status: 409,
          json: errorBody('CONFLICT'),
        });
      }
      if (Date.parse(activity.dueAt) <= Date.now()) {
        return route.fulfill({
          status: 400,
          json: errorBody('VALIDATION_FAILED'),
        });
      }
      const publishedAt = new Date().toISOString();
      const published: TeacherActivity = {
        ...activity,
        state: 'PUBLISHED',
        publishedAt,
        updatedAt: publishedAt,
      };
      state.store[index] = published;
      return route.fulfill({ json: published });
    }
    const detailMatch = url.pathname.match(
      new RegExp(`^${activitiesPath}/([^/]+)$`),
    );
    if (detailMatch !== null && request.method() === 'GET') {
      const activity = state.store.find((entry) => entry.id === detailMatch[1]);
      return activity === undefined
        ? route.fulfill({ status: 404, json: errorBody('NOT_FOUND') })
        : route.fulfill({ json: activity });
    }
    if (detailMatch !== null && request.method() === 'DELETE') {
      const index = state.store.findIndex(
        (entry) => entry.id === detailMatch[1],
      );
      if (index === -1) {
        return route.fulfill({ status: 404, json: errorBody('NOT_FOUND') });
      }
      state.store.splice(index, 1);
      return route.fulfill({ status: 204 });
    }

    return route.fulfill({ status: 404, json: {} });
  });
}

async function attachRuntimeMonitors(page: Page) {
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];

  await page.exposeFunction('__recordCspViolation__', (directive: string) => {
    cspViolations.push(directive);
  });
  await page.addInitScript(() => {
    const tabOwner = '00000000-0000-4000-8000-000000000002';
    window.name = `\n[integratec-tab:${tabOwner}]`;
    sessionStorage.setItem(
      'integratec.session',
      JSON.stringify({
        accessToken: 'synthetic-access',
        refreshToken: 'synthetic-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + 900_000,
        tabOwner,
      }),
    );
    window.addEventListener('securitypolicyviolation', (event) => {
      const report = window as unknown as {
        __recordCspViolation__?: (directive: string) => void;
      };
      report.__recordCspViolation__?.(
        `${event.violatedDirective}:${event.blockedURI}`,
      );
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  return { cspViolations, pageErrors };
}

test('teacher publishes an exam and the server-confirmed activity appears in the list', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  const store: TeacherActivity[] = [];
  await interceptClassroomApi(page, testInfo, {
    store,
    context: classroomContext('TEACHER'),
  });

  await page.goto(`./classrooms/${classroomId}/panels/activities`);

  const panel = page.getByRole('dialog', {
    name: classroomMessages.panels.activities,
    exact: true,
  });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByText(activityMessages.emptyTitleStaff, { exact: true }),
  ).toBeVisible();

  await panel
    .getByRole('button', { name: actionsCopy.createAction, exact: true })
    .click();

  const editor = page.getByRole('dialog', {
    name: editorCopy.createTitle,
    exact: true,
  });
  await expect(editor).toBeVisible();
  await expect(editor).toContainText(editorCopy.createDescription);

  const examTitle = 'Examen de fuerzas';
  const dueAtLocal = '2030-06-15T18:00';

  const examTypeRadio = editor.getByRole('radio', {
    name: editorCopy.fields.type.options.EXAM.label,
    exact: true,
  });
  await editor
    .getByText(editorCopy.fields.type.options.EXAM.label, { exact: true })
    .click();
  await expect(examTypeRadio).toBeChecked();
  const multipleChoiceRadio = editor.getByRole('radio', {
    name: editorCopy.fields.format.options.MULTIPLE_CHOICE.label,
    exact: true,
  });
  await editor
    .getByText(editorCopy.fields.format.options.MULTIPLE_CHOICE.label, {
      exact: true,
    })
    .click();
  await expect(multipleChoiceRadio).toBeChecked();
  await editor
    .getByLabel(editorCopy.fields.title.label, { exact: true })
    .fill(examTitle);
  await editor
    .getByLabel(editorCopy.fields.description.label, { exact: true })
    .fill('Repaso de unidades del SI.');
  await editor
    .getByLabel(editorCopy.fields.dueAt.label, { exact: true })
    .fill(dueAtLocal);
  await editor
    .getByLabel(editorCopy.fields.maxScore.label, { exact: true })
    .fill('10');

  await editor
    .getByRole('button', {
      name: editorCopy.questions.addQuestion,
      exact: true,
    })
    .click();
  await editor
    .getByLabel(editorCopy.questions.prompt.label, { exact: true })
    .fill('¿Cuál es la unidad de fuerza del SI?');
  await editor
    .getByLabel(editorCopy.questions.optionLabel(1), { exact: true })
    .fill('Newton');
  await editor
    .getByLabel(editorCopy.questions.optionLabel(2), { exact: true })
    .fill('Joule');
  await editor
    .getByRole('radio', {
      name: editorCopy.questions.markCorrect(1),
      exact: true,
    })
    .check();

  await editor
    .getByRole('button', {
      name: editorCopy.actions.createSubmit,
      exact: true,
    })
    .click();

  const publish = page.getByRole('dialog', {
    name: editorCopy.publish.title(examTitle),
    exact: true,
  });
  await expect(publish).toBeVisible();
  await expect(publish).toContainText(editorCopy.publish.description);
  await expect(publish).toContainText(editorCopy.publish.dueAtLabel);
  await expect(editor).toHaveCount(0);

  // While the modal publish dialog is open, Radix marks the background panel
  // `aria-hidden="true"`, so verify the reconciled draft via DOM text until
  // the publish modal closes and restores full ARIA access to the list.
  const backgroundBoard = panel
    .locator('[data-testid="activities-board"], ul')
    .first();
  await expect(
    backgroundBoard.getByText(examTitle, { exact: true }),
  ).toBeVisible();
  await expect(
    backgroundBoard.getByText(activityMessages.stateLabels.DRAFT, {
      exact: true,
    }),
  ).toBeVisible();

  await publish
    .getByRole('button', { name: editorCopy.publish.submit, exact: true })
    .click();

  await expect(publish).toHaveCount(0);
  const group = panel.getByRole('group', {
    name: activityMessages.listRegionLabel,
  });
  const publishedItem = group
    .getByRole('listitem')
    .filter({ hasText: examTitle });
  await expect(publishedItem).toBeVisible();
  await expect(
    publishedItem.getByText(activityMessages.stateLabels.PUBLISHED, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    publishedItem.getByText(activityMessages.stateLabels.DRAFT, {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    publishedItem.getByText(activityMessages.typeLabels.EXAM, { exact: true }),
  ).toBeVisible();
  await expect(
    publishedItem.getByText(activityMessages.formatLabels.MULTIPLE_CHOICE, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    publishedItem.getByRole('button', {
      name: activityMessages.board.moreActionsAriaLabel(examTitle),
    }),
  ).toBeVisible();
  await publishedItem
    .getByRole('button', {
      name: activityMessages.board.moreActionsAriaLabel(examTitle),
    })
    .click();
  await expect(
    page.getByRole('menuitem', {
      name: actionsCopy.publishAction,
    }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('student sees only published activities without teacher actions on desktop and mobile', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  const publishedTp: TeacherActivity = {
    id: '11111111-1111-4111-8111-111111111111',
    classroomId,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP de fluidos',
    description: 'Medición de densidades.',
    opensAt: null,
    dueAt: '2027-01-15T21:00:00.000Z',
    allowLate: true,
    maxScore: 10,
    weightMultiplier: 1,
    publishedAt: syntheticNow,
    timeZone: schoolTimeZone,
    questionCount: 0,
    createdAt: syntheticNow,
    updatedAt: syntheticNow,
    createdById: userId,
    questions: [],
  };
  const draftExam: TeacherActivity = {
    id: '11111111-1111-4111-8111-111111111112',
    classroomId,
    type: 'EXAM',
    format: 'MULTIPLE_CHOICE',
    state: 'DRAFT',
    title: 'Examen de repaso oculto',
    description: '',
    opensAt: null,
    dueAt: '2030-06-20T21:00:00.000Z',
    allowLate: false,
    maxScore: 8,
    weightMultiplier: 1.5,
    publishedAt: null,
    timeZone: schoolTimeZone,
    questionCount: 1,
    createdAt: syntheticNow,
    updatedAt: syntheticNow,
    createdById: userId,
    questions: [
      {
        id: '22222222-2222-4222-8222-222222222201',
        position: 1,
        prompt: '¿Pregunta oculta?',
        options: [
          {
            id: '22222222-2222-4222-8222-222222222202',
            position: 1,
            label: 'Opción A',
            isCorrect: true,
          },
          {
            id: '22222222-2222-4222-8222-222222222203',
            position: 2,
            label: 'Opción B',
            isCorrect: false,
          },
        ],
      },
    ],
  };

  await interceptClassroomApi(page, testInfo, {
    store: [publishedTp, draftExam],
    context: classroomContext('STUDENT'),
  });

  await page.goto(`./classrooms/${classroomId}/panels/activities`);

  const panel = page.getByRole('dialog', {
    name: classroomMessages.panels.activities,
    exact: true,
  });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByText(publishedTp.title, { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole('link', {
      name: `${activityMessages.openDetailLabel}: ${publishedTp.title}`,
    }),
  ).toBeVisible();

  // Drafts never reach the student list, and teacher actions/filters are absent.
  await expect(panel.getByText(draftExam.title, { exact: true })).toHaveCount(
    0,
  );
  await expect(
    panel.getByRole('button', { name: actionsCopy.createAction }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole('button', {
      name: activityMessages.board.moreActionsAriaLabel(publishedTp.title),
    }),
  ).toHaveCount(0);
  await expect(panel.getByLabel(activityMessages.stateFilterLabel)).toHaveCount(
    0,
  );

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('captures activities panel and editor UI evidence for documentation', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  const publishedTp: TeacherActivity = {
    id: '11111111-1111-4111-8111-111111111111',
    classroomId,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP de fluidos',
    description: 'Medición de densidades.',
    opensAt: null,
    dueAt: '2027-01-15T21:00:00.000Z',
    allowLate: true,
    maxScore: 10,
    weightMultiplier: 1,
    publishedAt: syntheticNow,
    timeZone: schoolTimeZone,
    questionCount: 0,
    createdAt: syntheticNow,
    updatedAt: syntheticNow,
    createdById: userId,
    questions: [],
  };
  const draftExam: TeacherActivity = {
    id: '11111111-1111-4111-8111-111111111112',
    classroomId,
    type: 'EXAM',
    format: 'MULTIPLE_CHOICE',
    state: 'DRAFT',
    title: 'Examen de repaso',
    description: '',
    opensAt: null,
    dueAt: '2030-06-20T21:00:00.000Z',
    allowLate: false,
    maxScore: 8,
    weightMultiplier: 1.5,
    publishedAt: null,
    timeZone: schoolTimeZone,
    questionCount: 1,
    createdAt: syntheticNow,
    updatedAt: syntheticNow,
    createdById: userId,
    questions: [
      {
        id: '22222222-2222-4222-8222-222222222201',
        position: 1,
        prompt: '¿Qué magnitud mide un dinamómetro?',
        options: [
          {
            id: '22222222-2222-4222-8222-222222222202',
            position: 1,
            label: 'Fuerza',
            isCorrect: true,
          },
          {
            id: '22222222-2222-4222-8222-222222222203',
            position: 2,
            label: 'Masa',
            isCorrect: false,
          },
        ],
      },
    ],
  };

  await interceptClassroomApi(page, testInfo, {
    store: [publishedTp, draftExam],
    context: classroomContext('TEACHER'),
  });

  await page.goto(`./classrooms/${classroomId}/panels/activities`);

  const panel = page.getByRole('dialog', {
    name: classroomMessages.panels.activities,
    exact: true,
  });
  await expect(panel).toBeVisible();
  const group = panel.getByRole('group', {
    name: activityMessages.listRegionLabel,
  });
  await expect(
    group.getByText(publishedTp.title, { exact: true }),
  ).toBeVisible();
  await expect(group.getByText(draftExam.title, { exact: true })).toBeVisible();
  await expect(
    group.getByText(activityMessages.stateLabels.DRAFT, { exact: true }),
  ).toBeVisible();
  await expect(
    group.getByText(activityMessages.stateLabels.PUBLISHED, { exact: true }),
  ).toBeVisible();

  await page.screenshot({
    path: `docs/assets/activities/list-${width}.png`,
    fullPage: true,
  });

  await panel
    .getByRole('button', { name: actionsCopy.createAction, exact: true })
    .click();

  const editor = page.getByRole('dialog', {
    name: editorCopy.createTitle,
    exact: true,
  });
  await expect(editor).toBeVisible();

  const examTitle = 'Examen de unidades del SI';
  await editor
    .getByText(editorCopy.fields.type.options.EXAM.label, { exact: true })
    .click();
  await editor
    .getByText(editorCopy.fields.format.options.MULTIPLE_CHOICE.label, {
      exact: true,
    })
    .click();
  await editor
    .getByLabel(editorCopy.fields.title.label, { exact: true })
    .fill(examTitle);
  await editor
    .getByLabel(editorCopy.fields.description.label, { exact: true })
    .fill('Repaso de unidades y magnitudes.');
  await editor
    .getByLabel(editorCopy.fields.dueAt.label, { exact: true })
    .fill('2030-06-15T18:00');
  await editor
    .getByLabel(editorCopy.fields.maxScore.label, { exact: true })
    .fill('10');
  await editor
    .getByRole('button', {
      name: editorCopy.questions.addQuestion,
      exact: true,
    })
    .click();
  await editor
    .getByLabel(editorCopy.questions.prompt.label, { exact: true })
    .fill('¿Cuál es la unidad de fuerza del SI?');
  await editor
    .getByLabel(editorCopy.questions.optionLabel(1), { exact: true })
    .fill('Newton');
  await editor
    .getByLabel(editorCopy.questions.optionLabel(2), { exact: true })
    .fill('Joule');
  await editor
    .getByRole('radio', {
      name: editorCopy.questions.markCorrect(1),
      exact: true,
    })
    .check();

  await page.screenshot({
    path: `docs/assets/activities/editor-${width}.png`,
    fullPage: true,
  });

  await editor
    .getByRole('button', {
      name: editorCopy.actions.createSubmit,
      exact: true,
    })
    .click();

  const publish = page.getByRole('dialog', {
    name: editorCopy.publish.title(examTitle),
    exact: true,
  });
  await expect(publish).toBeVisible();
  await expect(publish).toContainText(editorCopy.publish.description);

  await page.screenshot({
    path: `docs/assets/activities/publish-${width}.png`,
    fullPage: true,
  });

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
