import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { inventoryMessages } from '../src/features/inventory/inventory-messages';
import type { EquipmentStateDto } from '../src/features/inventory/inventory-schema';
import { shopMessages } from '../src/features/shop/messages';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '00000000-0000-4000-8000-000000000057';
const capId = '00000000-0000-4000-8000-000000001001';
const lampId = '00000000-0000-4000-8000-000000001002';
const strawHatId = '00000000-0000-4000-8000-000000001003';
const glassesId = '00000000-0000-4000-8000-000000001004';
const backpackId = '00000000-0000-4000-8000-000000001005';
const plantId = '00000000-0000-4000-8000-000000001006';
const syntheticNow = '2026-11-20T12:00:00.000Z';

type ClassroomContext = components['schemas']['ClassroomContextResponseDto'];
type EquipmentState = EquipmentStateDto;
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

const classroomContext: ClassroomContext = {
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
  myRole: 'STUDENT',
  capabilities: ['participate_activities'],
  availablePanels: ['activities', 'grades', 'shop', 'members'],
  deskCount: 16,
  pet: null,
  createdAt: syntheticNow,
  updatedAt: syntheticNow,
};

interface OwnedItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 'AVATAR_ACCESSORY' | 'DESK_UPGRADE';
  readonly slot: 'head' | 'face' | 'back' | 'desk_decor';
  readonly price: number;
}

const ownedItems: readonly OwnedItem[] = [
  {
    id: capId,
    code: 'cap-blue',
    name: 'Gorra escolar azul',
    kind: 'AVATAR_ACCESSORY',
    slot: 'head',
    price: 100,
  },
  {
    id: strawHatId,
    code: 'straw-hat',
    name: 'Sombrero de paja',
    kind: 'AVATAR_ACCESSORY',
    slot: 'head',
    price: 120,
  },
  {
    id: glassesId,
    code: 'round-glasses',
    name: 'Lentes redondos',
    kind: 'AVATAR_ACCESSORY',
    slot: 'face',
    price: 90,
  },
  {
    id: backpackId,
    code: 'green-backpack',
    name: 'Mochila verde',
    kind: 'AVATAR_ACCESSORY',
    slot: 'back',
    price: 150,
  },
  {
    id: lampId,
    code: 'desk-lamp',
    name: 'Lámpara de escritorio',
    kind: 'DESK_UPGRADE',
    slot: 'desk_decor',
    price: 140,
  },
  {
    id: plantId,
    code: 'desk-plant',
    name: 'Planta de escritorio',
    kind: 'DESK_UPGRADE',
    slot: 'desk_decor',
    price: 80,
  },
];

const purchases: StudentPurchase[] = ownedItems.map((item, index) => ({
  id: `00000000-0000-4000-8000-00000000200${String(index + 1)}`,
  classroomId,
  studentId: userId,
  shopItemId: item.id,
  shopItemCode: item.code,
  shopItemName: item.name,
  shopItemKind: item.kind,
  pointTransactionId: `00000000-0000-4000-8000-00000000300${String(index + 1)}`,
  pricePaid: item.price,
  createdAt: syntheticNow,
}));

// The slot each item fits comes from the catalog metadata, like in the back.
const catalogItems: components['schemas']['ShopCatalogItemDto'][] =
  ownedItems.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    description: '',
    kind: item.kind,
    price: item.price,
    isImplemented: true,
    isPurchasable: true,
    ownedByStudent: true,
    ownedByClassroom: false,
    metadata: { slot: item.slot },
    createdAt: syntheticNow,
  }));

async function attachRuntimeMonitors(page: Page) {
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];

  await page.exposeFunction('__recordCspViolation__', (directive: string) => {
    cspViolations.push(directive);
  });
  await page.addInitScript(() => {
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

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

async function mockAuthAndClassroom(
  page: Page,
  options: {
    equipment: EquipmentState;
    rejectNextPutWith403?: boolean;
  },
) {
  await page.route(`${apiOrigin}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;

    if (pathname === '/auth/login' && req.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'e2e-access-token',
          refreshToken: 'e2e-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
      });
      return;
    }

    if (pathname === '/users/me' && req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      });
      return;
    }

    if (
      pathname === '/notifications' ||
      pathname === '/chats' ||
      pathname === '/me/family-threads'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          pathname === '/notifications'
            ? { items: [], page: 1, pageSize: 20, total: 0 }
            : { items: [] },
        ),
      });
      return;
    }

    if (pathname === '/me/classrooms' && req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [classroomContext],
          page: 1,
          pageSize: 50,
          total: 1,
        }),
      });
      return;
    }

    if (pathname === `/classrooms/${classroomId}` && req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(classroomContext),
      });
      return;
    }

    if (
      pathname === `/classrooms/${classroomId}/points` &&
      req.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          classroomId,
          studentId: userId,
          balance: 200,
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
        }),
      });
      return;
    }

    if (
      pathname === `/classrooms/${classroomId}/shop/items` &&
      req.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: catalogItems,
          page: 1,
          pageSize: 100,
          total: catalogItems.length,
        }),
      });
      return;
    }

    if (
      pathname === `/classrooms/${classroomId}/shop/purchases` &&
      req.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: purchases,
          page: 1,
          pageSize: 100,
          total: purchases.length,
        }),
      });
      return;
    }

    if (
      pathname === `/classrooms/${classroomId}/me/equipment` &&
      req.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.equipment),
      });
      return;
    }

    if (
      pathname.startsWith(`/classrooms/${classroomId}/me/equipment/`) &&
      req.method() === 'PUT'
    ) {
      if (options.rejectNextPutWith403) {
        options.rejectNextPutWith403 = false;
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'FORBIDDEN',
            message: 'Item not owned',
            correlationId: 'e2e-403',
          }),
        });
        return;
      }

      const slot = pathname.split('/').pop() as keyof EquipmentState['slots'];
      const body = req.postDataJSON() as { shopItemId?: string | null };
      if (!body.shopItemId) {
        options.equipment.slots[slot] = null;
      } else {
        const owned = purchases.find((p) => p.shopItemId === body.shopItemId);
        if (owned) {
          options.equipment.slots[slot] = {
            slot: slot as 'head' | 'face' | 'back' | 'desk_decor',
            shopItemId: owned.shopItemId,
            shopItemCode: owned.shopItemCode,
            shopItemName: owned.shopItemName,
            kind: owned.shopItemKind as Exclude<
              typeof owned.shopItemKind,
              'AVATAR_STYLE'
            >,
          };
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.equipment),
      });
      return;
    }

    await route.abort('failed');
  });
}

async function loginAsStudent(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/correo|email/i).fill('estudiante@example.test');
  await page.getByLabel(/^contraseña$/i).fill('Password123!');
  await page.getByRole('button', { name: /ingresar|iniciar sesión/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

async function captureEvidenceIfRequested(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const suffix = testInfo.project.name.includes('desktop')
    ? '1280'
    : testInfo.project.name.includes('mobile')
      ? '360'
      : null;
  if (suffix === null) return;
  // The dialog scrolls internally; grow the viewport so the whole panel shows.
  const original = page.viewportSize();
  if (original) {
    await page.setViewportSize({ width: original.width, height: 2400 });
  }
  await page.getByRole('dialog').screenshot({
    path: `docs/assets/inventory/${name}-${suffix}.png`,
  });
  if (original) {
    await page.setViewportSize(original);
  }
}

test('student equips, unequips, and handles 403 rejection in workspace shop inventory tab', async ({
  page,
}, testInfo) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
  const state = {
    equipment: {
      classroomId,
      studentId: userId,
      slots: {
        head: null,
        face: null,
        back: null,
        desk_decor: null,
        hand: null,
        neck: null,
        ears: null,
      },
    } as EquipmentState,
    rejectNextPutWith403: false,
  };

  await mockAuthAndClassroom(page, state);
  await loginAsStudent(page);

  await page.goto(`/classrooms/${classroomId}/panels/shop`);
  const inventoryTab = page.getByRole('tab', {
    name: shopMessages.panel.tabInventory,
  });
  await expect(inventoryTab).toBeVisible();
  await inventoryTab.click();

  const headGroup = page.getByRole('radiogroup', {
    name: inventoryMessages.slots.head,
  });
  await expect(headGroup).toBeVisible();

  // Equip cap in head slot
  const cap = headGroup.getByRole('radio', { name: /Gorra escolar azul/ });
  await cap.click();

  await expect(cap).toHaveAttribute('aria-checked', 'true');
  await expect(cap).toContainText(inventoryMessages.actions.equipped);
  await expect(
    page.getByRole('region', { name: inventoryMessages.slots.head }),
  ).toContainText(inventoryMessages.states.confirmed);
  await assertNoHorizontalOverflow(page);
  await captureEvidenceIfRequested(page, testInfo, 'inventory');

  // 403 rejection leaves equipped state unchanged
  state.rejectNextPutWith403 = true;
  const deskSection = page.getByRole('region', {
    name: inventoryMessages.slots.desk_decor,
  });
  const lamp = deskSection.getByRole('radio', {
    name: /Lámpara de escritorio/,
  });
  await lamp.click();

  await expect(deskSection.getByRole('status')).toContainText(
    inventoryMessages.errors.notOwned,
  );
  await expect(lamp).toHaveAttribute('aria-checked', 'false');
  await expect(
    deskSection.getByText(inventoryMessages.actions.noItem),
  ).toBeVisible();

  // Unequip cap
  const headSection = page.getByRole('region', {
    name: inventoryMessages.slots.head,
  });
  await headSection
    .getByRole('button', { name: inventoryMessages.actions.unequip })
    .click();
  await expect(cap).toHaveAttribute('aria-checked', 'false');
  await expect(
    headSection.getByText(inventoryMessages.actions.noItem),
  ).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
