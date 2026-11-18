import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
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
import { MaterialPanel, type MaterialPanelProps } from './material-panel';
import { MATERIAL_MAX_SIZE_BYTES } from './material-schema';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const MATERIAL_ID = '00000000-0000-4000-8000-000000001001';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

function renderMaterialPanel(options: {
  readonly role?: 'TEACHER' | 'STUDENT';
  readonly capabilities?: readonly Capability[];
  readonly panelProps?: MaterialPanelProps;
}) {
  const role = options.role ?? 'TEACHER';
  const capabilities: Capability[] =
    options.capabilities !== undefined
      ? [...options.capabilities]
      : role === 'TEACHER'
        ? ['publish_content', 'configure_classroom']
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
        element: <MaterialPanel {...options.panelProps} />,
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
  );

  return render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );
}

describe('MaterialPanel', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => {
    mswServer.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => mswServer.close());

  it('lets a teacher upload a valid file and shows it after server confirmation', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    expect(
      await screen.findByText('Todavía no hay material publicado'),
    ).toBeInTheDocument();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'guia-tp1.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText(/guia-tp1\.pdf/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));

    expect(await screen.findByText('Material publicado')).toBeInTheDocument();
    await waitFor(() => {
      expect(store.read()).toHaveLength(1);
    });
    expect(
      screen.getByRole('list', { name: 'Lista de materiales de estudio' }),
    ).toBeInTheDocument();
  });

  it('hides upload and remove controls for students while allowing downloads', async () => {
    const initialItem: ClassroomMaterialItem = {
      id: MATERIAL_ID,
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      filename: 'resumen-unidad-1.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      createdAt: '2026-11-18T03:00:00.000Z',
    };
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [initialItem],
      signedUrlBase: 'https://signed.example.test/files',
    });
    mswServer.use(...store.handlers);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderMaterialPanel({ role: 'STUDENT' });

    expect(await screen.findByText('resumen-unidad-1.pdf')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Elegir archivo' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Quitar' }),
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
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);
    renderMaterialPanel({ role: 'TEACHER' });

    await screen.findByText('Todavía no hay material publicado');

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const badFile = new File(['<script>'], 'malicioso.html', {
      type: 'text/html',
    });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(
      await screen.findByText(
        'Formato no permitido. Elegí un archivo PDF, PNG o JPG/JPEG.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Subir archivo' }),
    ).not.toBeInTheDocument();

    const hugeFile = new File(['x'], 'pesado.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(hugeFile, 'size', {
      value: MATERIAL_MAX_SIZE_BYTES + 1,
    });
    fireEvent.change(fileInput, { target: { files: [hugeFile] } });

    expect(
      await screen.findByText(
        'El archivo supera el máximo permitido de 10 MiB.',
      ),
    ).toBeInTheDocument();
    expect(store.read()).toHaveLength(0);
  });

  it('shows server validation reason and adds no item when server rejects upload', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
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

    await screen.findByText('Todavía no hay material publicado');

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['%PDF'], 'corrupto.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));

    expect(
      await screen.findByText('El archivo PDF está dañado.'),
    ).toBeInTheDocument();
    expect(store.read()).toHaveLength(0);
    expect(
      screen.getByText('Todavía no hay material publicado'),
    ).toBeInTheDocument();
  });

  it('shows progress indicator, allows cancelling an in-flight upload, and lets the teacher retry', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
    let releaseUpload: (() => void) | undefined;
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/classrooms/:id/materials`, async () => {
        await new Promise<void>((resolve) => {
          releaseUpload = resolve;
        });
        return HttpResponse.json(
          {
            id: MATERIAL_ID,
            classroomId: CLASSROOM_ID,
            authorId: profile.id,
            filename: 'lento.pdf',
            contentType: 'application/pdf',
            sizeBytes: 512,
            createdAt: '2026-11-18T03:00:00.000Z',
          },
          { status: 201 },
        );
      }),
      ...store.handlers,
    );

    renderMaterialPanel({ role: 'TEACHER' });
    await screen.findByText('Todavía no hay material publicado');

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['%PDF'], 'lento.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));

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

  it('lets a teacher confirm removal and renders the HU-BOT-001 item slot', async () => {
    const initialItem: ClassroomMaterialItem = {
      id: MATERIAL_ID,
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      filename: 'guia-para-quitar.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      createdAt: '2026-11-18T03:00:00.000Z',
    };
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [initialItem],
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

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
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
    const initialItem: ClassroomMaterialItem = {
      id: MATERIAL_ID,
      classroomId: CLASSROOM_ID,
      authorId: profile.id,
      filename: 'foco-accesible.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      createdAt: '2026-11-18T03:00:00.000Z',
    };
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [initialItem],
    });
    mswServer.use(...store.handlers);

    renderMaterialPanel({ role: 'TEACHER' });
    expect(await screen.findByText('foco-accesible.pdf')).toBeInTheDocument();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toHaveAttribute('tabindex', '-1');
    expect(fileInput).toHaveAttribute('aria-hidden', 'true');

    const removeButton = screen.getByRole('button', { name: 'Quitar' });
    removeButton.focus();
    fireEvent.click(removeButton);

    const cancelButton = await screen.findByRole('button', {
      name: 'Cancelar',
    });
    expect(cancelButton).toHaveFocus();

    fireEvent.click(cancelButton);
    expect(await screen.findByRole('button', { name: 'Quitar' })).toHaveFocus();
  });

  it('shows uncertain 503 upload alert, ErrorState on initial failure, and StaleDataNotice on refresh failure', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
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
      await screen.findByText('Todavía no hay material publicado'),
    ).toBeInTheDocument();

    store.failNext('upload', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Timeout',
        correlationId: 'req-upload-503',
      },
    });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['%PDF'], 'incierto.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));

    expect(
      await screen.findByText('No pudimos confirmar si el archivo se guardó'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Actualizar lista' }),
    ).toBeInTheDocument();
  });
});
