import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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
    fireEvent.click(within(list).getByRole('button', { name: 'Editar' }));
    expect(
      screen.getByRole('heading', { name: 'Editar anuncio' }),
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
    const removeButton = within(list).getByRole('button', { name: 'Eliminar' });
    fireEvent.click(removeButton);
    const cancelRemove = within(list).getByRole('button', {
      name: 'Cancelar',
    });
    expect(cancelRemove).toHaveFocus();

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
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Eliminar' }),
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

  it('preserves draft input on failed submit and reconciles uncertain 5xx/dropped writes', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
    });
    mswServer.use(...store.handlers);

    renderNoticeBoardPanel({ role: 'TEACHER' });
    await screen.findByRole('heading', { name: 'Todavía no hay anuncios' });

    store.failNext('create', 'drop-response');

    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Aviso con corte de red' },
    });
    fireEvent.change(screen.getByLabelText('Contenido'), {
      target: { value: 'Contenido que no se pierde.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    expect(
      await screen.findByText(/No pudimos confirmar si el servidor guardó/),
    ).toBeInTheDocument();

    // Draft stays editable
    expect(screen.getByLabelText('Título')).toHaveValue(
      'Aviso con corte de red',
    );
    expect(screen.getByLabelText('Contenido')).toHaveValue(
      'Contenido que no se pierde.',
    );

    // Reconciliation refetched the persisted announcement from the server
    const list = await screen.findByRole('list', {
      name: 'Anuncios publicados en el aula',
    });
    expect(
      within(list).getByText('Aviso con corte de red'),
    ).toBeInTheDocument();
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
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Eliminar' }),
    ).not.toBeInTheDocument();
    unmount();

    renderNoticeBoardPanel({ role: 'ADMIN' });
    await screen.findByText('Aviso de otro docente');
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Eliminar' }),
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

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar eliminación' }),
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]!);
    expect(
      screen.getByRole('heading', { name: 'Editar anuncio' }),
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

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(
      screen.getByRole('heading', { name: 'Editar anuncio' }),
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
      screen.getByRole('heading', { name: 'Publicar anuncio' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Tablón de anuncios' }),
    ).toHaveFocus();
  });

  it.each(['edit', 'create'] as const)(
    'locks row Edit and Remove while a %s submit is in flight',
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
        fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]!);
        fireEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );
      } else {
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
          name: /^(Editar|Eliminar)$/,
        })) {
          expect(button).toBeDisabled();
        }
      });
      expect(
        screen.getAllByRole('button', { name: /^(Editar|Eliminar)$/ }),
      ).toHaveLength(4);

      release();

      await waitFor(() => {
        for (const button of screen.getAllByRole('button', {
          name: /^(Editar|Eliminar)$/,
        })) {
          expect(button).toBeEnabled();
        }
      });
    },
  );
});
