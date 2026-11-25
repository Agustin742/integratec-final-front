import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  TEST_API_BASE_URL,
  createClassroomMaterialsStore,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  CLASSROOM_ID,
  MODULE_1,
  MODULE_2,
  MODULE_3,
  THREE_MODULES,
  materialFixture,
  moduleFixture,
  renderMaterialPanel,
} from './material-test-utils';

vi.setConfig({ testTimeout: 20_000 });

function openMenu(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

async function chooseMenuItem(triggerName: string, itemName: string) {
  const trigger = await screen.findByRole('button', { name: triggerName });
  openMenu(trigger);
  const menu = await screen.findByRole('menu');
  fireEvent.click(within(menu).getByRole('menuitem', { name: itemName }));
}

async function moduleSection(name: string) {
  return screen.findByRole('region', { name });
}

function moduleNames(): string[] {
  return screen
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

describe('MaterialPanel modules', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => {
    mswServer.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => mswServer.close());

  it('lists the modules in server order with description and file count, loading no files until one opens', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      initialItems: [
        materialFixture(
          '00000000-0000-4000-8000-000000001001',
          'a.pdf',
          MODULE_1,
        ),
        materialFixture(
          '00000000-0000-4000-8000-000000001002',
          'b.pdf',
          MODULE_1,
        ),
        materialFixture('00000000-0000-4000-8000-000000001003', 'c.pdf', null),
      ],
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    const first = await moduleSection('Unidad 1');
    expect(moduleNames()).toEqual([
      'Unidad 1',
      'Unidad 2',
      'Unidad 3',
      'Sin módulo',
    ]);
    expect(within(first).getByText('Funciones y gráficos')).toBeInTheDocument();
    expect(within(first).getByText('2 archivos')).toBeInTheDocument();
    expect(
      within(await moduleSection('Unidad 2')).getByText('0 archivos'),
    ).toBeInTheDocument();
    expect(
      within(await moduleSection('Sin módulo')).getByText('1 archivo'),
    ).toBeInTheDocument();

    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument();
    expect(store.listCalls.filter((id) => id === MODULE_1)).toHaveLength(0);
    expect(store.listCalls.filter((id) => id === MODULE_2)).toHaveLength(0);
  });

  it('expands a module lazily, requesting only that module files, and collapses it again', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      initialItems: [
        materialFixture(
          '00000000-0000-4000-8000-000000001001',
          'a.pdf',
          MODULE_1,
        ),
        materialFixture(
          '00000000-0000-4000-8000-000000001002',
          'otro.pdf',
          MODULE_2,
        ),
      ],
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'STUDENT' });

    const toggle = await screen.findByRole('button', { name: 'Unidad 1' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);

    expect(await screen.findByText('a.pdf')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('otro.pdf')).not.toBeInTheDocument();
    expect(store.listCalls.filter((id) => id === MODULE_1)).toHaveLength(1);
    expect(store.listCalls.filter((id) => id === MODULE_2)).toHaveLength(0);

    fireEvent.click(toggle);
    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('paginates the files of one module independently', async () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      materialFixture(
        `00000000-0000-4000-8000-0000000011${String(index).padStart(2, '0')}`,
        `archivo-${String(index).padStart(2, '0')}.pdf`,
        MODULE_1,
        `2026-11-18T03:${String(index).padStart(2, '0')}:00.000Z`,
      ),
    );
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      initialItems: items,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'STUDENT' });

    fireEvent.click(await screen.findByRole('button', { name: 'Unidad 1' }));
    expect(await screen.findByText('archivo-11.pdf')).toBeInTheDocument();
    expect(screen.queryByText('archivo-00.pdf')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('archivo-00.pdf')).toBeInTheDocument();
  });

  it('shows an intentional empty state inside a module without files', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    fireEvent.click(await screen.findByRole('button', { name: 'Unidad 2' }));
    expect(
      await screen.findByText('Este módulo todavía no tiene archivos'),
    ).toBeInTheDocument();
  });

  it('shows the panel empty state with a way to create the first module when nothing exists', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    expect(
      await screen.findByText('Todavía no hay material publicado'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Crear el primer módulo' }),
    ).toHaveLength(1);
  });

  it('creates a module from the dialog and appends it at the end', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: [moduleFixture(MODULE_1, 'Unidad 1', 0)],
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 1');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo módulo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo módulo' });
    fireEvent.change(within(dialog).getByLabelText('Nombre del módulo'), {
      target: { value: '  Unidad 2  ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Descripción (opcional)'), {
      target: { value: 'Trigonometría' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Crear módulo' }),
    );

    expect(await screen.findByText('Módulo creado')).toBeInTheDocument();
    await waitFor(() =>
      expect(moduleNames()).toEqual(['Unidad 1', 'Unidad 2']),
    );
    expect(store.readModules().map((entry) => entry.name)).toEqual([
      'Unidad 1',
      'Unidad 2',
    ]);
    expect(screen.getByText('Trigonometría')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Nuevo módulo' }),
    ).not.toBeInTheDocument();
  });

  it('validates the module name before calling the server', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: [moduleFixture(MODULE_1, 'Unidad 1', 0)],
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 1');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo módulo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo módulo' });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Crear módulo' }),
    );

    expect(
      await within(dialog).findByText('Escribí un nombre para el módulo.'),
    ).toBeInTheDocument();
    expect(store.readModules()).toHaveLength(1);
  });

  it('explains the module cap when the server answers 409', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: [moduleFixture(MODULE_1, 'Unidad 1', 0)],
      moduleCap: 1,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 1');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo módulo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo módulo' });
    fireEvent.change(within(dialog).getByLabelText('Nombre del módulo'), {
      target: { value: 'Unidad 2' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Crear módulo' }),
    );

    expect(
      await within(dialog).findByText(
        'Llegaste al máximo de 100 módulos por aula. Eliminá alguno para crear otro.',
      ),
    ).toBeInTheDocument();
    expect(store.readModules()).toHaveLength(1);
  });

  it('disables new modules up front once the cap is reached', async () => {
    const many = Array.from({ length: 100 }, (_, index) =>
      moduleFixture(
        `00000000-0000-4000-8000-${String(3000 + index).padStart(12, '0')}`,
        `Módulo ${index + 1}`,
        index,
      ),
    );
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: many,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Módulo 1');
    expect(screen.getByRole('button', { name: 'Nuevo módulo' })).toBeDisabled();
    expect(
      screen.getByText(/Llegaste al máximo de 100 módulos/),
    ).toBeInTheDocument();
  });

  it('renames a module and edits its description', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 2');
    await chooseMenuItem('Más acciones de «Unidad 2»', 'Editar módulo');
    const dialog = await screen.findByRole('dialog', { name: 'Editar módulo' });
    const name = within(dialog).getByLabelText('Nombre del módulo');
    expect(name).toHaveValue('Unidad 2');
    fireEvent.change(name, { target: { value: 'Álgebra' } });
    fireEvent.change(within(dialog).getByLabelText('Descripción (opcional)'), {
      target: { value: 'Ecuaciones' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar cambios' }),
    );

    expect(await screen.findByText('Módulo actualizado')).toBeInTheDocument();
    expect(await moduleSection('Álgebra')).toBeInTheDocument();
    expect(store.readModules()[1]).toMatchObject({
      name: 'Álgebra',
      description: 'Ecuaciones',
    });
  });

  it('asks for confirmation before deleting a module and moves its files to Sin módulo', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      initialItems: [
        materialFixture(
          '00000000-0000-4000-8000-000000001001',
          'a.pdf',
          MODULE_1,
        ),
        materialFixture(
          '00000000-0000-4000-8000-000000001002',
          'b.pdf',
          MODULE_1,
        ),
      ],
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 1');
    await chooseMenuItem('Más acciones de «Unidad 1»', 'Eliminar módulo');
    const dialog = await screen.findByRole('dialog', {
      name: '¿Eliminar el módulo «Unidad 1»?',
    });
    expect(
      within(dialog).getByText(/2 archivos no se borran: pasan a «Sin módulo»/),
    ).toBeInTheDocument();
    expect(store.readModules()).toHaveLength(3);

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Sí, eliminar módulo' }),
    );

    expect(await screen.findByText('Módulo eliminado')).toBeInTheDocument();
    await waitFor(() =>
      expect(moduleNames()).toEqual(['Unidad 2', 'Unidad 3', 'Sin módulo']),
    );
    expect(store.read().every((item) => item.moduleId === null)).toBe(true);
    expect(
      within(await moduleSection('Sin módulo')).getByText('2 archivos'),
    ).toBeInTheDocument();
  });

  it('keeps the module when the deletion is cancelled', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 1');
    await chooseMenuItem('Más acciones de «Unidad 1»', 'Eliminar módulo');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(store.readModules()).toHaveLength(3);
  });

  it('reorders modules with the up and down buttons', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 1');
    expect(
      screen.getByRole('button', { name: 'Mover «Unidad 1» hacia arriba' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Mover «Unidad 3» hacia abajo' }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Mover «Unidad 1» hacia abajo' }),
    );

    await waitFor(() =>
      expect(moduleNames()).toEqual(['Unidad 2', 'Unidad 1', 'Unidad 3']),
    );
    expect(store.readModules().map((entry) => entry.id)).toEqual([
      MODULE_2,
      MODULE_1,
      MODULE_3,
    ]);
    expect(
      await screen.findByText('«Unidad 1» ahora está en la posición 2 de 3.'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Mover «Unidad 3» hacia arriba' }),
    );
    await waitFor(() =>
      expect(moduleNames()).toEqual(['Unidad 2', 'Unidad 3', 'Unidad 1']),
    );
  });

  it('uploads a file straight into a module sending its moduleId', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 2');
    fireEvent.click(
      screen.getByRole('button', { name: 'Agregar archivo a «Unidad 2»' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Subir material a «Unidad 2»',
    });
    const input = dialog.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['%PDF-1.4'], 'guia.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Subir archivo' }),
    );

    await waitFor(() => expect(store.read()).toHaveLength(1));
    expect(store.read()[0]).toMatchObject({ moduleId: MODULE_2 });
    expect(await screen.findByText('Material publicado')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Unidad 2' })).getByText(
          '1 archivo',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('moves a material to another module from the overflow menu', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      initialItems: [
        materialFixture(
          '00000000-0000-4000-8000-000000001001',
          'mover.pdf',
          MODULE_1,
        ),
      ],
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    fireEvent.click(await screen.findByRole('button', { name: 'Unidad 1' }));
    await screen.findByText('mover.pdf');
    await chooseMenuItem('Más acciones de «mover.pdf»', 'Mover a otro módulo');
    const dialog = await screen.findByRole('dialog', {
      name: 'Mover «mover.pdf»',
    });
    const select = within(dialog).getByLabelText('Módulo de destino');
    expect(select).toHaveValue(MODULE_1);
    expect(
      within(select).getByRole('option', { name: 'Sin módulo' }),
    ).toBeInTheDocument();
    fireEvent.change(select, { target: { value: MODULE_3 } });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Mover archivo' }),
    );

    expect(await screen.findByText('Archivo movido')).toBeInTheDocument();
    expect(store.read()[0]?.moduleId).toBe(MODULE_3);
    await waitFor(() =>
      expect(screen.queryByText('mover.pdf')).not.toBeInTheDocument(),
    );
  });

  it('moves a material back to Sin módulo', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      initialItems: [
        materialFixture(
          '00000000-0000-4000-8000-000000001001',
          'suelto.pdf',
          MODULE_1,
        ),
      ],
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    fireEvent.click(await screen.findByRole('button', { name: 'Unidad 1' }));
    await screen.findByText('suelto.pdf');
    await chooseMenuItem('Más acciones de «suelto.pdf»', 'Mover a otro módulo');
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Módulo de destino'), {
      target: { value: '' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Mover archivo' }),
    );

    await waitFor(() => expect(store.read()[0]?.moduleId).toBeNull());
  });

  it('shows the structure read-only to students, who can still download', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      initialItems: [
        materialFixture(
          '00000000-0000-4000-8000-000000001001',
          'lectura.pdf',
          MODULE_1,
        ),
        materialFixture(
          '00000000-0000-4000-8000-000000001002',
          'suelta.pdf',
          null,
        ),
      ],
      canWrite: false,
      signedUrlBase: 'https://signed.example.test/files',
    });
    mswServer.use(...store.handlers);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderMaterialPanel({ role: 'STUDENT' });

    await moduleSection('Unidad 1');
    expect(moduleNames()).toEqual([
      'Unidad 1',
      'Unidad 2',
      'Unidad 3',
      'Sin módulo',
    ]);
    expect(
      screen.queryByRole('button', { name: 'Nuevo módulo' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /hacia arriba/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Agregar archivo/ }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Unidad 1' }));
    await screen.findByText('lectura.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://signed.example.test/files/'),
        '_blank',
        'noopener,noreferrer',
      ),
    );
  });

  it('hides the Sin módulo section from students when nothing is unassigned', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'STUDENT' });

    await moduleSection('Unidad 1');
    expect(moduleNames()).toEqual(['Unidad 1', 'Unidad 2', 'Unidad 3']);
  });

  it('shows an error state with retry when the module list fails', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
    store.failNext('moduleList', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'boom',
        correlationId: 'req-modules-500',
      },
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    expect(
      await screen.findByText('No pudimos cargar el material'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByText('Todavía no hay material publicado'),
    ).toBeInTheDocument();
  });

  it('shows an inline error with retry when one module files fail to load', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      initialItems: [
        materialFixture(
          '00000000-0000-4000-8000-000000001001',
          'a.pdf',
          MODULE_1,
        ),
      ],
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 1');
    store.failNext('list', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'boom',
        correlationId: 'req-list-500',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unidad 1' }));
    const section = await moduleSection('Unidad 1');
    expect(
      await within(section).findByText('No pudimos cargar los archivos'),
    ).toBeInTheDocument();
    fireEvent.click(
      within(section).getByRole('button', { name: 'Reintentar' }),
    );
    expect(await screen.findByText('a.pdf')).toBeInTheDocument();
  });

  it('reports a forbidden module action without changing the list', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
      canWrite: false,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await moduleSection('Unidad 1');
    fireEvent.click(
      screen.getByRole('button', { name: 'Mover «Unidad 1» hacia abajo' }),
    );

    expect(
      await screen.findByText('No pudimos reordenar los módulos'),
    ).toBeInTheDocument();
    expect(moduleNames().slice(0, 3)).toEqual([
      'Unidad 1',
      'Unidad 2',
      'Unidad 3',
    ]);
  });

  it('closes an open upload dialog immediately when publish_content capability is revoked', async () => {
    let capabilities: Array<'publish_content' | 'configure_bot'> = [
      'publish_content',
    ];
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
    });
    mswServer.use(...store.handlers);
    const { queryClient } = renderMaterialPanel({ role: 'TEACHER' });
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`, () =>
        HttpResponse.json({
          id: CLASSROOM_ID,
          name: 'Matemática 5to A',
          subject: null,
          schoolId: null,
          independentTeacherId: null,
          adultMode: false,
          chatMuted: false,
          collaborationLocked: false,
          gamesDisabled: false,
          myRole: capabilities.includes('publish_content')
            ? 'TEACHER'
            : 'STUDENT',
          capabilities,
          availablePanels: ['material'],
          deskCount: 12,
          pet: null,
          createdAt: '2026-11-18T10:00:00.000Z',
          updatedAt: '2026-11-18T10:00:00.000Z',
        }),
      ),
    );
    await moduleSection('Unidad 1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Agregar archivo a «Unidad 1»' }),
    );
    expect(
      await screen.findByRole('dialog', {
        name: 'Subir material a «Unidad 1»',
      }),
    ).toBeVisible();

    capabilities = [];
    await queryClient.invalidateQueries();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: 'Subir material a «Unidad 1»',
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it('reconciles modules after an uncertain 500 module creation error', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: THREE_MODULES,
    });
    mswServer.use(...store.handlers);
    let invalidated = false;
    const { queryClient } = renderMaterialPanel({ role: 'TEACHER' });
    const origInvalidate = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((...args) => {
      invalidated = true;
      return origInvalidate(...args);
    });

    await moduleSection('Unidad 1');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo módulo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo módulo' });
    fireEvent.change(within(dialog).getByLabelText('Nombre del módulo'), {
      target: { value: 'Unidad 4' },
    });
    store.failNext('moduleCreate', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'timeout',
        correlationId: 'corr-mod-500',
      },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Crear módulo' }),
    );

    await waitFor(() => expect(invalidated).toBe(true));
    expect(
      await within(dialog).findByText(
        /No pudimos confirmar si el cambio se guardó en el servidor/,
      ),
    ).toBeVisible();
  });
});
