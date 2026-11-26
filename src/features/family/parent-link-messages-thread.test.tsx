import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
import { createSession } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { storageKey, tokens } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createOwnProfileHandler,
  createParentLinkMessagesHandler,
  createSendParentLinkMessageHandler,
  type ParentLinkMessagePayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { familyMessages } from './messages';
import {
  PARENT_LINK_MESSAGES_PAGE_SIZE,
  ParentLinkMessagesThread,
} from './parent-link-messages-thread';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

afterAll(() => {
  mswServer.close();
});

const parentUserId = '00000000-0000-4000-8000-000000000090';
const staffUserId = '00000000-0000-4000-8000-000000000091';
const linkId = '11111111-1111-4111-8111-111111111101';

function makeMessage(
  index: number,
  overrides: Partial<ParentLinkMessagePayload> = {},
): ParentLinkMessagePayload {
  return {
    id: `77777777-7777-4777-8777-${String(index).padStart(12, '0')}`,
    parentLinkId: linkId,
    authorId: index % 2 === 1 ? parentUserId : staffUserId,
    authorDisplayName: index % 2 === 1 ? 'Laura Martínez' : 'Prof. Carlos Ruiz',
    authorRole: index % 2 === 1 ? 'PARENT' : 'STAFF',
    body: `Mensaje número ${index}`,
    createdAt: new Date(Date.UTC(2026, 10, 20, 12, index, 0)).toISOString(),
    ...overrides,
  };
}

function useRefreshTimers() {
  // Keep Date and timeouts real for the session, MSW, and UI waits.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
}

async function advanceRefreshInterval(milliseconds = 30_000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function renderThread(
  props: {
    readonly userId?: string;
    readonly viewerRole?: 'PARENT' | 'STAFF';
  } = {},
) {
  const userId = props.userId ?? parentUserId;
  const tabOwner = 'tab-messages-thread-test';
  window.name = `\n[integratec-tab:${tabOwner}]`;
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      ...tokens,
      expiresAt: Date.now() + 900_000,
      tabOwner,
    }),
  );

  mswServer.use(
    createOwnProfileHandler({
      response: {
        id: userId,
        email: 'user@example.edu.ar',
        displayName: 'Laura Martínez',
      },
    }),
  );

  const session = createSession({
    baseUrl: TEST_API_BASE_URL,
    tabOwner: () => tabOwner,
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const thread = (title?: string) => (
    <SessionProvider service={session}>
      <ParentLinkMessagesThread
        userId={userId}
        linkId={linkId}
        viewerRole={props.viewerRole ?? 'PARENT'}
        title={title}
      />
    </SessionProvider>
  );
  const result = render(thread(), { queryClient });
  return {
    ...result,
    rerenderThread: () => result.rerender(thread('Conversación actualizada')),
  };
}

describe('ParentLinkMessagesThread', () => {
  test.each(['PARENT', 'STAFF'] as const)(
    'receives remote replies for %s without sending and preserves the draft',
    async (viewerRole) => {
      useRefreshTimers();
      const messages = [makeMessage(1)];
      const reads = vi.fn();
      const sends = vi.fn();
      mswServer.use(
        createParentLinkMessagesHandler({
          linkId,
          items: () => messages,
          onRequest: reads,
        }),
        createSendParentLinkMessageHandler({ linkId, onRequest: sends }),
      );
      const { unmount } = renderThread({
        viewerRole,
        userId: viewerRole === 'PARENT' ? parentUserId : staffUserId,
      });
      await screen.findByText('Mensaje número 1');
      const textarea = screen.getByLabelText(
        familyMessages.messaging.composer.label,
      );
      fireEvent.change(textarea, { target: { value: 'Borrador sin enviar' } });
      messages.push(
        makeMessage(2, {
          authorRole: viewerRole === 'PARENT' ? 'STAFF' : 'PARENT',
          body: 'Respuesta remota nueva',
        }),
      );

      await advanceRefreshInterval();
      expect(
        await screen.findByText('Respuesta remota nueva'),
      ).toBeInTheDocument();
      expect(textarea).toHaveValue('Borrador sin enviar');
      expect(sends).not.toHaveBeenCalled();
      unmount();
      const readCount = reads.mock.calls.length;
      await advanceRefreshInterval(60_000);
      expect(reads).toHaveBeenCalledTimes(readCount);
    },
  );

  test('refreshes pagination for a remote reply across a page boundary without moving the reader', async () => {
    useRefreshTimers();
    const messages = Array.from(
      { length: PARENT_LINK_MESSAGES_PAGE_SIZE },
      (_, index) => makeMessage(index + 1),
    );
    mswServer.use(
      createParentLinkMessagesHandler({ linkId, items: () => messages }),
    );
    renderThread();
    await screen.findByText('Mensaje número 1');
    messages.push(makeMessage(31, { body: 'Respuesta en página nueva' }));
    await advanceRefreshInterval();
    const next = await screen.findByRole('button', { name: /Siguiente/i });
    expect(screen.getByText('Mensaje número 1')).toBeInTheDocument();
    expect(
      screen.queryByText('Respuesta en página nueva'),
    ).not.toBeInTheDocument();
    fireEvent.click(next);
    expect(
      await screen.findByText('Respuesta en página nueva'),
    ).toBeInTheDocument();
    messages.push(makeMessage(32, { body: 'Otra respuesta en página actual' }));
    await advanceRefreshInterval();
    expect(
      await screen.findByText('Otra respuesta en página actual'),
    ).toBeInTheDocument();
  });

  test.each([403, 404])(
    'hides previously loaded history and stops refreshing after terminal read %s',
    async (status) => {
      useRefreshTimers();
      const reads = vi.fn();
      mswServer.use(
        createParentLinkMessagesHandler({ linkId, items: [makeMessage(1)] }),
      );
      renderThread();
      await screen.findByText('Mensaje número 1');
      mswServer.use(
        createParentLinkMessagesHandler({ linkId, status, onRequest: reads }),
      );
      await advanceRefreshInterval();
      await screen.findByRole('heading', {
        name:
          status === 403
            ? familyMessages.errors.adultModeTitle
            : familyMessages.errors.notFoundTitle,
      });
      expect(screen.queryByText('Mensaje número 1')).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(familyMessages.messaging.composer.label),
      ).not.toBeInTheDocument();
      await advanceRefreshInterval(60_000);
      expect(reads).toHaveBeenCalledTimes(1);
    },
  );

  test.each([403, 404])(
    'keeps terminal read %s stable after same-key rerender and focus',
    async (status) => {
      useRefreshTimers();
      const reads = vi.fn();
      mswServer.use(
        createParentLinkMessagesHandler({ linkId, status, onRequest: reads }),
      );
      const { rerenderThread } = renderThread();
      const heading =
        status === 403
          ? familyMessages.errors.adultModeTitle
          : familyMessages.errors.notFoundTitle;
      await screen.findByRole('heading', { name: heading });
      expect(reads).toHaveBeenCalledTimes(1);
      rerenderThread();
      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      await advanceRefreshInterval(60_000);
      fireEvent(window, new Event('visibilitychange'));
      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText(familyMessages.messaging.composer.label),
      ).not.toBeInTheDocument();
      expect(reads).toHaveBeenCalledTimes(1);
    },
  );

  test('recovers remote replies when the tab returns to the foreground', async () => {
    const messages = [makeMessage(1)];
    mswServer.use(
      createParentLinkMessagesHandler({ linkId, items: () => messages }),
    );
    renderThread();
    await screen.findByText('Mensaje número 1');
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    fireEvent(window, new Event('visibilitychange'));
    messages.push(makeMessage(2, { body: 'Respuesta durante ausencia' }));
    visibility.mockReturnValue('visible');
    fireEvent(window, new Event('visibilitychange'));
    expect(
      await screen.findByText('Respuesta durante ausencia'),
    ).toBeInTheDocument();
  });

  test.each([403, 404])(
    'stops refreshing after terminal write %s',
    async (status) => {
      useRefreshTimers();
      const reads = vi.fn();
      mswServer.use(
        createParentLinkMessagesHandler({
          linkId,
          items: [makeMessage(1)],
          onRequest: reads,
        }),
        createSendParentLinkMessageHandler({ linkId, status }),
      );
      renderThread();
      await screen.findByText('Mensaje número 1');
      fireEvent.change(
        screen.getByLabelText(familyMessages.messaging.composer.label),
        {
          target: { value: 'Consulta pendiente' },
        },
      );
      fireEvent.click(
        screen.getByRole('button', {
          name: familyMessages.messaging.composer.submitAction,
        }),
      );
      await screen.findByRole('heading', {
        name:
          status === 403
            ? familyMessages.errors.adultModeTitle
            : familyMessages.errors.notFoundTitle,
      });
      expect(screen.queryByText('Mensaje número 1')).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(familyMessages.messaging.composer.label),
      ).not.toBeInTheDocument();
      const readCount = reads.mock.calls.length;
      await advanceRefreshInterval(60_000);
      fireEvent(window, new Event('visibilitychange'));
      expect(reads).toHaveBeenCalledTimes(readCount);
    },
  );

  test('renders loading state, empty state, and passes accessibility checks', async () => {
    mswServer.use(
      createParentLinkMessagesHandler({
        linkId,
        items: [],
        delayMs: 30,
      }),
    );

    const { container } = renderThread();

    expect(
      await screen.findByText(familyMessages.messaging.loading),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', {
        name: familyMessages.messaging.emptyTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(familyMessages.messaging.emptyDescriptionParent),
    ).toBeInTheDocument();

    await expectAccessible(container);
  });

  test('renders chronological messages with Familiar and Docente badges and supports pagination', async () => {
    const items = Array.from(
      { length: PARENT_LINK_MESSAGES_PAGE_SIZE + 2 },
      (_, idx) =>
        makeMessage(idx + 1, {
          body:
            idx === 0
              ? 'Hola profesor, ¿cómo viene Sofía esta semana?'
              : idx === 1
                ? 'Hola Laura, Sofía participó muy bien en clase.'
                : idx === PARENT_LINK_MESSAGES_PAGE_SIZE
                  ? 'Mensaje en la segunda página.'
                  : `Mensaje ${idx + 1}`,
        }),
    );

    mswServer.use(
      createParentLinkMessagesHandler({
        linkId,
        items,
      }),
    );

    const { container } = renderThread();

    const list = await screen.findByRole('list', {
      name: familyMessages.messaging.listLabel,
    });
    const listItems = within(list).getAllByRole('listitem');
    expect(listItems).toHaveLength(PARENT_LINK_MESSAGES_PAGE_SIZE);

    expect(
      within(listItems[0]!).getByText(
        'Hola profesor, ¿cómo viene Sofía esta semana?',
      ),
    ).toBeInTheDocument();
    expect(
      within(listItems[0]!).getByText(
        familyMessages.messaging.roleBadges.PARENT,
      ),
    ).toBeInTheDocument();

    expect(
      within(listItems[1]!).getByText(
        'Hola Laura, Sofía participó muy bien en clase.',
      ),
    ).toBeInTheDocument();
    expect(
      within(listItems[1]!).getByText(
        familyMessages.messaging.roleBadges.STAFF,
      ),
    ).toBeInTheDocument();

    await expectAccessible(container);

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

    expect(
      await screen.findByText('Mensaje en la segunda página.'),
    ).toBeInTheDocument();
  });

  test('sends a message on 201, clears composer, and refreshes thread', async () => {
    const messages: ParentLinkMessagePayload[] = [
      makeMessage(1, {
        authorRole: 'STAFF',
        authorDisplayName: 'Prof. Carlos Ruiz',
        body: 'Recuerden traer la carpeta firmada.',
      }),
    ];

    mswServer.use(
      createParentLinkMessagesHandler({
        linkId,
        items: () => messages,
      }),
      createSendParentLinkMessageHandler({
        linkId,
        authorId: parentUserId,
        authorDisplayName: 'Laura Martínez',
        authorRole: 'PARENT',
        onMessageCreated: (created) => {
          messages.push(created);
        },
      }),
    );

    renderThread();

    expect(
      await screen.findByText('Recuerden traer la carpeta firmada.'),
    ).toBeInTheDocument();

    const textarea = screen.getByLabelText(
      familyMessages.messaging.composer.label,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: '  Perfecto, hoy la firmamos.  ' },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: familyMessages.messaging.composer.submitAction,
      }),
    );

    expect(
      await screen.findByText('Perfecto, hoy la firmamos.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  test('blocks blank or whitespace-only body with client validation and zero API calls', async () => {
    const sendSpy = vi.fn();

    mswServer.use(
      createParentLinkMessagesHandler({
        linkId,
        items: [],
      }),
      createSendParentLinkMessageHandler({
        linkId,
        onRequest: sendSpy,
      }),
    );

    renderThread();

    const textarea = await screen.findByLabelText(
      familyMessages.messaging.composer.label,
    );
    fireEvent.change(textarea, { target: { value: '     \n\t  ' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: familyMessages.messaging.composer.submitAction,
      }),
    );

    expect(
      await screen.findByText(
        familyMessages.messaging.composer.validation.required,
      ),
    ).toBeInTheDocument();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  test('preserves draft on uncertain 500 error without exposing raw backend text', async () => {
    mswServer.use(
      createParentLinkMessagesHandler({
        linkId,
        items: [],
      }),
      createSendParentLinkMessageHandler({
        linkId,
        status: 500,
      }),
    );

    renderThread();

    const textarea = (await screen.findByLabelText(
      familyMessages.messaging.composer.label,
    )) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'Consulta importante que no debe perderse' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: familyMessages.messaging.composer.submitAction,
      }),
    );

    expect(
      await screen.findByText(familyMessages.messaging.errors.sendUncertain),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Raw backend failure/i)).not.toBeInTheDocument();
    expect(textarea.value).toBe('Consulta importante que no debe perderse');
  });

  test('handles 403 adult-mode response cleanly without composer or raw backend text', async () => {
    mswServer.use(
      createParentLinkMessagesHandler({
        linkId,
        status: 403,
      }),
    );

    const { container } = renderThread();

    expect(
      await screen.findByRole('heading', {
        name: familyMessages.errors.adultModeTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(familyMessages.messaging.composer.label),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Parent messaging is disabled/i),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('handles 404 removed link cleanly without composer or raw backend text', async () => {
    mswServer.use(
      createParentLinkMessagesHandler({
        linkId,
        status: 404,
      }),
    );

    const { container } = renderThread();

    expect(
      await screen.findByRole('heading', {
        name: familyMessages.errors.notFoundTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(familyMessages.messaging.composer.label),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Parent link not found/i),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });
});
