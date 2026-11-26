import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { shopMessages } from '../src/features/shop/messages';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '00000000-0000-4000-8000-000000000048';
const itemCapId = '00000000-0000-4000-8000-000000001001';
const itemLampId = '00000000-0000-4000-8000-000000001002';
const itemUpcomingId = '00000000-0000-4000-8000-000000001003';
const itemBoardId = '00000000-0000-4000-8000-000000001004';
const syntheticNow = '2026-11-19T02:00:00.000Z';

type ClassroomContext = components['schemas']['ClassroomContextResponseDto'];
type ShopCatalogItem = components['schemas']['ShopCatalogItemDto'];
type StudentPurchase = components['schemas']['StudentPurchaseDto'];

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'estudiante@example.test',
  displayName: 'Sofía Martínez',
  avatar: {
    bodyId: 'female',
    hairId: 'classic-short',
    topId: 'basic-tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

function buildContext(role: 'STUDENT' | 'TEACHER'): ClassroomContext {
  return {
    id: classroomId,
    name: '4.º Año A - Matemática',
    subject: 'Análisis matemático',
    schoolId: null,
    independentTeacherId: null,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    tutorBotSkin: 'none',
    myRole: role,
    capabilities:
      role === 'STUDENT'
        ? ['participate_activities']
        : ['publish_content', 'configure_classroom'],
    availablePanels: ['activities', 'grades', 'shop', 'members'],
    deskCount: 16,
    pet: null,
    createdAt: syntheticNow,
    updatedAt: syntheticNow,
  };
}

interface ShopE2eState {
  readonly context: ClassroomContext;
  balance: number;
  items: ShopCatalogItem[];
  purchases: StudentPurchase[];
  shopItemRequests: number;
  purchaseRequests: number;
  lastIdempotencyKey: string | null;
}

function createInitialItems(): ShopCatalogItem[] {
  return [
    {
      id: itemCapId,
      code: 'cap-classic',
      name: 'Gorra escolar clásica',
      description: 'Accesorio deportivo para personalizar tu avatar.',
      kind: 'AVATAR_ACCESSORY',
      price: 120,
      isImplemented: true,
      isPurchasable: true,
      ownedByStudent: false,
      ownedByClassroom: false,
      metadata: { slot: 'hat' },
      createdAt: '2026-11-18T10:00:00.000Z',
    },
    {
      id: itemLampId,
      code: 'desk-lamp',
      name: 'Lámpara cálida de escritorio',
      description: 'Iluminación cálida para tu banco en el aula.',
      kind: 'DESK_UPGRADE',
      price: 180,
      isImplemented: true,
      isPurchasable: true,
      ownedByStudent: false,
      ownedByClassroom: false,
      metadata: { slot: 'desk_lamp' },
      createdAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: itemUpcomingId,
      code: 'pet-collar',
      name: 'Collar estelar de mascota',
      description: 'Accesorio planificado para futuras mascotas.',
      kind: 'PET_ACCESSORY',
      price: 90,
      isImplemented: false,
      isPurchasable: false,
      ownedByStudent: false,
      ownedByClassroom: false,
      metadata: { planned: true },
      createdAt: '2026-11-18T12:00:00.000Z',
    },
    {
      id: itemBoardId,
      code: 'board-space',
      name: 'Pizarrón temático espacial',
      description: 'Elemento compartido ya desbloqueado para el curso.',
      kind: 'CLASSROOM_ITEM',
      price: 300,
      isImplemented: true,
      isPurchasable: false,
      ownedByStudent: false,
      ownedByClassroom: true,
      metadata: { effect: 'space_theme' },
      createdAt: '2026-11-18T13:00:00.000Z',
    },
  ];
}

async function interceptShopApi(
  page: Page,
  testInfo: TestInfo,
  state: ShopE2eState,
): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL && url.origin === new URL(baseURL).origin) {
      return route.continue();
    }
    if (url.origin !== apiOrigin) {
      return route.abort();
    }

    if (url.pathname === '/users/me') {
      return route.fulfill({ json: profile });
    }
    if (url.pathname === '/notifications' && request.method() === 'GET') {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (url.pathname === `/classrooms/${classroomId}`) {
      return route.fulfill({ json: state.context });
    }
    if (url.pathname === `/classrooms/${classroomId}/context-events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/points` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: {
          classroomId,
          studentId: userId,
          balance: state.balance,
          items: state.purchases.map((p) => ({
            id: p.pointTransactionId,
            entryKind: 'DEBIT',
            amount: -p.pricePaid,
            sourceType: 'SHOP_PURCHASE',
            sourceId: p.id,
            reason: `Compra: ${p.shopItemName}`,
            actorId: userId,
            createdAt: p.createdAt,
          })),
          page: 1,
          pageSize: 20,
          total: state.purchases.length,
        },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/shop/items` &&
      request.method() === 'GET'
    ) {
      state.shopItemRequests += 1;
      const kind = url.searchParams.get('kind');
      const filtered = kind
        ? state.items.filter((item) => item.kind === kind)
        : state.items;
      return route.fulfill({
        json: {
          items: filtered,
          page: 1,
          pageSize: 12,
          total: filtered.length,
        },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/shop/purchases` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: {
          items: state.purchases,
          page: 1,
          pageSize: 10,
          total: state.purchases.length,
        },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/shop/purchase` &&
      request.method() === 'POST'
    ) {
      state.purchaseRequests += 1;
      state.lastIdempotencyKey = request.headers()['idempotency-key'] ?? null;
      const body = request.postDataJSON() as { shopItemId: string };
      const target = state.items.find((entry) => entry.id === body.shopItemId);
      if (!target || !target.isPurchasable || state.balance < target.price) {
        return route.fulfill({
          status: 409,
          json: {
            error: {
              code: 'CONFLICT',
              message: 'Conflict.',
              correlationId: 'e2e-shop-409',
            },
          },
        });
      }

      state.balance -= target.price;
      state.items = state.items.map((entry) =>
        entry.id === target.id
          ? { ...entry, ownedByStudent: true, isPurchasable: false }
          : entry,
      );

      const purchase: StudentPurchase = {
        id: '00000000-0000-4000-8000-200000000001',
        classroomId,
        studentId: userId,
        shopItemId: target.id,
        shopItemCode: target.code,
        shopItemName: target.name,
        shopItemKind: target.kind,
        pointTransactionId: '00000000-0000-4000-8000-300000000001',
        pricePaid: target.price,
        createdAt: '2026-11-19T02:45:00.000Z',
      };
      state.purchases = [purchase, ...state.purchases];

      return route.fulfill({
        status: 201,
        json: {
          purchase,
          classroomItem: null,
          balance: state.balance,
          replayed: false,
        },
      });
    }

    return route.fulfill({ status: 404, json: {} });
  });
}

async function attachRuntimeMonitors(page: Page) {
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
    window.addEventListener('securitypolicyviolation', (event) => {
      const report = window as unknown as {
        __recordCspViolation__?: (directive: string) => void;
      };
      report.__recordCspViolation__?.(
        `${event.violatedDirective}:${event.blockedURI}`,
      );
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  return { cspViolations, pageErrors };
}

test('student browses the classroom shop, confirms purchase, and sees updated balance and history', async ({
  page,
}, testInfo) => {
  const monitors = await attachRuntimeMonitors(page);
  const state: ShopE2eState = {
    context: buildContext('STUDENT'),
    balance: 250,
    items: createInitialItems(),
    purchases: [],
    shopItemRequests: 0,
    purchaseRequests: 0,
    lastIdempotencyKey: null,
  };
  await interceptShopApi(page, testInfo, state);

  await page.goto(`/classrooms/${classroomId}/panels/shop`);

  const shopDialog = page.getByRole('dialog', { name: 'Tienda' });
  await expect(
    shopDialog.getByRole('heading', { name: shopMessages.panel.heading }),
  ).toBeVisible();
  await expect(
    shopDialog.getByText('250 puntos', { exact: true }),
  ).toBeVisible();
  await expect(shopDialog.getByText('Gorra escolar clásica')).toBeVisible();
  await expect(
    shopDialog.getByText(shopMessages.catalog.statusUpcoming, { exact: true }),
  ).toBeVisible();
  await expect(
    shopDialog.getByText(shopMessages.catalog.statusOwnedClassroom, {
      exact: true,
    }),
  ).toBeVisible();

  const width = page.viewportSize()?.width ?? 1280;
  const suffix = width <= 480 ? '360' : '1280';

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);

  await page.screenshot({
    path: `docs/assets/shop/catalog-${suffix}.png`,
    fullPage: false,
    animations: 'disabled',
  });

  // Open confirmation dialog for the first purchasable item (Gorra escolar clásica)
  await shopDialog
    .getByRole('button', { name: shopMessages.catalog.buyAction })
    .first()
    .click();

  const confirmDialog = page.getByRole('dialog', {
    name: shopMessages.confirm.title,
  });
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByText('Gorra escolar clásica')).toBeVisible();

  await page.screenshot({
    path: `docs/assets/shop/confirm-${suffix}.png`,
    fullPage: false,
    animations: 'disabled',
  });

  await confirmDialog
    .getByRole('button', { name: shopMessages.confirm.confirmAction })
    .click();

  await expect(confirmDialog).not.toBeVisible();
  await expect(
    shopDialog.getByText('130 puntos', { exact: true }),
  ).toBeVisible();
  await expect(
    shopDialog.getByText(shopMessages.catalog.statusOwnedStudent, {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.purchaseRequests).toBe(1);
  expect(state.lastIdempotencyKey).toBeTruthy();

  // Verify confirmed purchase appears in Mis compras tab
  await shopDialog
    .getByRole('tab', { name: shopMessages.panel.tabPurchases })
    .click();
  await expect(shopDialog.getByText('Pagado: 120 puntos')).toBeVisible();
  await expect(shopDialog.getByText('Gorra escolar clásica')).toBeVisible();

  expect(monitors.cspViolations).toEqual([]);
  expect(monitors.pageErrors).toEqual([]);
});

test('teacher does not see student purchase controls or trigger student shop requests', async ({
  page,
}, testInfo) => {
  const monitors = await attachRuntimeMonitors(page);
  const state: ShopE2eState = {
    context: buildContext('TEACHER'),
    balance: 0,
    items: createInitialItems(),
    purchases: [],
    shopItemRequests: 0,
    purchaseRequests: 0,
    lastIdempotencyKey: null,
  };
  await interceptShopApi(page, testInfo, state);

  await page.goto(`/classrooms/${classroomId}/panels/shop`);

  const shopDialog = page.getByRole('dialog', { name: 'Tienda' });
  await expect(
    shopDialog.getByText(shopMessages.panel.studentOnlyTitle),
  ).toBeVisible();
  await expect(
    shopDialog.getByRole('button', { name: shopMessages.catalog.buyAction }),
  ).not.toBeVisible();
  expect(state.shopItemRequests).toBe(0);
  expect(state.purchaseRequests).toBe(0);
  expect(monitors.cspViolations).toEqual([]);
  expect(monitors.pageErrors).toEqual([]);
});
