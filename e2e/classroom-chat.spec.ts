import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import type {
  ChatDirectoryMemberDto,
  ChatHistoryMessageDto,
  ChatMessageDto,
} from '../src/features/classrooms/chat/chat-schema';

const apiOrigin = 'https://api.example.invalid';
const studentId = '00000000-0000-4000-8000-000000000001';
const teacherId = '00000000-0000-4000-8000-000000000002';
const brunoId = '00000000-0000-4000-8000-000000000003';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000151';
const classroomName = 'Aula sintética del chat';

const studentProfile: components['schemas']['OwnProfileDto'] = {
  id: studentId,
  email: 'sofia@example.test',
  displayName: 'Sofía Martínez',
  avatar: {
    bodyId: 'female',
    hairId: 'original',
    topId: 'tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

const teacherProfile: components['schemas']['OwnProfileDto'] = {
  id: teacherId,
  email: 'profesora@example.test',
  displayName: 'Prof. Laura Gómez',
  avatar: {
    bodyId: 'female',
    hairId: 'original',
    topId: 'tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

const classroom: components['schemas']['ClassroomContextResponseDto'] = {
  id: classroomId,
  name: classroomName,
  subject: null,
  schoolId: null,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'STUDENT',
  capabilities: ['chat_classmates', 'list_directory', 'message_teacher'],
  availablePanels: ['chat'],
  deskCount: 12,
  pet: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const mutedStudentClassroom: components['schemas']['ClassroomContextResponseDto'] =
  {
    ...classroom,
    chatMuted: true,
  };

const teacherClassroom: components['schemas']['ClassroomContextResponseDto'] = {
  ...classroom,
  myRole: 'TEACHER',
  capabilities: [
    'moderate_chat',
    'list_directory',
    'chat_classmates',
    'message_teacher',
  ],
};

const parentClassroom: components['schemas']['ClassroomContextResponseDto'] = {
  ...classroom,
  myRole: 'PARENT',
  capabilities: ['message_teacher'],
};

const wallet: components['schemas']['StudentWalletDto'] = {
  classroomId,
  studentId: '00000000-0000-4000-8000-000000000047',
  balance: 40,
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
};

const directoryMembers: ChatDirectoryMemberDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    userId: teacherId,
    displayName: 'Prof. Laura Gómez',
    role: 'TEACHER',
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    userId: studentId,
    displayName: 'Sofía Martínez',
    role: 'STUDENT',
  },
  {
    id: '00000000-0000-4000-8000-000000000013',
    userId: brunoId,
    displayName: 'Bruno Díaz',
    role: 'STUDENT',
  },
  {
    id: '00000000-0000-4000-8000-000000000014',
    userId: '00000000-0000-4000-8000-000000000004',
    displayName: 'Ana Sánchez',
    role: 'STUDENT',
  },
];

const chatAuthors = [teacherId, studentId, brunoId, brunoId, studentId];

/**
 * Contract order: newest first (`createdAt DESC`, `id DESC`), so seed index 0
 * is the newest message. Twenty-five rows force a second history page at the
 * contract page size of 20.
 */
const seedHistory: ChatHistoryMessageDto[] = Array.from(
  { length: 25 },
  (_, index) => ({
    id: `00000000-0000-4000-8000-0000000080${String(index + 1).padStart(2, '0')}`,
    classroomId,
    authorId: chatAuthors[index % chatAuthors.length] ?? studentId,
    body: `Mensaje del aula ${25 - index}`,
    mentionedUserIds: [],
    createdAt: `2026-11-19T10:${String(55 - 2 * index).padStart(2, '0')}:00.000Z`,
    hiddenAt: null,
    hiddenById: null,
  }),
);

const classroomURL = `${apiOrigin}/classrooms/${classroomId}`;
// Chat requests carry normalized pagination query params, so exact URL
// strings never match; route by pattern instead.
const routePattern = (pathname: string): RegExp =>
  new RegExp(
    `^https://api\\.example\\.invalid/classrooms/${classroomId}/${pathname}(\\?.*)?$`,
  );
const messagesRoute = routePattern('messages');
const membersRoute = routePattern('members');
const hideRoute = new RegExp(
  `^https://api\\.example\\.invalid/classrooms/${classroomId}/messages/[^/?]+(\\?.*)?$`,
);
const entry = `./classrooms/${classroomId}`;
const diagnostic = 'Private synthetic diagnostic must never render';
const errorBody = (
  code: components['schemas']['ErrorCode'],
): components['schemas']['ErrorEnvelope'] => ({
  error: {
    code,
    message: diagnostic,
    correlationId: 'synthetic-chat-request',
  },
});

const monitorsByPage = new WeakMap<
  Page,
  { cspViolations: string[]; pageErrors: string[] }
>();

// Synthetic credentials enter the real hydration/verification flow, not an auth bypass.
test.beforeEach(async ({ page, baseURL }) => {
  expect(baseURL).toBeTruthy();
  const appOrigin = new URL(baseURL!).origin;
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];
  monitorsByPage.set(page, { cspViolations, pageErrors });

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
      const record = window as unknown as {
        __recordCspViolation__?: (directive: string) => void;
      };
      record.__recordCspViolation__?.(
        `${event.violatedDirective}:${event.blockedURI}`,
      );
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) return route.continue();
    // No unmocked external traffic, including unexpected auth/refresh requests.
    if (request.url() === `${apiOrigin}/users/me`) {
      expect(request.method()).toBe('GET');
      expect(request.headers().authorization).toBe('Bearer synthetic-access');
      return route.fulfill({ json: studentProfile });
    }
    if (
      url.origin === apiOrigin &&
      url.pathname === '/notifications' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (request.url() === `${classroomURL}/context-events`) {
      expect(request.method()).toBe('GET');
      expect(request.headers().authorization).toBe('Bearer synthetic-access');
      expect(request.headers().accept).toBe('text/event-stream');
      // Hold the synthetic SSE handshake until teardown like the workspace spec.
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
      return;
    }
    // The workspace header wallet indicator fetches the student points
    // balance; its request carries pagination query params, so match on the
    // pathname.
    if (
      url.origin === apiOrigin &&
      url.pathname === `/classrooms/${classroomId}/points`
    ) {
      expect(request.method()).toBe('GET');
      expect(request.headers().authorization).toBe('Bearer synthetic-access');
      return route.fulfill({ json: wallet });
    }
    await route.abort();
    throw new Error(
      `Unexpected external request: ${url.origin}${url.pathname}`,
    );
  });
});

test.afterEach(async ({ page }) => {
  const monitors = monitorsByPage.get(page);
  expect(monitors?.cspViolations).toEqual([]);
  expect(monitors?.pageErrors).toEqual([]);
});

test('student reads paginated history, mentions a classmate, sends a server-confirmed message and hits the rate limit', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });

  const history: ChatHistoryMessageDto[] = [...seedHistory];
  let rateLimited = false;
  let sentCount = 0;

  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));
  await page.route(messagesRoute, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'POST') {
      if (rateLimited) {
        return route.fulfill({
          status: 429,
          json: errorBody('TOO_MANY_REQUESTS'),
        });
      }
      const payload = JSON.parse(request.postData() ?? '{}') as {
        body?: unknown;
      };
      sentCount += 1;
      const sent: ChatMessageDto = {
        id: `00000000-0000-4000-8000-0000000090${String(sentCount).padStart(2, '0')}`,
        classroomId,
        authorId: studentId,
        body: String(payload.body ?? '').trim(),
        mentionedUserIds: [],
        createdAt: '2026-11-19T12:34:00.000Z',
      };
      history.unshift({ ...sent, hiddenAt: null, hiddenById: null });
      return route.fulfill({ status: 201, json: sent });
    }

    const pageNumber = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const items = history.slice(
      (pageNumber - 1) * pageSize,
      (pageNumber - 1) * pageSize + pageSize,
    );
    return route.fulfill({
      json: { items, page: pageNumber, pageSize, total: history.length },
    });
  });
  await page.route(membersRoute, (route) => {
    const url = new URL(route.request().url());
    const prefix = url.searchParams.get('q');
    const matches =
      prefix === null
        ? directoryMembers
        : directoryMembers.filter((member) =>
            member.displayName.toLowerCase().startsWith(prefix.toLowerCase()),
          );
    const pageNumber = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
    return route.fulfill({
      json: {
        items: matches.slice(
          (pageNumber - 1) * pageSize,
          (pageNumber - 1) * pageSize + pageSize,
        ),
        page: pageNumber,
        pageSize,
        total: matches.length,
      },
    });
  });

  await page.goto(`${entry}/panels/chat`);
  const dialog = page.getByRole('dialog', { name: 'Chat', exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', {
      level: 3,
      name: 'Chat del aula',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText('Charlá con tu aula, «Aula sintética del chat».', {
      exact: true,
    }),
  ).toBeVisible();

  const historyList = dialog.getByRole('list', {
    name: 'Historial de mensajes del chat',
  });
  await expect(historyList).toBeVisible();
  // Real chat: the newest message is anchored at the bottom and there is no
  // pager; the composer stays visible without scrolling the page.
  await expect(
    historyList.getByText('Mensaje del aula 25', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /Página (siguiente|anterior)/ }),
  ).toHaveCount(0);
  // Directory-backed author labels: teacher badge for staff rows and the
  // self marker on the signed-in student's own rows.
  await expect(
    dialog.getByText('Prof. Laura Gómez', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    dialog.getByText('Sofía Martínez (Vos)', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    dialog.getByText('Docente', { exact: true }).first(),
  ).toBeVisible();

  // Mention autocomplete from the member directory (`q` prefix filter),
  // driven entirely by keyboard.
  const composer = dialog.getByRole('textbox', {
    name: 'Mensaje del chat',
  });
  await composer.pressSequentially('@Bru');
  const suggestions = dialog.getByRole('list', {
    name: 'Integrantes sugeridos para mencionar',
  });
  await expect(suggestions).toBeVisible();
  const brunoOption = suggestions.getByRole('button', { name: /Bruno Díaz/ });
  await expect(brunoOption).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(brunoOption).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(composer).toHaveValue('@Bruno Díaz ');
  await composer.pressSequentially('¿ya terminaste la guía de fracciones?');

  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click();

  // Server confirmation: the sent message only becomes history after the
  // 201, the draft clears and the reconciled total grows.
  await expect(
    dialog.getByText('@Bruno Díaz ¿ya terminaste la guía de fracciones?', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(composer).toHaveValue('');
  await expect(composer).toBeFocused();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `docs/assets/chat/classroom-chat-${width}.png`,
    fullPage: true,
  });

  // A 429 send is shown as rate-limited feedback, never as a persisted
  // message, and the draft stays for a later retry.
  rateLimited = true;
  await composer.fill('Segundo mensaje enviado demasiado rápido');
  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(
    dialog.getByText(
      'Enviaste varios mensajes en poco tiempo. Esperá unos instantes antes de reintentar.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(composer).toHaveValue(
    'Segundo mensaje enviado demasiado rápido',
  );

  // Infinite history: scrolling to the top loads page 2 (the oldest
  // messages) automatically, with no pager.
  await expect(
    historyList.getByText('Mensaje del aula 1', { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole('region', { name: 'Conversación del chat' })
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await expect(
    historyList.getByText('Mensaje del aula 1', { exact: true }),
  ).toBeVisible();

  // Typing inside the composer never triggers world shortcuts: Alt+M while
  // the caret is in the composer does not switch the workspace mode.
  await composer.press('Alt+m');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 3, name: 'Vista 3D del aula' }),
  ).toBeVisible();
});

test('muted chat keeps the student reading but disables the composer with the reason', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });

  const history: ChatHistoryMessageDto[] = [
    {
      id: '00000000-0000-4000-8000-000000008101',
      classroomId,
      authorId: teacherId,
      body: 'Mensaje del aula durante el silencio',
      mentionedUserIds: [],
      createdAt: '2026-11-19T11:00:00.000Z',
      hiddenAt: null,
      hiddenById: null,
    },
  ];

  await page.route(classroomURL, (route) =>
    route.fulfill({ json: mutedStudentClassroom }),
  );
  await page.route(messagesRoute, (route) =>
    route.fulfill({
      json: { items: history, page: 1, pageSize: 20, total: history.length },
    }),
  );
  await page.route(membersRoute, (route) =>
    route.fulfill({
      json: {
        items: directoryMembers,
        page: 1,
        pageSize: 100,
        total: directoryMembers.length,
      },
    }),
  );

  await page.goto(`${entry}/panels/chat`);
  const dialog = page.getByRole('dialog', { name: 'Chat', exact: true });
  await expect(dialog).toBeVisible();

  // The confirmed history stays readable while muted.
  await expect(
    dialog.getByText('Mensaje del aula durante el silencio', { exact: true }),
  ).toBeVisible();

  // The student composer explains the muted state and never offers a send.
  await expect(
    dialog.getByRole('heading', {
      level: 4,
      name: 'El chat está silenciado',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      'El personal del aula silenció el chat por ahora. No podés enviar mensajes, pero el historial sigue visible.',
      { exact: true },
    ),
  ).toBeVisible();
  const mutedTextarea = dialog.getByRole('textbox', {
    name: 'Mensaje del chat',
  });
  await expect(mutedTextarea).toBeDisabled();
  await expect(mutedTextarea).toHaveValue('');
  await expect(
    dialog.getByRole('button', { name: 'Enviar', exact: true }),
  ).toHaveCount(0);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('teacher hides a message after confirmation and keeps the moderation audit', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });

  const history: ChatHistoryMessageDto[] = [
    {
      id: '00000000-0000-4000-8000-000000008201',
      classroomId,
      authorId: brunoId,
      body: 'Mensaje que rompe las reglas del aula',
      mentionedUserIds: [],
      createdAt: '2026-11-19T11:30:00.000Z',
      hiddenAt: null,
      hiddenById: null,
    },
    {
      id: '00000000-0000-4000-8000-000000008202',
      classroomId,
      authorId: teacherId,
      body: 'Recordatorio: la entrega de la guía cierra el viernes.',
      mentionedUserIds: [],
      createdAt: '2026-11-19T11:00:00.000Z',
      hiddenAt: null,
      hiddenById: null,
    },
  ];

  await page.route(`${apiOrigin}/users/me`, (route) =>
    route.fulfill({ json: teacherProfile }),
  );
  await page.route(classroomURL, (route) =>
    route.fulfill({ json: teacherClassroom }),
  );
  await page.route(messagesRoute, (route) =>
    route.fulfill({
      json: { items: history, page: 1, pageSize: 20, total: history.length },
    }),
  );
  await page.route(membersRoute, (route) =>
    route.fulfill({
      json: {
        items: directoryMembers,
        page: 1,
        pageSize: 100,
        total: directoryMembers.length,
      },
    }),
  );
  await page.route(hideRoute, (route) => {
    const messageId = new URL(route.request().url()).pathname.split('/').pop();
    const target = history.find((message) => message.id === messageId);
    if (target === undefined) {
      return route.fulfill({ status: 404, json: errorBody('NOT_FOUND') });
    }
    // Logical, idempotent moderation: the audit pair is recorded and the row
    // is never deleted, so staff keep reading it.
    target.hiddenAt = '2026-11-19T13:05:00.000Z';
    target.hiddenById = teacherId;
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto(`${entry}/panels/chat`);
  const dialog = page.getByRole('dialog', { name: 'Chat', exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Mensaje que rompe las reglas del aula', { exact: true }),
  ).toBeVisible();

  // Moderation is confirmed before anything changes: the dialog quotes the
  // exact message and the row keeps its text until the server answers 204.
  const hideButton = dialog.getByRole('button', {
    name: /^Ocultar el mensaje de Bruno Díaz/,
  });
  await hideButton.click();
  const confirmDialog = page.getByRole('dialog', {
    name: 'Ocultar mensaje del chat',
    exact: true,
  });
  await expect(confirmDialog).toBeVisible();
  await expect(
    confirmDialog.getByText('Mensaje que rompe las reglas del aula', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByText('Ocultado', { exact: true })).toHaveCount(0);

  await confirmDialog
    .getByRole('button', { name: 'Ocultar mensaje', exact: true })
    .click();
  await expect(confirmDialog).toHaveCount(0);

  // Confirmed outcome from the revalidated history: the teacher still sees
  // the row, now badged and audited, and no second moderation is offered.
  await expect(
    dialog.getByText('Mensaje que rompe las reglas del aula', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText('Ocultado', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(
      /^Ocultado por Prof\. Laura Gómez el \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/,
    ),
  ).toBeVisible();
  await expect(hideButton).toHaveCount(0);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('parent is denied the classroom chat without any chat request', async ({
  page,
}) => {
  let historyRequests = 0;

  await page.route(classroomURL, (route) =>
    route.fulfill({ json: parentClassroom }),
  );
  await page.route(messagesRoute, (route) => {
    historyRequests += 1;
    return route.fulfill({
      json: { items: [], page: 1, pageSize: 20, total: 0 },
    });
  });

  await page.goto(`${entry}/panels/chat`);
  const dialog = page.getByRole('dialog', { name: 'Chat', exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', {
      level: 3,
      name: 'El chat del aula no está disponible para tu rol',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      'El chat es para estudiantes y personal del aula. Las familias no participan de esta conversación.',
      { exact: true },
    ),
  ).toBeVisible();

  // Denied up front: no history row, no composer, no chat request issued.
  await expect(
    dialog.getByRole('list', { name: 'Historial de mensajes del chat' }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('textbox', { name: 'Mensaje del chat' }),
  ).toHaveCount(0);
  expect(historyRequests).toBe(0);
});
