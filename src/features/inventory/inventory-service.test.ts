import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  createClassroomEquipmentStore,
  TEST_API_BASE_URL,
  type ShopStorePurchase,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { inventoryMessages } from './inventory-messages';
import {
  getEquipment,
  isUncertainEquipmentError,
  setEquipmentSlot,
} from './inventory-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000057';
const STUDENT_ID = '00000000-0000-4000-8000-000000007001';
const CAP_ID = '00000000-0000-4000-8000-000000001001';
const DESK_LAMP_ID = '00000000-0000-4000-8000-000000001002';
const UNOWNED_ID = '00000000-0000-4000-8000-000000009999';

function makePurchase(
  overrides: Partial<ShopStorePurchase> = {},
): ShopStorePurchase {
  return {
    id: '00000000-0000-4000-8000-000000002001',
    classroomId: CLASSROOM_ID,
    studentId: STUDENT_ID,
    shopItemId: CAP_ID,
    shopItemCode: 'cap-blue',
    shopItemName: 'Gorra azul',
    shopItemKind: 'AVATAR_ACCESSORY',
    pointTransactionId: '00000000-0000-4000-8000-000000003001',
    pricePaid: 100,
    createdAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('inventory-service', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  it('parses equipment state with null empty slots from GET', async () => {
    const client = createApiClient({
      baseUrl: TEST_API_BASE_URL,
    });
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      initialPurchases: [makePurchase()],
    });
    mswServer.use(...store.handlers);

    const state = await getEquipment(client, CLASSROOM_ID);
    expect(state.classroomId).toBe(CLASSROOM_ID);
    expect(state.slots.head).toBeNull();
    expect(state.slots.face).toBeNull();
    expect(state.slots.back).toBeNull();
    expect(state.slots.desk_decor).toBeNull();
  });

  it('equips and unequips a purchased item via PUT', async () => {
    const client = createApiClient({
      baseUrl: TEST_API_BASE_URL,
    });
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      itemMetadata: { [CAP_ID]: { slot: 'head' } },
      initialPurchases: [makePurchase()],
    });
    mswServer.use(...store.handlers);

    const equipped = await setEquipmentSlot(client, CLASSROOM_ID, {
      slot: 'head',
      shopItemId: CAP_ID,
    });
    expect(equipped.slots.head?.shopItemId).toBe(CAP_ID);
    expect(equipped.slots.head?.shopItemName).toBe('Gorra azul');

    const unequipped = await setEquipmentSlot(client, CLASSROOM_ID, {
      slot: 'head',
      shopItemId: null,
    });
    expect(unequipped.slots.head).toBeNull();
  });

  it('translates 403 unowned item rejection without modifying server slots', async () => {
    const client = createApiClient({
      baseUrl: TEST_API_BASE_URL,
    });
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      initialPurchases: [makePurchase()],
      initialSlots: {
        head: {
          slot: 'head',
          shopItemId: CAP_ID,
          shopItemCode: 'cap-blue',
          shopItemName: 'Gorra azul',
          kind: 'AVATAR_ACCESSORY',
        },
      },
    });
    mswServer.use(...store.handlers);

    await expect(
      setEquipmentSlot(client, CLASSROOM_ID, {
        slot: 'head',
        shopItemId: UNOWNED_ID,
      }),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
      userMessage: inventoryMessages.errors.notOwned,
    });

    expect(store.getSlots().head?.shopItemId).toBe(CAP_ID);
  });

  it('translates 409 slot incompatibility and 429 rate-limit errors', async () => {
    const client = createApiClient({
      baseUrl: TEST_API_BASE_URL,
    });
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      initialPurchases: [
        makePurchase({
          id: '00000000-0000-4000-8000-000000002002',
          shopItemId: DESK_LAMP_ID,
          shopItemCode: 'desk-lamp',
          shopItemName: 'Lámpara de escritorio',
          shopItemKind: 'DESK_UPGRADE',
        }),
      ],
    });
    mswServer.use(...store.handlers);

    await expect(
      setEquipmentSlot(client, CLASSROOM_ID, {
        slot: 'head',
        shopItemId: DESK_LAMP_ID,
      }),
    ).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      userMessage: inventoryMessages.errors.conflict,
    });

    store.failNext('setSlot', {
      status: 429,
      body: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests',
        correlationId: 'req-429',
      },
    });

    await expect(
      setEquipmentSlot(client, CLASSROOM_ID, {
        slot: 'desk_decor',
        shopItemId: DESK_LAMP_ID,
      }),
    ).rejects.toMatchObject({
      kind: 'rate-limited',
      status: 429,
      userMessage: inventoryMessages.errors.rateLimited,
    });
  });

  it('marks 5xx, network, and malformed 2xx write errors as uncertain', async () => {
    const client = createApiClient({
      baseUrl: TEST_API_BASE_URL,
    });
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      initialPurchases: [makePurchase()],
    });
    mswServer.use(...store.handlers);

    store.failNext('setSlot', 'network');
    let caught: unknown;
    try {
      await setEquipmentSlot(client, CLASSROOM_ID, {
        slot: 'head',
        shopItemId: CAP_ID,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(isUncertainEquipmentError(caught)).toBe(true);

    store.failNext('setSlot', 'malformed-2xx');
    caught = undefined;
    try {
      await setEquipmentSlot(client, CLASSROOM_ID, {
        slot: 'head',
        shopItemId: CAP_ID,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(isUncertainEquipmentError(caught)).toBe(true);
  });
});
