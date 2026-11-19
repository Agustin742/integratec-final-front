import { fireEvent, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
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
  TEST_API_BASE_URL,
  createClassroomDetailHandler,
  createClassroomMaterialsStore,
  type ClassroomMaterialItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { MaterialPanel } from './material-panel';

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
      initialBotStates: [
        {
          materialId: MATERIAL_ID,
          classroomId: CLASSROOM_ID,
          botEnabled: true,
          indexingStatus: 'ready',
          indexingError: null,
          updatedAt: '2026-11-19T01:00:00.000Z',
        },
      ],
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
    expect(screen.getByText('Indexando…')).toBeInTheDocument();

    store.setBotState(MATERIAL_ID, {
      botEnabled: true,
      indexingStatus: 'ready',
    });
    await queryClient.invalidateQueries();
    expect(await screen.findByText('Listo para el bot')).toBeInTheDocument();

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
        {
          materialId: MATERIAL_ID,
          classroomId: CLASSROOM_ID,
          botEnabled: true,
          indexingStatus: 'failed',
          indexingError: '<img src=x onerror=alert(1)> PDF sin texto extraíble',
          updatedAt: '2026-11-19T01:00:00.000Z',
        },
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

    store.failNext('botToggle', {
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

    store.failNext('botToggle', {
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
});
