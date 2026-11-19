import { z } from 'zod';

// Strict CSP compatibility: prevent Zod v4 from compiling validators with `new Function()`.
z.config({ jitless: true });

export const shopItemKindSchema = z.enum([
  'CLASSROOM_ITEM',
  'AVATAR_ACCESSORY',
  'DESK_UPGRADE',
  'PET_ACCESSORY',
]);

export type ShopItemKind = z.infer<typeof shopItemKindSchema>;

export const classroomItemStateSchema = z.enum([
  'UNLOCKED',
  'ACTIVE',
  'DISABLED',
]);

export type ClassroomItemState = z.infer<typeof classroomItemStateSchema>;

const isoInstantSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) && !Number.isNaN(Date.parse(value)),
    { message: 'Invalid ISO-8601 instant' },
  );

export const shopCatalogItemDtoSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  kind: shopItemKindSchema,
  price: z.number().int().min(1),
  isImplemented: z.boolean(),
  isPurchasable: z.boolean(),
  ownedByStudent: z.boolean(),
  ownedByClassroom: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: isoInstantSchema,
});

export type ShopCatalogItemDto = z.infer<typeof shopCatalogItemDtoSchema>;

export const paginatedShopItemsSchema = z.object({
  items: z.array(shopCatalogItemDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type PaginatedShopItemsDto = z.infer<typeof paginatedShopItemsSchema>;

export const studentPurchaseDtoSchema = z.object({
  id: z.string().min(1),
  classroomId: z.string().min(1),
  studentId: z.string().min(1),
  shopItemId: z.string().min(1),
  shopItemCode: z.string().min(1),
  shopItemName: z.string().min(1),
  shopItemKind: shopItemKindSchema,
  pointTransactionId: z.string().min(1),
  pricePaid: z.number().int().min(1),
  createdAt: isoInstantSchema,
});

export type StudentPurchaseDto = z.infer<typeof studentPurchaseDtoSchema>;

export const paginatedShopPurchasesSchema = z.object({
  items: z.array(studentPurchaseDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type PaginatedShopPurchasesDto = z.infer<
  typeof paginatedShopPurchasesSchema
>;

export const classroomItemDtoSchema = z.object({
  id: z.string().min(1),
  classroomId: z.string().min(1),
  shopItemId: z.string().min(1),
  purchaseId: z.string().min(1),
  state: classroomItemStateSchema,
  createdAt: isoInstantSchema,
});

export type ClassroomItemDto = z.infer<typeof classroomItemDtoSchema>;

export const purchaseResponseDtoSchema = z.object({
  purchase: studentPurchaseDtoSchema,
  classroomItem: classroomItemDtoSchema.nullable(),
  balance: z.number().int().min(0),
  replayed: z.boolean(),
});

export type PurchaseResponseDto = z.infer<typeof purchaseResponseDtoSchema>;

const pointsFormatter = new Intl.NumberFormat('es-AR');

/**
 * Formats a non-negative integer point amount in `es-AR`. Clamps malformed
 * negatives defensively so balance is never rendered as negative (`RN-07`).
 */
export function formatShopPoints(points: number): string {
  const safePoints = Number.isFinite(points)
    ? Math.max(0, Math.trunc(points))
    : 0;
  const formatted = pointsFormatter.format(safePoints);
  return safePoints === 1 ? `${formatted} punto` : `${formatted} puntos`;
}
