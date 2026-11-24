import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  TEST_API_BASE_URL,
  createClassroomAnnouncementsStore,
  createClassroomDetailHandler,
  type ClassroomAnnouncementItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { formatInstant } from '@/lib/dates';
import { classroomPanelCatalog } from '../panels/classroom-panel-catalog';
import { NoticeBoardPanel } from './notice-board-panel';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const OTHER_TEACHER_ID = '00000000-0000-4000-8000-000000000099';
const STUDENT_MENTION_ID = '00000000-0000-4000-8000-000000000055';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

function makeAnnouncement(
  overrides: Partial<ClassroomAnnouncementItem> = {},
): ClassroomAnnouncementItem {
  return {
    id: '00000000-0000-4000-8000-000000002001',
    classroomId: CLASSROOM_ID,
    authorId: profile.id,
    title: 'Recordatorio de TP',
    content: 'Entregar el viernes antes de las 18 hs.',
    mentionedUserIds: [],
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function renderNoticeBoardPanel(
  options: {
    readonly role?: 'TEACHER' | 'STUDENT' | 'ADMIN';
    readonly capabilities?: readonly Capability[];
    readonly classroomId?: string;
  } = {},
) {
  const classroomId = options.classroomId ?? CLASSROOM_ID;
  const role = options.role ?? 'TEACHER';
  const capabilities: Capability[] =
    options.capabilities !== undefined
      ? [...options.capabilities]
      : role === 'TEACHER'
        ? ['publish_content', 'configure_classroom']
        : role === 'ADMIN'
          ? ['manage_school', 'publish_content']
          : ['participate_activities'];

  mswServer.use(
    createClassroomDetailHandler(classroomId, {
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
        element: <NoticeBoardPanel />,
      },
    ],
    { initialEntries: [`/classrooms/${classroomId}`] },
  );

  const result = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );

  return { ...result, queryClient, router };
}

vi.setConfig({ testTimeout: 20_000 });

async function openComposer() {
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Escribir un anuncio para el aula',
    }),
  );
}

async function openMenu(title: string) {
  const trigger = await screen.findByRole('button', {
    name: `Acciones del anuncio «${title}»`,
  });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return trigger;
}

async function chooseMenuItem(title: string, label: 'Editar' | 'Eliminar') {
  await openMenu(title);
  fireEvent.click(await screen.findByRole('menuitem', { name: label }));
}

describe('NoticeBoardPanel', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  it('shows loading, empty state, and error/retry recovery for members', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
    });
    store.failNext('list', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        correlationId: 'req-500',
      },
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'STUDENT' });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando anuncios');

    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar el tablón de anuncios',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Todavía no hay anuncios',
      }),
    ).toBeInTheDocument();
  });

  it('lets a teacher publish, edit, and remove announcements after server confirmation', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      mentionDirectory: { Sofía: STUDENT_MENTION_ID },
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });

    expect(
      await screen.findByRole('heading', { name: 'Todavía no hay anuncios' }),
    ).toBeInTheDocument();

    await openComposer();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Clase de consulta' },
    });
    fireEvent.change(screen.getByLabelText('Contenido'), {
      target: { value: 'Nos vemos el jueves @Sofía' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    expect(await screen.findByText('Anuncio publicado')).toBeInTheDocument();
    const list = await screen.findByRole('list', {
      name: 'Anuncios publicados en el aula',
    });
    expect(within(list).getByText('Clase de consulta')).toBeInTheDocument();
    expect(
      within(list).getByText('Nos vemos el jueves @Sofía'),
    ).toBeInTheDocument();
    expect(within(list).getByText('1 mención')).toBeInTheDocument();

    // Edit the published announcement (moves focus to title input)
    await chooseMenuItem('Clase de consulta', 'Editar');
    expect(
      await screen.findByRole('heading', { name: 'Editar anuncio' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Clase de consulta (reprogramada)' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Anuncio actualizado')).toBeInTheDocument();
    expect(
      await within(list).findByText('Clase de consulta (reprogramada)'),
    ).toBeInTheDocument();
    expect(within(list).getByText(/Editado:/)).toBeInTheDocument();

    // Inline remove confirmation with focus handoff and post-remove heading focus
    await chooseMenuItem('Clase de consulta (reprogramada)', 'Eliminar');
    const cancelRemove = await within(list).findByRole('button', {
      name: 'Cancelar',
    });
    await waitFor(() => expect(cancelRemove).toHaveFocus());

    fireEvent.click(
      within(list).getByRole('button', { name: 'Confirmar eliminación' }),
    );
    expect(await screen.findByText('Anuncio eliminado')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Todavía no hay anuncios' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('heading', { name: 'Tablón de anuncios' }),
    ).toHaveFocus();
  });

  it('renders announcements chronologically for students without publish, edit, or delete controls', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      initialItems: [
        makeAnnouncement({
          id: '00000000-0000-4000-8000-000000002011',
          title: 'Primer aviso',
          createdAt: '2026-11-17T09:00:00.000Z',
          updatedAt: '2026-11-17T09:00:00.000Z',
        }),
        makeAnnouncement({
          id: '00000000-0000-4000-8000-000000002012',
          title: 'Segundo aviso',
          createdAt: '2026-11-18T11:00:00.000Z',
          updatedAt: '2026-11-18T11:00:00.000Z',
        }),
      ],
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'STUDENT' });

    const list = await screen.findByRole('list', {
      name: 'Anuncios publicados en el aula',
    });
    const headings = within(list).getAllByRole('heading', { level: 4 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Segundo aviso',
      'Primer aviso',
    ]);

    expect(
      screen.queryByRole('heading', { name: 'Publicar anuncio' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Escribir un anuncio para el aula',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Acciones del anuncio/ }),
    ).not.toBeInTheDocument();
  });

  it('renders user-supplied markup as plain text and never executes or injects HTML', async () => {
    const xssTitle = '<script>window.__xss=1</script>Aviso importante';
    const xssBody = '<img src=x onerror="alert(1)"><b>Texto</b> @Sofía';
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      initialItems: [
        makeAnnouncement({
          title: xssTitle,
          content: xssBody,
        }),
      ],
    });
    mswServer.use(...store.handlers);

    const { container } = renderNoticeBoardPanel({ role: 'STUDENT' });

    expect(await screen.findByText(xssTitle)).toBeInTheDocument();
    expect(screen.getByText(xssBody)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('clears the draft and confirms publication when a dropped create response was committed', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByRole('heading', { name: 'Todavía no hay anuncios' });

    store.failNext('create', 'drop-response');

    await openComposer();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Aviso con corte de red' },
    });
    fireEvent.change(screen.getByLabelText('Contenido'), {
      target: { value: 'Contenido que no se pierde.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    expect(await screen.findByText('Anuncio publicado')).toBeInTheDocument();
    expect(
      screen.queryByText(/No pudimos confirmar si se publicó/),
    ).not.toBeInTheDocument();

    // The composer folds back into its prompt once the notice is published.
    expect(
      await screen.findByRole('button', {
        name: 'Escribir un anuncio para el aula',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();

    const list = await screen.findByRole('list', {
      name: 'Anuncios publicados en el aula',
    });
    expect(within(list).getAllByText('Aviso con corte de red')).toHaveLength(1);
    expect(store.getItems()).toHaveLength(1);
  });

  it('keeps the draft and warns about duplicates when a failed create was not committed', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByRole('heading', { name: 'Todavía no hay anuncios' });

    store.failNext('create', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        correlationId: 'req-create-500',
      },
    });

    await openComposer();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Aviso que no se guardó' },
    });
    fireEvent.change(screen.getByLabelText('Contenido'), {
      target: { value: 'Contenido que no se pierde.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    expect(
      await screen.findByText(/No pudimos confirmar si se publicó/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Anuncio publicado')).not.toBeInTheDocument();

    expect(screen.getByLabelText('Título')).toHaveValue(
      'Aviso que no se guardó',
    );
    expect(screen.getByLabelText('Contenido')).toHaveValue(
      'Contenido que no se pierde.',
    );
    expect(
      await screen.findByRole('heading', { name: 'Todavía no hay anuncios' }),
    ).toBeInTheDocument();
    expect(store.getItems()).toHaveLength(0);
  });

  it('allows school admin to edit/remove another teacher announcement while regular teacher cannot', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: OTHER_TEACHER_ID,
      initialItems: [
        makeAnnouncement({
          authorId: OTHER_TEACHER_ID,
          title: 'Aviso de otro docente',
        }),
      ],
    });
    mswServer.use(...store.handlers);

    const { unmount } = renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByText('Aviso de otro docente');
    expect(
      screen.queryByRole('button', { name: /^Acciones del anuncio/ }),
    ).not.toBeInTheDocument();
    unmount();

    renderNoticeBoardPanel({ role: 'ADMIN' });
    await screen.findByText('Aviso de otro docente');
    await chooseMenuItem('Aviso de otro docente', 'Editar');
    expect(
      await screen.findByRole('heading', { name: 'Editar anuncio' }),
    ).toBeInTheDocument();
  });

  it('validates client boundaries and preserves draft on server 400 rejection', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByRole('heading', { name: 'Todavía no hay anuncios' });

    // Empty submit triggers client validation without calling server
    await openComposer();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));
    expect(
      await screen.findByText('Ingresá un título para el anuncio.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ingresá el contenido del anuncio.'),
    ).toBeInTheDocument();

    // Whitespace-only title triggers required validation
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: '   ' },
    });
    fireEvent.change(screen.getByLabelText('Contenido'), {
      target: { value: 'Contenido válido.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));
    expect(
      await screen.findByText('Ingresá un título para el anuncio.'),
    ).toBeInTheDocument();

    // Server 400 rejection preserves user draft
    store.failNext('create', {
      status: 400,
      body: {
        code: 'BAD_REQUEST',
        message: 'Demasiadas menciones.',
        correlationId: 'req-400',
        details: [{ field: 'content', messages: ['Máximo 20 menciones.'] }],
      },
    });
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Título válido' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));
    expect(await screen.findByText('Máximo 20 menciones.')).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue('Título válido');
    expect(screen.getByLabelText('Contenido')).toHaveValue('Contenido válido.');
  });

  it('clears cached announcements and form if a refetch returns 403 or 404 (F-01)', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      initialItems: [makeAnnouncement({ title: 'Aviso privado' })],
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByText('Aviso privado');

    // Simulate access revocation (403 on list refetch triggered by 404 remove reconcile)
    store.failNext('remove', {
      status: 404,
      body: {
        code: 'NOT_FOUND',
        message: 'Not found',
        correlationId: 'req-404',
      },
    });
    store.failNext('list', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        correlationId: 'req-403',
      },
    });

    await chooseMenuItem('Aviso privado', 'Eliminar');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirmar eliminación' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'No tenés acceso a los anuncios',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Aviso privado')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Publicar anuncio' }),
    ).not.toBeInTheDocument();
  });

  it('supports manage_school edit without publish_content and paginates announcements', async () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      makeAnnouncement({
        id: `00000000-0000-4000-8000-${String(3000 + index).padStart(12, '0')}`,
        authorId: OTHER_TEACHER_ID,
        title: `Aviso ${String(index + 1).padStart(2, '0')}`,
        createdAt: `2026-11-${String(10 + index).padStart(2, '0')}T10:00:00.000Z`,
        updatedAt: `2026-11-${String(10 + index).padStart(2, '0')}T10:00:00.000Z`,
      }),
    );
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: OTHER_TEACHER_ID,
      initialItems: items,
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({
      role: 'ADMIN',
      capabilities: ['manage_school'],
    });

    await screen.findByText('Aviso 12');
    expect(
      screen.queryByRole('heading', { name: 'Publicar anuncio' }),
    ).not.toBeInTheDocument();

    // Clicking Editar opens the edit form even without publish_content
    await chooseMenuItem('Aviso 12', 'Editar');
    expect(
      await screen.findByRole('heading', { name: 'Editar anuncio' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edición' }));

    // Paginate to page 2
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Aviso 01')).toBeInTheDocument();
  });

  it('closes the edit form and shows an error notice when the edited announcement is gone (404)', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      initialItems: [makeAnnouncement({ title: 'Aviso a editar' })],
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByText('Aviso a editar');

    await chooseMenuItem('Aviso a editar', 'Editar');
    expect(
      await screen.findByRole('heading', { name: 'Editar anuncio' }),
    ).toBeInTheDocument();

    store.failNext('update', {
      status: 404,
      body: {
        code: 'NOT_FOUND',
        message: 'Announcement not found.',
        correlationId: 'req-update-404',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText(/ya no existen o dejaron de ser accesibles/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Editar anuncio' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Escribir un anuncio para el aula' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Tablón de anuncios' }),
    ).toHaveFocus();
  });

  it('treats a delete 404 as already removed without a destructive alert', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      initialItems: [makeAnnouncement({ title: 'Aviso ya borrado' })],
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByText('Aviso ya borrado');

    // Someone else removes it first, so the teacher's own DELETE gets a real 404.
    const [existing] = store.getItems();
    await fetch(
      `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/announcements/${existing!.id}`,
      { method: 'DELETE' },
    );
    await chooseMenuItem('Aviso ya borrado', 'Eliminar');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirmar eliminación' }),
    );

    expect(
      await screen.findByText('El anuncio ya no estaba'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Alguien lo eliminó antes. Actualizamos el tablón.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No pudimos eliminar el anuncio'),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Tablón de anuncios' }),
      ).toHaveFocus();
    });
  });

  it('moves focus to the board heading after a successful edit save', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      initialItems: [makeAnnouncement({ title: 'Aviso a guardar' })],
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByText('Aviso a guardar');

    await chooseMenuItem('Aviso a guardar', 'Editar');
    fireEvent.change(await screen.findByLabelText('Título'), {
      target: { value: 'Aviso guardado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Editar anuncio' }),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Tablón de anuncios' }),
      ).toHaveFocus();
    });
  });

  it.each(['edit', 'create'] as const)(
    'locks the notice action menus while a %s submit is in flight',
    async (flow) => {
      const store = createClassroomAnnouncementsStore({
        classroomId: CLASSROOM_ID,
        authorId: profile.id,
        initialItems: [
          makeAnnouncement({
            id: '00000000-0000-4000-8000-000000002101',
            title: 'Primer aviso',
            createdAt: '2026-11-17T09:00:00.000Z',
            updatedAt: '2026-11-17T09:00:00.000Z',
          }),
          makeAnnouncement({
            id: '00000000-0000-4000-8000-000000002102',
            title: 'Segundo aviso',
            createdAt: '2026-11-18T09:00:00.000Z',
            updatedAt: '2026-11-18T09:00:00.000Z',
          }),
        ],
      });
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const savedItem = makeAnnouncement({
        id: '00000000-0000-4000-8000-000000002103',
        title: 'Guardado',
      });
      const slow = flow === 'edit' ? http.patch : http.post;
      const path =
        flow === 'edit'
          ? `${TEST_API_BASE_URL}/classrooms/:id/announcements/:announcementId`
          : `${TEST_API_BASE_URL}/classrooms/:id/announcements`;
      mswServer.use(
        ...store.handlers,
        slow(path, async () => {
          await gate;
          return HttpResponse.json(savedItem, {
            status: flow === 'edit' ? 200 : 201,
          });
        }),
      );

      renderNoticeBoardPanel({ role: 'TEACHER' });
      await screen.findByText('Primer aviso');

      if (flow === 'edit') {
        await chooseMenuItem('Segundo aviso', 'Editar');
        fireEvent.click(
          await screen.findByRole('button', { name: 'Guardar cambios' }),
        );
      } else {
        await openComposer();
        fireEvent.change(screen.getByLabelText('Título'), {
          target: { value: 'Nuevo aviso' },
        });
        fireEvent.change(screen.getByLabelText('Contenido'), {
          target: { value: 'Contenido nuevo.' },
        });
        fireEvent.click(
          screen.getByRole('button', { name: 'Publicar anuncio' }),
        );
      }

      await waitFor(() => {
        for (const button of screen.getAllByRole('button', {
          name: /^Acciones del anuncio/,
        })) {
          expect(button).toBeDisabled();
        }
      });
      expect(
        screen.getAllByRole('button', { name: /^Acciones del anuncio/ }),
      ).toHaveLength(2);

      release();

      await waitFor(() => {
        for (const button of screen.getAllByRole('button', {
          name: /^Acciones del anuncio/,
        })) {
          expect(button).toBeEnabled();
        }
      });
    },
  );

  it('shows who published each notice with role, relative age, absolute date and the full body', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: OTHER_TEACHER_ID,
      initialItems: [
        makeAnnouncement({
          authorId: OTHER_TEACHER_ID,
          title: 'Aviso con autor',
          content: 'Primera línea del aviso.\nSegunda línea del aviso.',
          createdAt: threeHoursAgo,
          updatedAt: threeHoursAgo,
        }),
      ],
    });
    mswServer.use(
      ...store.handlers,
      http.get(`${TEST_API_BASE_URL}/classrooms/:id/members`, () =>
        HttpResponse.json({
          items: [
            {
              id: OTHER_TEACHER_ID,
              userId: OTHER_TEACHER_ID,
              displayName: 'Prof. Ana García',
              role: 'TEACHER',
            },
          ],
          page: 1,
          pageSize: 100,
          total: 1,
        }),
      ),
    );

    renderNoticeBoardPanel({
      role: 'STUDENT',
      capabilities: ['participate_activities', 'list_directory'],
    });

    const note = (
      await screen.findByRole('heading', { name: 'Aviso con autor' })
    ).closest('article')!;
    expect(await within(note).findByText('Prof. Ana García')).toBeVisible();
    expect(within(note).getByText('Docente')).toBeInTheDocument();
    expect(within(note).getByText('AG')).toHaveAttribute('aria-hidden', 'true');

    const age = within(note).getByText('hace 3 horas');
    const time = age.closest('time')!;
    expect(time).toHaveAttribute('datetime', threeHoursAgo);
    expect(time).toHaveAttribute('title', formatInstant(threeHoursAgo));
    expect(within(note).getByText(formatInstant(threeHoursAgo))).toBeVisible();

    const body = within(note).getByText(/Primera línea del aviso\./);
    expect(body.textContent).toBe(
      'Primera línea del aviso.\nSegunda línea del aviso.',
    );
    expect(body.className).toContain('whitespace-pre-wrap');
  });

  it('labels your own notices "Vos" and falls back to a neutral author without the directory', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      initialItems: [
        makeAnnouncement({
          id: '00000000-0000-4000-8000-000000002201',
          title: 'Aviso propio',
        }),
        makeAnnouncement({
          id: '00000000-0000-4000-8000-000000002202',
          authorId: OTHER_TEACHER_ID,
          title: 'Aviso ajeno',
        }),
      ],
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });

    const own = (
      await screen.findByRole('heading', { name: 'Aviso propio' })
    ).closest('article')!;
    expect(within(own).getByText('Vos')).toBeInTheDocument();
    const other = screen
      .getByRole('heading', { name: 'Aviso ajeno' })
      .closest('article')!;
    expect(within(other).getByText('Equipo docente')).toBeInTheDocument();
  });

  it('invites teachers to write the first notice and tells students nothing is posted yet', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
    });
    mswServer.use(...store.handlers);

    const { unmount } = renderNoticeBoardPanel({ role: 'TEACHER' });
    expect(
      await screen.findByText(
        'Escribí el primer aviso para que lo vea todo el aula.',
      ),
    ).toBeInTheDocument();
    unmount();

    renderNoticeBoardPanel({ role: 'STUDENT' });
    expect(
      await screen.findByText(
        'Cuando un docente publique un aviso, va a aparecer acá en orden cronológico.',
      ),
    ).toBeInTheDocument();
  });

  it('registers the notice board as a wide panel', () => {
    const entry = classroomPanelCatalog.find((item) => item.key === 'notices');
    expect(entry).toMatchObject({ wide: true });
  });
});
