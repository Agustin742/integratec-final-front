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
import { profile } from '@/session/test-fixtures';
import {
  TEST_API_BASE_URL,
  createClassroomMaterialsStore,
  type ClassroomMaterialItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { MATERIAL_MAX_SIZE_BYTES } from './material-schema';
import {
  CLASSROOM_ID,
  MATERIAL_ID,
  MODULE_1,
  moduleFixture,
  renderMaterialPanel,
} from './material-test-utils';

vi.setConfig({ testTimeout: 20_000 });

const ONE_MODULE = [moduleFixture(MODULE_1, 'Unidad 1', 0)];

/** Opens the "add file" dialog of the only module and returns its file input. */
async function openUploadDialog(): Promise<{
  readonly dialog: HTMLElement;
  readonly input: HTMLInputElement;
}> {
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Agregar archivo a «Unidad 1»',
    }),
  );
  const dialog = await screen.findByRole('dialog', {
    name: 'Subir material a «Unidad 1»',
  });
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
  return { dialog, input };
}

function looseItem(overrides: Partial<ClassroomMaterialItem> = {}) {
  return {
    id: MATERIAL_ID,
    classroomId: CLASSROOM_ID,
    authorId: profile.id,
    filename: 'resumen-unidad-1.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    moduleId: null,
    createdAt: '2026-11-18T03:00:00.000Z',
    ...overrides,
  } satisfies ClassroomMaterialItem;
}

describe('MaterialPanel', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => {
    mswServer.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => mswServer.close());

  it('lets a teacher upload a valid file and shows it after server confirmation', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: ONE_MODULE,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    const { dialog, input } = await openUploadDialog();
    const file = new File(['%PDF-1.4'], 'guia-tp1.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(within(dialog).getByText(/guia-tp1\.pdf/)).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Subir archivo' }),
    );

    expect(await screen.findByText('Material publicado')).toBeInTheDocument();
    await waitFor(() => {
      expect(store.read()).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unidad 1' }));
    expect(
      await screen.findByRole('list', {
        name: 'Lista de materiales de estudio: Unidad 1',
      }),
    ).toBeInTheDocument();
  });

  it('hides upload and remove controls for students while allowing downloads', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [looseItem()],
      signedUrlBase: 'https://signed.example.test/files',
    });
    mswServer.use(...store.handlers);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderMaterialPanel({ role: 'STUDENT' });

    expect(await screen.findByText('resumen-unidad-1.pdf')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Agregar archivo/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Más acciones/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `https://signed.example.test/files/${MATERIAL_ID}`,
        ),
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  it('rejects forbidden file types and oversized files client-side without calling the server', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: ONE_MODULE,
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    const { dialog, input } = await openUploadDialog();

    const badFile = new File(['<script>'], 'malicioso.html', {
      type: 'text/html',
    });
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(
      await screen.findByText(
        'Formato no permitido. Elegí un archivo PDF, PNG o JPG/JPEG.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Subir archivo' }),
    ).not.toBeInTheDocument();

    const hugeFile = new File(['x'], 'pesado.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(hugeFile, 'size', {
      value: MATERIAL_MAX_SIZE_BYTES + 1,
    });
    fireEvent.change(input, { target: { files: [hugeFile] } });

    expect(
      await screen.findByText(
        'El archivo supera el máximo permitido de 10 MiB.',
      ),
    ).toBeInTheDocument();
    expect(store.read()).toHaveLength(0);
  });

  it('shows server validation reason and adds no item when server rejects upload', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: ONE_MODULE,
    });
    store.failNext('upload', {
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed.',
        details: [{ field: 'file', messages: ['El archivo PDF está dañado.'] }],
        correlationId: 'req-400',
      },
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    const { dialog, input } = await openUploadDialog();
    fireEvent.change(input, {
      target: {
        files: [
          new File(['%PDF'], 'corrupto.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Subir archivo' }),
    );

    expect(
      await screen.findByText('El archivo PDF está dañado.'),
    ).toBeInTheDocument();
    expect(store.read()).toHaveLength(0);
  });

  it('shows progress indicator, allows cancelling an in-flight upload, and lets the teacher retry', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: ONE_MODULE,
    });
    let releaseUpload: (() => void) | undefined;
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/classrooms/:id/materials`, async () => {
        await new Promise<void>((resolve) => {
          releaseUpload = resolve;
        });
        return HttpResponse.json(
          { ...looseItem({ filename: 'lento.pdf', sizeBytes: 512 }) },
          { status: 201 },
        );
      }),
      ...store.handlers,
    );

    renderMaterialPanel({ role: 'TEACHER' });
    const { dialog, input } = await openUploadDialog();
    fireEvent.change(input, {
      target: {
        files: [new File(['%PDF'], 'lento.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Subir archivo' }),
    );

    expect(
      await screen.findByRole('progressbar', { name: 'Progreso de subida' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar subida' }));
    releaseUpload?.();

    expect(
      await screen.findByText(
        'Cancelaste la subida. Podés reintentar con el mismo archivo o elegir otro.',
      ),
    ).toBeInTheDocument();

    mswServer.use(...store.handlers);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar subida' }));
    expect(await screen.findByText('Material publicado')).toBeInTheDocument();
  });

  it('lets a teacher confirm removal from the overflow menu and renders the HU-BOT-001 item slot', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [looseItem({ filename: 'guia-para-quitar.pdf' })],
    });
    mswServer.use(...store.handlers);

    renderMaterialPanel({
      role: 'TEACHER',
      panelProps: {
        renderItemSlot: (material) => (
          <span data-testid={`bot-slot-${material.id}`}>
            Slot bot: {material.filename}
          </span>
        ),
      },
    });

    expect(await screen.findByText('guia-para-quitar.pdf')).toBeInTheDocument();
    expect(screen.getByTestId(`bot-slot-${MATERIAL_ID}`)).toHaveTextContent(
      'Slot bot: guia-para-quitar.pdf',
    );

    const trigger = screen.getByRole('button', {
      name: 'Más acciones de «guia-para-quitar.pdf»',
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', {
        name: 'Quitar',
      }),
    );
    const confirmRegion = await screen.findByRole('region', {
      name: /¿Quitar «guia-para-quitar\.pdf»/,
    });
    fireEvent.click(
      within(confirmRegion).getByRole('button', {
        name: 'Sí, quitar material',
      }),
    );

    expect(await screen.findByText('Material quitado')).toBeInTheDocument();
    await waitFor(() => {
      expect(store.read()).toHaveLength(0);
    });
  });

  it('keeps the hidden file input out of tab order and manages focus on remove cancel', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: ONE_MODULE,
      initialItems: [looseItem({ filename: 'foco-accesible.pdf' })],
    });
    mswServer.use(...store.handlers);

    renderMaterialPanel({ role: 'TEACHER' });
    fireEvent.click(await screen.findByRole('button', { name: 'Sin módulo' }));
    expect(await screen.findByText('foco-accesible.pdf')).toBeInTheDocument();

    const { input } = await openUploadDialog();
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(input).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(
      within(screen.getByRole('dialog')).getAllByRole('button', {
        name: 'Cerrar',
      })[0] as HTMLElement,
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    const trigger = screen.getByRole('button', {
      name: 'Más acciones de «foco-accesible.pdf»',
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', {
        name: 'Quitar',
      }),
    );

    const cancelButton = await screen.findByRole('button', {
      name: 'Cancelar',
    });
    expect(cancelButton).toHaveFocus();

    fireEvent.click(cancelButton);
    expect(
      await screen.findByRole('button', {
        name: 'Más acciones de «foco-accesible.pdf»',
      }),
    ).toHaveFocus();
  });

  it('shows uncertain 503 upload alert, ErrorState on initial failure, and StaleDataNotice on refresh failure', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialModules: ONE_MODULE,
    });
    store.failNext('list', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        correlationId: 'req-list-500',
      },
    });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    expect(
      await screen.findByText('No pudimos cargar el material'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('region', { name: 'Unidad 1' }),
    ).toBeInTheDocument();

    store.failNext('upload', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Timeout',
        correlationId: 'req-upload-503',
      },
    });
    const { dialog, input } = await openUploadDialog();
    fireEvent.change(input, {
      target: {
        files: [
          new File(['%PDF'], 'incierto.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Subir archivo' }),
    );

    expect(
      await screen.findByText('No pudimos confirmar si el archivo se guardó'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Actualizar lista' }),
    ).toBeInTheDocument();
  });
});
