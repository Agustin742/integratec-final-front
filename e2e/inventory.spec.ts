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
    hairId: 'original',
    topId: 'tshirt',
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
  myRole: 'STUDENT',
  capabilities: ['participate_activities'],
  availablePanels: ['activities', 'grades', 'shop', 'members'],
  deskCount: 16,
  pet: null,
  createdAt: syntheticNow,
  updatedAt: syntheticNow,
};

const purchases: StudentPurchase[] = [
  {
    id: '00000000-0000-4000-8000-000000002001',
    classroomId,
    studentId: userId,
    shopItemId: capId,
    shopItemCode: 'cap-blue',
    shopItemName: 'Gorra escolar azul',
    shopItemKind: 'AVATAR_ACCESSORY',
    pointTransactionId: '00000000-0000-4000-8000-000000003001',
    pricePaid: 100,
    createdAt: syntheticNow,
  },
  {
    id: '00000000-0000-4000-8000-000000002002',
    classroomId,
    studentId: userId,
    shopItemId: lampId,
    shopItemCode: 'desk-lamp',
    shopItemName: 'Lámpara de escritorio',
    shopItemKind: 'DESK_UPGRADE',
    pointTransactionId: '00000000-0000-4000-8000-000000003002',
    pricePaid: 140,
    createdAt: syntheticNow,
  },
];

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

    if (pathname === '/notifications' || pathname === '/chats') {
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
          items: [],
          page: 1,
          pageSize: 12,
          total: 0,
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
            kind: owned.shopItemKind,
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
  await page.getByLabel(/contraseña/i).fill('Password123!');
  await page.getByRole('button', { name: /ingresar|iniciar sesión/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

async function captureEvidenceIfRequested(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  if (testInfo.project.name.includes('desktop')) {
    await page.screenshot({
      path: `docs/assets/inventory/${name}-1280.png`,
      fullPage: true,
    });
  } else if (testInfo.project.name.includes('mobile')) {
    await page.screenshot({
      path: `docs/assets/inventory/${name}-360.png`,
      fullPage: true,
    });
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

  const headGroup = page.getByRole('group', {
    name: inventoryMessages.slots.head,
  });
  await expect(headGroup).toBeVisible();

  // Equip cap in head slot
  await headGroup.getByRole('combobox').selectOption(capId);
  await headGroup
    .getByRole('button', { name: inventoryMessages.actions.equip })
    .click();

  await expect(
    headGroup.getByText(
      `${inventoryMessages.actions.equipped}: Gorra escolar azul`,
    ),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await captureEvidenceIfRequested(page, testInfo, 'inventory');

  // 403 rejection leaves equipped state unchanged
  state.rejectNextPutWith403 = true;
  const deskGroup = page.getByRole('group', {
    name: inventoryMessages.slots.desk_decor,
  });
  await deskGroup.getByRole('combobox').selectOption(lampId);
  await deskGroup
    .getByRole('button', { name: inventoryMessages.actions.equip })
    .click();

  await expect(deskGroup.getByRole('alert')).toContainText(
    inventoryMessages.errors.notOwned,
  );
  await expect(
    deskGroup.getByText(inventoryMessages.actions.noItem),
  ).toBeVisible();

  // Unequip cap
  await headGroup
    .getByRole('button', { name: inventoryMessages.actions.unequip })
    .click();
  await expect(
    headGroup.getByText(inventoryMessages.actions.noItem),
  ).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
