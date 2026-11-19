import { describe, expect, it } from 'vitest';
import {
  formatShopPoints,
  paginatedShopItemsSchema,
  paginatedShopPurchasesSchema,
  purchaseResponseDtoSchema,
  shopCatalogItemDtoSchema,
} from './shop-schema';

describe('shop-schema', () => {
  it('validates catalog items and rejects invalid prices or negative balances', () => {
    const validItem = {
      id: '00000000-0000-4000-8000-000000001001',
      code: 'cap-classic',
      name: 'Gorra escolar',
      description: 'Accesorio clásico para el avatar.',
      kind: 'AVATAR_ACCESSORY' as const,
      price: 120,
      isImplemented: true,
      isPurchasable: true,
      ownedByStudent: false,
      ownedByClassroom: false,
      metadata: { slot: 'hat' },
      createdAt: '2026-11-18T12:00:00.000Z',
    };

    expect(shopCatalogItemDtoSchema.safeParse(validItem).success).toBe(true);
    expect(
      shopCatalogItemDtoSchema.safeParse({ ...validItem, price: 0 }).success,
    ).toBe(false);
    expect(
      paginatedShopItemsSchema.safeParse({
        items: [validItem],
        page: 1,
        pageSize: 12,
        total: 1,
      }).success,
    ).toBe(true);
  });

  it('validates purchase response and rejects negative balances', () => {
    const validResponse = {
      purchase: {
        id: 'p-1',
        classroomId: 'c-1',
        studentId: 's-1',
        shopItemId: 'i-1',
        shopItemCode: 'cap-classic',
        shopItemName: 'Gorra escolar',
        shopItemKind: 'AVATAR_ACCESSORY' as const,
        pointTransactionId: 'tx-1',
        pricePaid: 120,
        createdAt: '2026-11-19T02:00:00.000Z',
      },
      classroomItem: null,
      balance: 80,
      replayed: false,
    };

    expect(purchaseResponseDtoSchema.safeParse(validResponse).success).toBe(
      true,
    );
    expect(
      purchaseResponseDtoSchema.safeParse({ ...validResponse, balance: -10 })
        .success,
    ).toBe(false);
    expect(
      paginatedShopPurchasesSchema.safeParse({
        items: [validResponse.purchase],
        page: 1,
        pageSize: 10,
        total: 1,
      }).success,
    ).toBe(true);
  });

  it('formats points in es-AR and never renders a negative number', () => {
    expect(formatShopPoints(0)).toBe('0 puntos');
    expect(formatShopPoints(1)).toBe('1 punto');
    expect(formatShopPoints(1250)).toBe('1.250 puntos');
    expect(formatShopPoints(-50)).toBe('0 puntos');
  });
});
