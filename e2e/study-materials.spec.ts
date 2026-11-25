import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000140';
const initialMaterialId = '00000000-0000-4000-8000-000000001401';
const module1Id = '00000000-0000-4000-8000-000000002401';
const module2Id = '00000000-0000-4000-8000-000000002402';

type MaterialDto = components['schemas']['MaterialDto'];
type ModuleDto = components['schemas']['MaterialModuleDto'];
type Capabilities =
  components['schemas']['ClassroomContextResponseDto']['capabilities'];

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'docente@example.test',
  displayName: 'Prof. Ana García',
  avatar: {
    bodyId: 'female',
    hairId: 'classic-short',
    topId: 'basic-tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

const teacherCapabilities: Capabilities = [
  'publish_content',
  'configure_classroom',
  'view_metrics',
];

const studentCapabilities: Capabilities = [
  'participate_activities',
  'view_metrics',
];

function moduleDto(
  id: string,
  name: string,
  position: number,
  description: string | null = null,
): Omit<ModuleDto, 'materialCount'> {
  return {
    id,
    classroomId,
    name,
    description,
    position,
    createdAt: '2026-11-18T03:00:00.000Z',
    updatedAt: '2026-11-18T03:00:00.000Z',
  };
}

function materialDto(
  id: string,
  filename: string,
  moduleId: string | null,
): MaterialDto {
  return {
    id,
    classroomId,
    authorId: userId,
    filename,
    contentType: 'application/pdf',
    sizeBytes: 245760,
    moduleId,
    createdAt: '2026-11-18T03:00:00.000Z',
  };
}

function classroomResponse(
  role: 'TEACHER' | 'STUDENT',
  capabilities: Capabilities,
) {
  return {
    id: classroomId,
    name: '3.º Año B - Matemática',
    subject: 'Álgebra y Geometría',
    schoolId: null,
    independentTeacherId: role === 'TEACHER' ? userId : null,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: role,
    capabilities,
    availablePanels: ['material'],
    deskCount: 12,
    pet: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  } satisfies components['schemas']['ClassroomContextResponseDto'];
}

async function setupAuthSession(page: Page) {
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];

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
    document.addEventListener('securitypolicyviolation', (event) => {
      const record = (
        window as unknown as {
          __recordCspViolation__?: (directive: string) => void;
        }
      ).__recordCspViolation__;
      record?.(event.violatedDirective);
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.route(`${apiOrigin}/users/me`, (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/context-events`,
    (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: '',
      }),
  );

  return { cspViolations, pageErrors };
}

interface MaterialApiState {
  items: MaterialDto[];
  modules: Omit<ModuleDto, 'materialCount'>[];
  /** `moduleId` filters seen on GET /materials, in order. */
  listedFilters: (string | null)[];
  /** `moduleId` multipart field of each upload (null when absent). */
  uploadedModuleIds: (string | null)[];
}

/** Stateful mock of the materials and material-modules endpoints. */
async function routeMaterialApi(page: Page, state: MaterialApiState) {
  const withCount = () =>
    state.modules.map((entry) => ({
      ...entry,
      materialCount: state.items.filter((item) => item.moduleId === entry.id)
        .length,
    }));

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/material-modules**`,
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET') {
        return route.fulfill({ json: { items: withCount() } });
      }
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as {
          name: string;
          description?: string;
        };
        const created = moduleDto(
          `00000000-0000-4000-8000-00000000250${state.modules.length}`,
          body.name,
          state.modules.length,
          body.description ?? null,
        );
        state.modules = [...state.modules, created];
        return route.fulfill({
          status: 201,
          json: { ...created, materialCount: 0 },
        });
      }
      if (request.method() === 'DELETE') {
        const id = path.split('/').pop();
        state.items = state.items.map((item) =>
          item.moduleId === id ? { ...item, moduleId: null } : item,
        );
        state.modules = state.modules.filter((entry) => entry.id !== id);
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fallback();
    },
  );

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/materials**`,
    (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const isCollection = url.pathname.endsWith('/materials');
      if (request.method() === 'GET' && isCollection) {
        const filter = url.searchParams.get('moduleId');
        state.listedFilters.push(filter);
        const scoped =
          filter === null
            ? state.items
            : state.items.filter((item) =>
                filter === 'unassigned'
                  ? item.moduleId === null
                  : item.moduleId === filter,
              );
        return route.fulfill({
          json: { items: scoped, page: 1, pageSize: 10, total: scoped.length },
        });
      }
      if (request.method() === 'POST' && isCollection) {
        const body = request.postDataBuffer()?.toString('latin1') ?? '';
        const target =
          /name="moduleId"\r\n\r\n([0-9a-f-]{36})/.exec(body)?.[1] ?? null;
        state.uploadedModuleIds.push(target);
        const created = materialDto(
          '00000000-0000-4000-8000-000000001402',
          'guia-practica.pdf',
          target,
        );
        state.items = [created, ...state.items];
        return route.fulfill({ status: 201, json: created });
      }
      if (request.method() === 'GET' && url.pathname.endsWith('/download')) {
        return route.fulfill({
          json: {
            url: `${apiOrigin}/signed-download/${initialMaterialId}?token=ephemeral`,
            expiresInSeconds: 120,
          } satisfies components['schemas']['MaterialDownloadDto'],
        });
      }
      const id = url.pathname.split('/').pop();
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON() as { moduleId: string | null };
        state.items = state.items.map((item) =>
          item.id === id ? { ...item, moduleId: body.moduleId } : item,
        );
        return route.fulfill({
          json: state.items.find((item) => item.id === id),
        });
      }
      if (request.method() === 'DELETE') {
        state.items = state.items.filter((item) => item.id !== id);
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fallback();
    },
  );
}

async function recordWindowOpen(page: Page) {
  const openedUrls: { url: string; target?: string; features?: string }[] = [];
  await page.exposeFunction(
    '__recordWindowOpen__',
    (url: string, target?: string, features?: string) => {
      openedUrls.push({ url, target, features });
    },
  );
  await page.addInitScript(() => {
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const record = (
        window as unknown as {
          __recordWindowOpen__?: (u: string, t?: string, f?: string) => void;
        }
      ).__recordWindowOpen__;
      record?.(String(url ?? ''), target, features);
      return null;
    }) as typeof window.open;
  });
  return openedUrls;
}

test('teacher organizes material into modules, uploads into one, moves, downloads and removes a file', async ({
  page,
}, testInfo) => {
  // A long multi-step flow (create, upload, move, download, remove).
  test.setTimeout(90_000);
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);
  const state: MaterialApiState = {
    items: [materialDto(initialMaterialId, 'programa-anual.pdf', module1Id)],
    modules: [
      moduleDto(module1Id, 'Unidad 1', 0, 'Funciones y gráficos'),
      moduleDto(module2Id, 'Unidad 2', 1),
    ],
    listedFilters: [],
    uploadedModuleIds: [],
  };

  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({ json: classroomResponse('TEACHER', teacherCapabilities) }),
  );
  await routeMaterialApi(page, state);
  const openedUrls = await recordWindowOpen(page);

  await page.goto(`./classrooms/${classroomId}/panels/material`);
  const dialog = page.getByRole('dialog', { name: 'Material', exact: true });
  await expect(dialog).toBeVisible();

  // Modules show name, description and count; no module files load yet.
  const unit1 = dialog.getByRole('region', { name: 'Unidad 1' });
  await expect(unit1).toBeVisible();
  await expect(unit1.getByText('Funciones y gráficos')).toBeVisible();
  await expect(unit1.getByText('1 archivo', { exact: true })).toBeVisible();
  await expect(dialog.getByText('programa-anual.pdf')).toHaveCount(0);
  expect(
    state.listedFilters.filter((filter) => filter !== 'unassigned'),
  ).toEqual([]);

  // Opening a module lazily loads only its files.
  await unit1.getByRole('button', { name: 'Unidad 1', exact: true }).click();
  await expect(unit1.getByText('programa-anual.pdf')).toBeVisible();
  expect(state.listedFilters).toContain(module1Id);
  expect(state.listedFilters).not.toContain(module2Id);

  // Create a module from the dialog.
  await dialog.getByRole('button', { name: 'Nuevo módulo' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Nuevo módulo' });
  await createDialog.getByLabel('Nombre del módulo').fill('Unidad 3');
  await createDialog.getByRole('button', { name: 'Crear módulo' }).click();
  await expect(dialog.getByText('Módulo creado')).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Unidad 3' })).toBeVisible();

  // Upload straight into Unidad 1; the request carries its moduleId.
  await dialog
    .getByRole('button', { name: 'Agregar archivo a «Unidad 1»' })
    .click();
  const uploadDialog = page.getByRole('dialog', {
    name: 'Subir material a «Unidad 1»',
  });
  await uploadDialog.locator('input[type="file"]').setInputFiles({
    name: 'guia-practica.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%test'),
  });
  await uploadDialog.getByRole('button', { name: 'Subir archivo' }).click();
  await expect(dialog.getByText('Material publicado')).toBeVisible();
  expect(state.uploadedModuleIds).toEqual([module1Id]);
  await expect(unit1.getByText('guia-practica.pdf')).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await dialog.evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/assets/classrooms/study-materials-${width}.png`,
    fullPage: true,
  });

  // Move the new file to Unidad 2 from its overflow menu.
  await unit1
    .getByRole('button', { name: 'Más acciones de «guia-practica.pdf»' })
    .click();
  await page.getByRole('menuitem', { name: 'Mover a otro módulo' }).click();
  const moveDialog = page.getByRole('dialog', {
    name: 'Mover «guia-practica.pdf»',
  });
  await moveDialog.getByLabel('Módulo de destino').selectOption(module2Id);
  await moveDialog.getByRole('button', { name: 'Mover archivo' }).click();
  await expect(dialog.getByText('Archivo movido')).toBeVisible();
  expect(
    state.items.find((item) => item.filename === 'guia-practica.pdf')?.moduleId,
  ).toBe(module2Id);
  await expect(unit1.getByText('guia-practica.pdf')).toHaveCount(0);

  // Download through the signed URL.
  await unit1.getByRole('button', { name: 'Descargar' }).click();
  await expect
    .poll(() => openedUrls)
    .toEqual([
      {
        url: `${apiOrigin}/signed-download/${initialMaterialId}?token=ephemeral`,
        target: '_blank',
        features: 'noopener,noreferrer',
      },
    ]);

  // Remove with confirmation.
  await unit1
    .getByRole('button', { name: 'Más acciones de «programa-anual.pdf»' })
    .click();
  await page.getByRole('menuitem', { name: 'Quitar' }).click();
  await dialog.getByRole('button', { name: 'Sí, quitar material' }).click();
  await expect(dialog.getByText('Material quitado')).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('student sees the module structure read-only and can download', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await setupAuthSession(page);
  const state: MaterialApiState = {
    items: [
      materialDto(initialMaterialId, 'programa-anual.pdf', module1Id),
      materialDto('00000000-0000-4000-8000-000000001403', 'suelto.pdf', null),
    ],
    modules: [
      moduleDto(module1Id, 'Unidad 1', 0),
      moduleDto(module2Id, 'Unidad 2', 1),
    ],
    listedFilters: [],
    uploadedModuleIds: [],
  };

  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({ json: classroomResponse('STUDENT', studentCapabilities) }),
  );
  await routeMaterialApi(page, state);
  await recordWindowOpen(page);

  await page.goto(`./classrooms/${classroomId}/panels/material`);
  const dialog = page.getByRole('dialog', { name: 'Material', exact: true });
  await expect(dialog.getByRole('region', { name: 'Unidad 1' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Unidad 2' })).toBeVisible();
  await expect(
    dialog.getByRole('region', { name: 'Sin módulo' }),
  ).toBeVisible();

  await expect(
    dialog.getByRole('button', { name: 'Nuevo módulo' }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: /Agregar archivo/ }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: /Más acciones/ }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: /hacia (arriba|abajo)/ }),
  ).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Unidad 1', exact: true }).click();
  await expect(dialog.getByText('programa-anual.pdf')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Descargar' })).toBeVisible();
  await expect(dialog.getByRole('switch')).toHaveCount(0);
  await expect(dialog.getByText('Asistente de estudio (IA)')).toHaveCount(0);

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('teacher toggles study material for the Study Guide Bot and captures responsive views', async ({
  page,
}) => {
  test.slow();
  const { cspViolations, pageErrors } = await setupAuthSession(page);
  const state: MaterialApiState = {
    items: [materialDto(initialMaterialId, 'programa-anual.pdf', null)],
    modules: [],
    listedFilters: [],
    uploadedModuleIds: [],
  };

  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({
      json: classroomResponse('TEACHER', [
        ...teacherCapabilities,
        'configure_bot',
      ]),
    }),
  );
  await routeMaterialApi(page, state);

  let botEntry: components['schemas']['BotMaterialDto'] | null = null;

  // `GET` carries pagination query parameters; `POST` does not.
  await page.route(
    (url) =>
      url.origin === apiOrigin &&
      url.pathname === `/classrooms/${classroomId}/bot/materials`,
    async (route) => {
      if (route.request().method() === 'POST') {
        botEntry = {
          id: '00000000-0000-4000-8000-000000009001',
          classroomId,
          materialId: initialMaterialId,
          filename: 'programa-anual.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          indexState: 'INDEXED',
          createdAt: '2026-11-19T01:30:00.000Z',
        };
        await route.fulfill({ status: 201, json: botEntry });
        return;
      }
      const items = botEntry ? [botEntry] : [];
      await route.fulfill({
        json: { items, page: 1, pageSize: 100, total: items.length },
      });
    },
  );

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/bot/materials/${initialMaterialId}`,
    async (route) => {
      botEntry = null;
      await route.fulfill({ status: 204 });
    },
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`./classrooms/${classroomId}/panels/material`);
  const dialog = page.getByRole('dialog', { name: 'Material', exact: true });
  // With no modules, "Sin módulo" opens by itself and lists the loose file.
  await expect(dialog.getByText('programa-anual.pdf')).toBeVisible();

  const toggle = dialog.getByRole('switch', {
    name: /Habilitar «programa-anual\.pdf» para el asistente de estudio/,
  });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(dialog.getByText('Desactivado para el bot')).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByText('Listo para el bot')).toBeVisible();

  await page.screenshot({
    path: 'docs/assets/classrooms/bot-materials-1280.png',
    fullPage: false,
  });

  await page.setViewportSize({ width: 360, height: 740 });
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({
    path: 'docs/assets/classrooms/bot-materials-360.png',
    fullPage: false,
  });

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(dialog.getByText('Desactivado para el bot')).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
