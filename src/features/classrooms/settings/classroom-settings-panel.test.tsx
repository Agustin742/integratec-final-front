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
import { classroomDetailQueryKey } from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomDetailHandler,
  createClassroomInvitationsStore,
  createUpdateClassroomHandler,
  type ClassroomDetailPayload,
  type UpdateClassroomRequestPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ClassroomSettingsPanel } from './classroom-settings-panel';

vi.setConfig({ testTimeout: 20_000 });

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

const STAFF_CAPABILITIES: Capability[] = [
  'configure_classroom',
  'invite_members',
  'publish_content',
];

function renderSettings(
  options: {
    readonly capabilities?: Capability[];
    readonly detail?: Partial<ClassroomDetailPayload>;
  } = {},
) {
  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      name: 'Matemática 5to A',
      subject: 'Álgebra',
      myRole: 'TEACHER',
      capabilities: options.capabilities ?? STAFF_CAPABILITIES,
      ...options.detail,
    }),
  );
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(
    [{ path: '/classrooms/:classroomId', element: <ClassroomSettingsPanel /> }],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
  );
  const result = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );
  return { ...result, queryClient };
}

const nameField = () =>
  screen.findByRole('textbox', { name: /Nombre del aula/ });
const saveButton = () =>
  screen.getByRole('button', { name: 'Guardar cambios' });

describe('ClassroomSettingsPanel', () => {
  beforeAll(() => {
    mswServer.listen();
  });
  afterEach(() => {
    mswServer.resetHandlers();
  });
  afterAll(() => {
    mswServer.close();
  });

  it('prefills the form from the classroom and starts clean', async () => {
    renderSettings();

    expect(await nameField()).toHaveValue('Matemática 5to A');
    expect(screen.getByRole('textbox', { name: /Materia/ })).toHaveValue(
      'Álgebra',
    );
    expect(
      screen.getByRole('switch', { name: /Educación de adultos/ }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('Todo guardado')).toBeVisible();
  });

  it('lets staff choose the tutor bot skin and saves it', async () => {
    const bodies: UpdateClassroomRequestPayload[] = [];
    mswServer.use(
      createUpdateClassroomHandler({
        onRequest: (_request, _id, body) => {
          bodies.push(body);
        },
      }),
    );
    const { queryClient } = renderSettings({
      detail: { tutorBotSkin: 'graduate' },
    });
    await nameField();
    const group = screen.getByRole('group', { name: 'Apariencia del robot' });
    expect(within(group).getAllByRole('radio')).toHaveLength(8);
    expect(
      within(group).getByRole('radio', { name: 'Graduación' }),
    ).toBeChecked();

    fireEvent.click(within(group).getByRole('radio', { name: 'Gamer' }));
    fireEvent.click(saveButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ tutorBotSkin: 'gamer' });
    await waitFor(() => {
      expect(
        queryClient.getQueryData<{ tutorBotSkin: string }>(
          classroomDetailQueryKey(profile.id, CLASSROOM_ID),
        )?.tutorBotSkin,
      ).toBe('gamer');
    });
  });

  it('never overwrites a skin it does not know when staff change something else', async () => {
    const bodies: UpdateClassroomRequestPayload[] = [];
    mswServer.use(
      createUpdateClassroomHandler({
        onRequest: (_request, _id, body) => {
          bodies.push(body);
        },
      }),
    );
    renderSettings({
      detail: {
        tutorBotSkin: 'pirate' as ClassroomDetailPayload['tutorBotSkin'],
      },
    });

    fireEvent.change(await nameField(), { target: { value: 'Física 5to A' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ name: 'Física 5to A' });
    expect(bodies[0]).not.toHaveProperty('tutorBotSkin');
  });

  it('validates the name inline and does not send an invalid body', async () => {
    const onRequest = vi.fn();
    mswServer.use(createUpdateClassroomHandler({ onRequest }));
    renderSettings();

    const name = await nameField();
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.click(saveButton());

    expect(
      await screen.findByText('Ingresá el nombre del aula.'),
    ).toBeVisible();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('saves only through one PATCH, updates the detail cache and confirms', async () => {
    const bodies: UpdateClassroomRequestPayload[] = [];
    mswServer.use(
      createUpdateClassroomHandler({
        classroomId: CLASSROOM_ID,
        onRequest: (_request, _id, body) => {
          bodies.push(body);
        },
        resolveResponse: (_id, body) => ({
          id: CLASSROOM_ID,
          name: body.name ?? '',
          subject: (body.subject as string | null | undefined) ?? null,
          schoolId: null,
          independentTeacherId: profile.id,
          adultMode: body.adultMode ?? false,
          chatMuted: body.chatMuted ?? false,
          collaborationLocked: body.collaborationLocked ?? false,
          gamesDisabled: body.gamesDisabled ?? false,
          tutorBotSkin: 'none',
          myRole: 'TEACHER',
          capabilities: STAFF_CAPABILITIES,
          deskCount: 0,
          pet: null,
          availablePanels: ['settings'],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }),
      }),
    );
    const { queryClient } = renderSettings();

    fireEvent.change(await nameField(), {
      target: { value: '  Matemática 5to B  ' },
    });
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(screen.getByText('Tenés cambios sin guardar')).toBeVisible();
    fireEvent.click(saveButton());

    expect(await screen.findByText('Cambios guardados')).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      name: 'Matemática 5to B',
      subject: 'Álgebra',
      adultMode: false,
    });
    const cached = queryClient.getQueryData<{ name: string }>(
      classroomDetailQueryKey(profile.id, CLASSROOM_ID),
    );
    expect(cached?.name).toBe('Matemática 5to B');
    expect(saveButton()).toBeDisabled();
  });

  it('clears an emptied subject as null', async () => {
    const bodies: UpdateClassroomRequestPayload[] = [];
    mswServer.use(
      createUpdateClassroomHandler({
        classroomId: CLASSROOM_ID,
        onRequest: (_r, _id, body) => {
          bodies.push(body);
        },
      }),
    );
    renderSettings();

    fireEvent.change(await screen.findByRole('textbox', { name: /Materia/ }), {
      target: { value: '' },
    });
    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());

    await screen.findByText('Cambios guardados');
    expect(bodies[0]?.subject).toBeNull();
  });

  it('toggles adult mode and the classroom controls with their explanations', async () => {
    const bodies: UpdateClassroomRequestPayload[] = [];
    mswServer.use(
      createUpdateClassroomHandler({
        classroomId: CLASSROOM_ID,
        onRequest: (_r, _id, body) => {
          bodies.push(body);
        },
      }),
    );
    renderSettings();

    const adult = await screen.findByRole('switch', {
      name: /Educación de adultos/,
    });
    expect(adult).toHaveAccessibleDescription(/familiares|vínculos/i);
    fireEvent.click(adult);
    expect(adult).toHaveAttribute('aria-checked', 'true');

    const chat = screen.getByRole('switch', { name: /Silenciar el chat/ });
    fireEvent.click(chat);
    expect(chat).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(saveButton());
    await screen.findByText('Cambios guardados');
    expect(bodies[0]).toMatchObject({
      adultMode: true,
      chatMuted: true,
    });
    expect(bodies[0]).not.toHaveProperty('collaborationLocked');
    expect(bodies[0]).not.toHaveProperty('gamesDisabled');
  });

  it('discards pending edits back to the saved values', async () => {
    renderSettings();

    const name = await nameField();
    fireEvent.change(name, { target: { value: 'Otro nombre' } });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Descartar cambios' }),
    );

    await waitFor(() => expect(name).toHaveValue('Matemática 5to A'));
    expect(saveButton()).toBeDisabled();
  });

  it('maps a 400 field error onto the field and keeps the typed value', async () => {
    mswServer.use(
      createUpdateClassroomHandler({
        classroomId: CLASSROOM_ID,
        error: {
          status: 400,
          body: {
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            correlationId: 'corr-settings-400',
            details: [
              {
                field: 'name',
                messages: ['El nombre contiene caracteres no permitidos.'],
              },
            ],
          },
        },
      }),
    );
    renderSettings();

    const name = await nameField();
    fireEvent.change(name, { target: { value: 'Nombre nuevo' } });
    fireEvent.click(saveButton());

    expect(
      await screen.findByText('El nombre contiene caracteres no permitidos.'),
    ).toBeVisible();
    expect(name).toHaveValue('Nombre nuevo');
    expect(saveButton()).toBeEnabled();
  });

  it('shows a form-level error on 403 without losing the edits', async () => {
    mswServer.use(
      createUpdateClassroomHandler({
        classroomId: CLASSROOM_ID,
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Insufficient role',
            correlationId: 'corr-settings-403',
          },
        },
      }),
    );
    renderSettings();

    const name = await nameField();
    fireEvent.change(name, { target: { value: 'Nombre nuevo' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('No pudimos guardar el aula')).toBeVisible();
    expect(name).toHaveValue('Nombre nuevo');
  });

  it('tells the user when the server changed while they have unsaved edits', async () => {
    const { queryClient } = renderSettings();

    const name = await nameField();
    fireEvent.change(name, { target: { value: 'Mi borrador' } });

    mswServer.use(
      createClassroomDetailHandler(CLASSROOM_ID, {
        name: 'Renombrada por otro docente',
        subject: 'Álgebra',
        myRole: 'TEACHER',
        capabilities: STAFF_CAPABILITIES,
        updatedAt: '2026-02-02T00:00:00.000Z',
      }),
    );
    await queryClient.invalidateQueries({
      queryKey: classroomDetailQueryKey(profile.id, CLASSROOM_ID),
    });

    expect(await screen.findByText(/cambió mientras editabas/)).toBeVisible();
    expect(name).toHaveValue('Mi borrador');

    fireEvent.click(
      screen.getByRole('button', { name: 'Cargar valores del servidor' }),
    );
    await waitFor(() =>
      expect(name).toHaveValue('Renombrada por otro docente'),
    );
  });

  it('shows an error state with retry when the classroom cannot load', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`, () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: 'boom', correlationId: 'c' },
          { status: 500 },
        ),
      ),
    );
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const session = fakeSession(
      { status: 'authenticated', user: profile },
      client,
    );
    const router = createMemoryRouter(
      [
        {
          path: '/classrooms/:classroomId',
          element: <ClassroomSettingsPanel />,
        },
      ],
      { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
    );
    render(
      <ApiQueryProvider client={createAppQueryClient()}>
        <SessionProvider service={session.service}>
          <RouterProvider router={router} />
        </SessionProvider>
      </ApiQueryProvider>,
    );

    expect(
      await screen.findByText('No pudimos cargar la configuración'),
    ).toBeVisible();
  });

  it('renders non-disclosing permission denial without retry when the classroom returns 404', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`, () =>
        HttpResponse.json(
          { code: 'NOT_FOUND', message: 'nope', correlationId: 'c' },
          { status: 404 },
        ),
      ),
    );
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const session = fakeSession(
      { status: 'authenticated', user: profile },
      client,
    );
    const router = createMemoryRouter(
      [
        {
          path: '/classrooms/:classroomId',
          element: <ClassroomSettingsPanel />,
        },
      ],
      { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
    );
    render(
      <ApiQueryProvider client={createAppQueryClient()}>
        <SessionProvider service={session.service}>
          <RouterProvider router={router} />
        </SessionProvider>
      </ApiQueryProvider>,
    );

    expect(
      await screen.findByText('Sin permisos para configurar el aula'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Reintentar' }),
    ).not.toBeInTheDocument();
  });

  it('gates the panel behind configure_classroom', async () => {
    renderSettings({ capabilities: ['participate_activities'] });

    expect(
      await screen.findByText('Sin permisos para configurar el aula'),
    ).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /Nombre del aula/ }),
    ).not.toBeInTheDocument();
  });

  it('hides the access section when the caller cannot invite members', async () => {
    renderSettings({ capabilities: ['configure_classroom'] });

    await nameField();
    expect(
      screen.queryByRole('button', { name: /Códigos e invitaciones/ }),
    ).not.toBeInTheDocument();
  });

  it('embeds the existing invitations panel and copies a generated join code', async () => {
    const store = createClassroomInvitationsStore({
      classroomId: CLASSROOM_ID,
      initialInvitations: [],
    });
    mswServer.use(...store.handlers);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderSettings();

    const toggle = await screen.findByRole('button', {
      name: /Códigos e invitaciones/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: 'Generar código' }),
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Generar código' }),
    );
    const copy = await screen.findByRole('button', { name: 'Copiar código' });
    fireEvent.click(copy);

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const region = copy.closest('section') ?? document.body;
    expect(within(region).getByText('Código de acceso')).toBeVisible();
  });

  it('disables inputs and switches while PATCH is in flight and is accessible', async () => {
    let resolvePatch!: () => void;
    mswServer.use(
      http.patch(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`,
        () =>
          new Promise<Response>((resolve) => {
            resolvePatch = () =>
              resolve(
                HttpResponse.json({
                  id: CLASSROOM_ID,
                  name: 'Matemática 5to B',
                  subject: 'Álgebra',
                  adultMode: false,
                  chatMuted: false,
                  updatedAt: '2026-11-24T20:00:00.000Z',
                }),
              );
          }),
      ),
    );
    const { container } = renderSettings();
    const input = await nameField();
    await expectAccessible(container);

    fireEvent.change(input, { target: { value: 'Matemática 5to B' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(input).toBeDisabled());
    expect(screen.getByRole('textbox', { name: /Materia/ })).toBeDisabled();
    expect(
      screen.getByRole('switch', { name: /Educación de adultos/ }),
    ).toBeDisabled();

    resolvePatch();
    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveValue('Matemática 5to B');
  });

  it('reconciles detail and classroom list on uncertain 5xx settings save', async () => {
    mswServer.use(
      http.patch(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'fail',
              correlationId: 'c',
            },
          },
          { status: 500 },
        ),
      ),
    );
    const { queryClient } = renderSettings();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const input = await nameField();
    fireEvent.change(input, { target: { value: 'Nombre Incierto' } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: classroomDetailQueryKey(profile.id, CLASSROOM_ID),
        }),
      ),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ predicate: expect.any(Function) }),
    );
  });
});
