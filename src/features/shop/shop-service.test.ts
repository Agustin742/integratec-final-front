import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  createClassroomShopStore,
  TEST_API_BASE_URL,
  type ShopStoreCatalogItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { shopMessages } from './messages';
import {
  createPurchaseIdempotencyKey,
  isAbortError,
  isUncertainShopWriteError,
  listAllShopPurchases,
  listShopItems,
  MAX_ALL_PAGES,
  listShopPurchases,
  purchaseShopItem,
} from './shop-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000048';
const ITEM_1_ID = '00000000-0000-4000-8000-000000001001';
const ITEM_2_ID = '00000000-0000-4000-8000-000000001002';

function makeItem(
  overrides: Partial<ShopStoreCatalogItem> = {},
): ShopStoreCatalogItem {
  return {
    id: ITEM_1_ID,
    code: 'headphones-blue',
    name: 'Auriculares celestes',
    description: 'Accesorio de avatar.',
    kind: 'AVATAR_ACCESSORY',
    price: 120,
    isImplemented: true,
    createdAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

describe('shop-service', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('lists items, purchases with Idempotency-Key header, replays safely on same key, and lists purchases', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 200,
      initialItems: [makeItem()],
    });
    mswServer.use(...store.handlers);

    const catalog = await listShopItems(client, CLASSROOM_ID, {
      sort: 'defaultPrice',
      kind: 'AVATAR_ACCESSORY',
    });
    expect(catalog.total).toBe(1);
    expect(catalog.items[0].price).toBe(120);

    const key = createPurchaseIdempotencyKey();
    const first = await purchaseShopItem(client, CLASSROOM_ID, {
      shopItemId: ITEM_1_ID,
      idempotencyKey: key,
    });
    expect(first.replayed).toBe(false);
    expect(first.balance).toBe(80);
    expect(store.getBalance()).toBe(80);

    // Replay with the exact same Idempotency-Key returns 200 without second debit
    const replay = await purchaseShopItem(client, CLASSROOM_ID, {
      shopItemId: ITEM_1_ID,
      idempotencyKey: key,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.balance).toBe(80);
    expect(store.getBalance()).toBe(80);

    const history = await listShopPurchases(client, CLASSROOM_ID);
    expect(history.total).toBe(1);
    expect(history.items[0].pricePaid).toBe(120);
  });

  it('maps 409 conflicts, 429 rate limits, 403/404, and AbortError cleanly', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 50,
      initialItems: [makeItem({ price: 120 }), makeItem({ id: ITEM_2_ID })],
    });
    mswServer.use(...store.handlers);

    await expect(
      purchaseShopItem(client, CLASSROOM_ID, {
        shopItemId: ITEM_1_ID,
        idempotencyKey: 'key-409',
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      return true;
    });

    store.failNext('purchase', {
      status: 429,
      body: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests',
        correlationId: 'req-429',
      },
    });
    await expect(
      purchaseShopItem(client, CLASSROOM_ID, {
        shopItemId: ITEM_1_ID,
        idempotencyKey: 'key-429',
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).userMessage).toBe(
        shopMessages.errors.rateLimited,
      );
      return true;
    });

    const controller = new AbortController();
    controller.abort();
    await expect(
      purchaseShopItem(
        client,
        CLASSROOM_ID,
        { shopItemId: ITEM_1_ID, idempotencyKey: 'key-abort' },
        { signal: controller.signal },
      ),
    ).rejects.toSatisfy((error: unknown) => isAbortError(error));
  });

  it('marks 5xx, network errors, and malformed 2xx purchase responses as uncertain', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 500,
      initialItems: [makeItem()],
    });
    mswServer.use(...store.handlers);

    store.failNext('purchase', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Down',
        correlationId: 'req-503',
      },
    });
    await expect(
      purchaseShopItem(client, CLASSROOM_ID, {
        shopItemId: ITEM_1_ID,
        idempotencyKey: 'key-503',
      }),
    ).rejects.toSatisfy((error: unknown) => isUncertainShopWriteError(error));

    store.failNext('purchase', 'malformed-2xx');
    await expect(
      purchaseShopItem(client, CLASSROOM_ID, {
        shopItemId: ITEM_1_ID,
        idempotencyKey: 'key-malformed',
      }),
    ).rejects.toSatisfy((error: unknown) => isUncertainShopWriteError(error));
  });

  it('stops paging at the safety bound when the server keeps reporting more rows', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    let requests = 0;
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/:id/shop/purchases`,
        ({ request }) => {
          requests += 1;
          const page = Number(new URL(request.url).searchParams.get('page'));
          return HttpResponse.json({
            items: [
              {
                id: `00000000-0000-4000-8000-00000000${String(1000 + page)}`,
                classroomId: CLASSROOM_ID,
                studentId: '00000000-0000-4000-8000-000000007001',
                shopItemId: `00000000-0000-4000-8000-00000000${String(5000 + page)}`,
                shopItemCode: `item-${page}`,
                shopItemName: `Item ${page}`,
                shopItemKind: 'AVATAR_ACCESSORY',
                pointTransactionId: '00000000-0000-4000-8000-000000003001',
                pricePaid: 10,
                createdAt: '2026-11-20T10:00:00.000Z',
              },
            ],
            page,
            pageSize: 100,
            total: 1_000_000,
          });
        },
      ),
    );

    const all = await listAllShopPurchases(client, CLASSROOM_ID);

    expect(requests).toBe(MAX_ALL_PAGES);
    expect(all.items).toHaveLength(MAX_ALL_PAGES);
  });
});
