import { fireEvent, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  BOT_INDEX_FAILURE_REASON,
  TEST_API_BASE_URL,
  createClassroomDetailHandler,
  createClassroomMaterialsStore,
  type BotMaterialStateEntry,
  type ClassroomMaterialItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { MaterialPanel } from './material-panel';

vi.setConfig({ testTimeout: 20_000 });

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const MATERIAL_ID = '00000000-0000-4000-8000-000000002001';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

const BASE_ITEM: ClassroomMaterialItem = {
  id: MATERIAL_ID,
  classroomId: CLASSROOM_ID,
  authorId: profile.id,
  filename: 'guia-bot-unidad-1.pdf',
  contentType: 'application/pdf',
  sizeBytes: 4096,
  createdAt: '2026-11-18T10:00:00.000Z',
};

function botEntry(
  overrides: Partial<BotMaterialStateEntry> = {},
): BotMaterialStateEntry {
  return {
    id: '00000000-0000-4000-8000-000000009001',
    classroomId: CLASSROOM_ID,
    materialId: MATERIAL_ID,
    filename: BASE_ITEM.filename,
    contentType: 'application/pdf',
    sizeBytes: BASE_ITEM.sizeBytes,
    indexState: 'INDEXED',
    failureReason: null,
    createdAt: '2026-11-19T01:00:00.000Z',
    ...overrides,
  };
}

function renderPanel(options: {
  readonly role?: 'TEACHER' | 'STUDENT' | 'PARENT';
  readonly capabilities?: readonly Capability[];
}) {
  const role = options.role ?? 'TEACHER';
  const capabilities: Capability[] =
    options.capabilities !== undefined
      ? [...options.capabilities]
      : role === 'TEACHER'
        ? ['publish_content', 'configure_classroom', 'configure_bot']
        : ['participate_activities'];

  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      myRole: role,
      capabilities,
    }),
  );

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: <MaterialPanel />,
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
  );

  return {
    queryClient,
    ...render(
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>
          <RouterProvider router={router} />
        </SessionProvider>
      </ApiQueryProvider>,
    ),
  };
}

describe('MaterialPanel HU-BOT-001', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => {
    mswServer.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => mswServer.close());

  it('hides bot switch and status from students and staff without configure_bot', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [BASE_ITEM],
      initialBotStates: [botEntry()],
    });
    mswServer.use(...store.handlers);

    const studentView = renderPanel({ role: 'STUDENT' });
    expect(
      await screen.findByText('guia-bot-unidad-1.pdf'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Asistente de estudio (IA)'),
    ).not.toBeInTheDocument();
    studentView.unmount();

    renderPanel({
      role: 'TEACHER',
      capabilities: ['publish_content'],
    });
    expect(
      await screen.findByText('guia-bot-unidad-1.pdf'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('toggles bot material on and off after server confirmation and reflects indexing states', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [BASE_ITEM],
    });
    mswServer.use(...store.handlers);

    const { container, queryClient } = renderPanel({ role: 'TEACHER' });
    const toggle = await screen.findByRole('switch', {
      name: /Habilitar «guia-bot-unidad-1\.pdf» para el asistente de estudio/,
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Desactivado para el bot')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(
      await screen.findByText('Material habilitado para el asistente'),
    ).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Listo para el bot')).toBeInTheDocument();

    // A row left PENDING by the server is shown as such.
    store.setBotState(MATERIAL_ID, { indexState: 'PENDING' });
    await queryClient.invalidateQueries();
    expect(await screen.findByText('Indexando…')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(
      await screen.findByText('Material deshabilitado para el asistente'),
    ).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Desactivado para el bot')).toBeInTheDocument();

    const axeResults = await axe.run(container);
    expect(axeResults.violations).toEqual([]);
  });

  it('shows failed indexing state with plain-text error message', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [BASE_ITEM],
      initialBotStates: [
        botEntry({
          indexState: 'FAILED',
          failureReason: '<img src=x onerror=alert(1)> PDF sin texto extraíble',
        }),
      ],
    });
    mswServer.use(...store.handlers);

    renderPanel({ role: 'TEACHER' });
    expect(await screen.findByText('Error de indexación')).toBeInTheDocument();
    expect(
      screen.getByText('<img src=x onerror=alert(1)> PDF sin texto extraíble'),
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('reports a failed indexing and retries it without disabling the material', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [BASE_ITEM],
    });
    store.setBotIndexOutcome('FAILED');
    mswServer.use(...store.handlers);

    renderPanel({ role: 'TEACHER' });
    const toggle = await screen.findByRole('switch');
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-disabled', 'false');
    });
    fireEvent.click(toggle);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos indexar el material',
    );
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(BOT_INDEX_FAILURE_REASON)).toBeInTheDocument();

    store.setBotIndexOutcome('INDEXED');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Reintentar indexación de «guia-bot-unidad-1.pdf»',
      }),
    );

    expect(await screen.findByText('Listo para el bot')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: /Reintentar indexación/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the material as excluded when the index cleanup is pending', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [BASE_ITEM],
      initialBotStates: [botEntry()],
    });
    mswServer.use(...store.handlers);

    renderPanel({ role: 'TEACHER' });
    expect(await screen.findByText('Listo para el bot')).toBeInTheDocument();
    store.failNext('botDisable', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Cleanup pending',
        correlationId: 'req-bot-503',
      },
    });
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El material ya quedó excluido del asistente',
    );
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('keeps confirmed switch state unchanged and alerts on 403 and 503 toggle failures', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [BASE_ITEM],
    });
    mswServer.use(...store.handlers);

    renderPanel({ role: 'TEACHER' });
    const toggle = await screen.findByRole('switch', {
      name: /Habilitar «guia-bot-unidad-1\.pdf» para el asistente de estudio/,
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    store.failNext('botEnable', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        correlationId: 'req-bot-403',
      },
    });
    fireEvent.click(toggle);

    const forbiddenAlert = await screen.findByRole('alert');
    expect(forbiddenAlert).toHaveTextContent(
      'No tenés permiso para configurar el asistente de estudio en esta aula.',
    );
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(store.readBotStates()).toEqual([]);

    store.failNext('botEnable', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Timeout',
        correlationId: 'req-bot-503',
      },
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No pudimos confirmar si el cambio se guardó en el servidor',
      );
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('cancels overlapping bot-config GETs on toggle, preserves focus while toggling, and handles 403/500 config errors without unbounded polling', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [BASE_ITEM],
    });
    mswServer.use(...store.handlers);

    let releaseDelayedGet: (() => void) | undefined;
    let botGetCalls = 0;
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/:id/bot/materials`,
        async () => {
          botGetCalls += 1;
          if (botGetCalls === 2) {
            await new Promise<void>((resolve) => {
              releaseDelayedGet = resolve;
            });
            return HttpResponse.json({
              items: [],
              page: 1,
              pageSize: 100,
              total: 0,
            });
          }
          return HttpResponse.json({
            items: store.readBotStates(),
            page: 1,
            pageSize: 100,
            total: store.readBotStates().length,
          });
        },
      ),
    );

    const { queryClient } = renderPanel({ role: 'TEACHER' });
    const toggle = await screen.findByRole('switch', {
      name: /Habilitar «guia-bot-unidad-1\.pdf» para el asistente de estudio/,
    });

    // Trigger an overlapping GET and toggle while it is in flight (F-01).
    const overlappingRefetch = queryClient.refetchQueries();
    await waitFor(() => {
      expect(releaseDelayedGet).toBeDefined();
    });

    toggle.focus();
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);

    // Focus must remain on the switch while aria-disabled="true" (F-04).
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-disabled', 'true');

    expect(
      await screen.findByText('Material habilitado para el asistente'),
    ).toBeInTheDocument();
    releaseDelayedGet?.();
    await overlappingRefetch;

    // Delayed pre-toggle GET must not overwrite confirmed state.
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Listo para el bot')).toBeInTheDocument();

    // Terminal 403 on bot-config load disables switch without showing disabledHint (F-02, F-03).
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/:id/bot/materials`, () =>
        HttpResponse.json(
          {
            code: 'FORBIDDEN',
            message: 'Forbidden',
            correlationId: 'req-bot-load-403',
          },
          { status: 403 },
        ),
      ),
    );
    await queryClient.refetchQueries();
    expect(
      await screen.findByText('No pudimos consultar el asistente'),
    ).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByText('No pudimos confirmar el estado actual en el servidor.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reintentar estado del asistente' }),
    ).not.toBeInTheDocument();
  });
});
