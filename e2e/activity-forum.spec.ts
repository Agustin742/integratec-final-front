import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { activityMessages } from '../src/features/classrooms/activities/messages';
import { forumMessages } from '../src/features/classrooms/activities/forum/forum-messages';

const apiOrigin = 'https://api.example.invalid';
const classroomId = '00000000-0000-4000-8000-000000000052';
const activityId = '00000000-0000-4000-8000-000000005101';
const studentId = '00000000-0000-4000-8000-000000007001';
const teacherId = '00000000-0000-4000-8000-000000000001';
const syntheticNow = '2026-11-19T02:00:00.000Z';

type ClassroomContext = components['schemas']['ClassroomContextResponseDto'];
type ActivitySummary = components['schemas']['ActivitySummaryDto'];
type ForumPost = components['schemas']['ForumPostDto'];

interface E2eThread {
  readonly id: string;
  readonly activityId: string;
  readonly authorId: string;
  readonly createdAt: string;
  readonly posts: ForumPost[];
}

interface ForumE2eState {
  readonly role: 'STUDENT' | 'TEACHER';
  readonly userId: string;
  readonly threads: E2eThread[];
  seq: number;
}

const activity: ActivitySummary = {
  id: activityId,
  classroomId,
  type: 'TP',
  format: 'FILE',
  state: 'PUBLISHED',
  title: 'TP 1: Funciones cuadráticas',
  description: 'Resolver los ejercicios 1 a 4 y subir el archivo PDF.',
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
};

function buildContext(role: 'STUDENT' | 'TEACHER'): ClassroomContext {
  return {
    id: classroomId,
    name: '4.º Año A - Matemática',
    subject: 'Análisis matemático',
    schoolId: null,
    independentTeacherId: teacherId,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    tutorBotSkin: 'none',
    myRole: role,
    capabilities:
      role === 'TEACHER'
        ? ['publish_content', 'configure_classroom', 'list_directory']
        : ['participate_activities', 'list_directory'],
    availablePanels: ['activities', 'members'],
    deskCount: 16,
    pet: null,
    createdAt: syntheticNow,
    updatedAt: syntheticNow,
  };
}

function createInitialThreads(): E2eThread[] {
  return [
    {
      id: '00000000-0000-4000-8000-400000000001',
      activityId,
      authorId: studentId,
      createdAt: '2026-11-19T01:00:00.000Z',
      posts: [
        {
          id: '00000000-0000-4000-8000-500000000001',
          threadId: '00000000-0000-4000-8000-400000000001',
          authorId: studentId,
          body: '¿Los gráficos del punto 2 pueden ir hechos a mano escaneados?',
          createdAt: '2026-11-19T01:00:00.000Z',
        },
        {
          id: '00000000-0000-4000-8000-500000000002',
          threadId: '00000000-0000-4000-8000-400000000001',
          authorId: teacherId,
          body: 'Sí, siempre que los ejes y escalas se lean con claridad en el PDF.',
          createdAt: '2026-11-19T01:15:00.000Z',
        },
      ],
    },
  ];
}

async function interceptForumApi(
  page: Page,
  testInfo: TestInfo,
  state: ForumE2eState,
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
      return route.fulfill({
        json: {
          id: state.userId,
          email:
            state.role === 'TEACHER'
              ? 'docente@example.test'
              : 'estudiante@example.test',
          displayName:
            state.role === 'TEACHER' ? 'Prof. Ana García' : 'Sofía Martínez',
          avatar: {
            bodyId: 'female',
            hairId: 'classic-short',
            topId: 'basic-tshirt',
            hairColor: '#6C4D48',
            clothingColor: '#5B4F96',
          },
        },
      });
    }
    if (url.pathname === '/notifications' && request.method() === 'GET') {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (url.pathname === `/classrooms/${classroomId}`) {
      return route.fulfill({ json: buildContext(state.role) });
    }
    if (url.pathname === `/classrooms/${classroomId}/context-events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      });
    }
    if (url.pathname === `/classrooms/${classroomId}/members`) {
      return route.fulfill({
        json: {
          items: [
            {
              id: 'm-1',
              userId: studentId,
              displayName: 'Sofía Martínez',
              role: 'STUDENT',
              avatar: null,
            },
            {
              id: 'm-2',
              userId: teacherId,
              displayName: 'Prof. Ana García',
              role: 'TEACHER',
              avatar: null,
            },
          ],
          page: 1,
          pageSize: 100,
          total: 2,
        },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/activities/${activityId}` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { ...activity, questions: [] } });
    }
    if (
      url.pathname ===
        `/classrooms/${classroomId}/activities/${activityId}/forum/threads` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: {
          items: state.threads.map((t) => ({
            id: t.id,
            activityId: t.activityId,
            authorId: t.authorId,
            firstPostBody: t.posts[0]?.body ?? '',
            replyCount: Math.max(0, t.posts.length - 1),
            createdAt: t.createdAt,
          })),
          page: 1,
          pageSize: 10,
          total: state.threads.length,
        },
      });
    }
    if (
      url.pathname ===
        `/classrooms/${classroomId}/activities/${activityId}/forum/threads` &&
      request.method() === 'POST'
    ) {
      const payload = request.postDataJSON() as { body: string };
      state.seq += 1;
      const now = '2026-11-19T02:10:00.000Z';
      const threadId = `00000000-0000-4000-8000-40000000010${state.seq}`;
      const post: ForumPost = {
        id: `00000000-0000-4000-8000-50000000010${state.seq}`,
        threadId,
        authorId: state.userId,
        body: payload.body,
        createdAt: now,
      };
      const thread: E2eThread = {
        id: threadId,
        activityId,
        authorId: state.userId,
        createdAt: now,
        posts: [post],
      };
      state.threads.unshift(thread);
      return route.fulfill({ status: 201, json: thread });
    }

    const postsMatch = url.pathname.match(
      new RegExp(
        `^/classrooms/${classroomId}/activities/${activityId}/forum/threads/([^/]+)/posts$`,
      ),
    );
    if (postsMatch && request.method() === 'GET') {
      const thread = state.threads.find((t) => t.id === postsMatch[1]);
      if (!thread) {
        return route.fulfill({ status: 404, json: {} });
      }
      return route.fulfill({
        json: {
          items: thread.posts,
          page: 1,
          pageSize: 20,
          total: thread.posts.length,
        },
      });
    }
    if (postsMatch && request.method() === 'POST') {
      const thread = state.threads.find((t) => t.id === postsMatch[1]);
      if (!thread) {
        return route.fulfill({ status: 404, json: {} });
      }
      const payload = request.postDataJSON() as { body: string };
      state.seq += 1;
      const post: ForumPost = {
        id: `00000000-0000-4000-8000-50000000020${state.seq}`,
        threadId: thread.id,
        authorId: state.userId,
        body: payload.body,
        createdAt: '2026-11-19T02:20:00.000Z',
      };
      thread.posts.push(post);
      return route.fulfill({ status: 201, json: post });
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

test('student opens activity forum tab, creates a new question thread, opens an existing thread, and posts a reply', async ({
  page,
}, testInfo) => {
  const monitors = await attachRuntimeMonitors(page);
  const state: ForumE2eState = {
    role: 'STUDENT',
    userId: studentId,
    threads: createInitialThreads(),
    seq: 0,
  };
  await interceptForumApi(page, testInfo, state);

  await page.goto(`/classrooms/${classroomId}/activities/${activityId}`);

  await page
    .getByRole('tab', { name: activityMessages.detail.tabs.forum })
    .click();

  await expect(
    page.getByRole('heading', { name: forumMessages.header.title }),
  ).toBeVisible();
  await expect(
    page.getByText(
      '¿Los gráficos del punto 2 pueden ir hechos a mano escaneados?',
    ),
  ).toBeVisible();

  const width = page.viewportSize()?.width ?? 1280;
  const suffix = width <= 480 ? '360' : '1280';

  const hasOverflowList = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflowList).toBe(false);

  await page.screenshot({
    path: `docs/assets/forum/threads-${suffix}.png`,
    fullPage: false,
    animations: 'disabled',
  });

  // Open existing thread with teacher reply
  await page
    .getByRole('button', { name: forumMessages.threads.openThreadAction })
    .first()
    .click();

  await expect(
    page.getByRole('heading', { name: forumMessages.posts.threadHeading }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Sí, siempre que los ejes y escalas se lean con claridad en el PDF.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Prof. Ana García')).toBeVisible();
  await expect(
    page.getByText(forumMessages.posts.roleTeacherBadge, { exact: true }),
  ).toBeVisible();

  await page.screenshot({
    path: `docs/assets/forum/thread-detail-${suffix}.png`,
    fullPage: false,
    animations: 'disabled',
  });

  // Post a reply in thread
  await page
    .getByLabel(forumMessages.composer.replyLabel)
    .fill('¡Gracias profe! Lo escaneo con buena luz.');
  await page
    .getByRole('button', { name: forumMessages.composer.replySubmit })
    .click();

  await expect(
    page.getByText('¡Gracias profe! Lo escaneo con buena luz.'),
  ).toBeVisible();

  // Go back to threads list and publish a new query thread
  await page
    .getByRole('button', { name: forumMessages.posts.backToList })
    .click();

  await page
    .getByLabel(forumMessages.composer.newThreadLabel)
    .fill('¿El punto 4 admite resolverlo por tabla de valores?');
  await page
    .getByRole('button', { name: forumMessages.composer.newThreadSubmit })
    .click();

  await expect(
    page.getByRole('heading', { name: forumMessages.posts.threadHeading }),
  ).toBeVisible();
  await expect(
    page.getByText('¿El punto 4 admite resolverlo por tabla de valores?'),
  ).toBeVisible();

  expect(monitors.cspViolations).toEqual([]);
  expect(monitors.pageErrors).toEqual([]);
});
