import { z } from 'zod';

// Strict CSP compatibility: prevent Zod v4 from compiling validators with `new Function()`.
z.config({ jitless: true });

export const equippedSlotNameSchema = z.enum([
  'head',
  'face',
  'back',
  'desk_decor',
]);

export type EquippedSlotName = z.infer<typeof equippedSlotNameSchema>;

export const SLOT_NAMES: readonly EquippedSlotName[] = [
  'head',
  'face',
  'back',
  'desk_decor',
];

export const shopItemKindSchema = z.enum([
  'CLASSROOM_ITEM',
  'AVATAR_ACCESSORY',
  'DESK_UPGRADE',
  'PET_ACCESSORY',
]);

export type ShopItemKind = z.infer<typeof shopItemKindSchema>;

export const equippedSlotDtoSchema = z.object({
  slot: equippedSlotNameSchema,
  shopItemId: z.string().min(1),
  shopItemCode: z.string().min(1),
  shopItemName: z.string().min(1),
  kind: shopItemKindSchema,
});

export type EquippedSlotDto = z.infer<typeof equippedSlotDtoSchema>;

export const equipmentStateDtoSchema = z.object({
  classroomId: z.string().min(1),
  studentId: z.string().min(1),
  slots: z.record(z.string(), equippedSlotDtoSchema.nullable()),
});

export type EquipmentStateDto = z.infer<typeof equipmentStateDtoSchema>;

export const equipItemDtoSchema = z.object({
  shopItemId: z.string().min(1).nullable().optional(),
});

export type EquipItemDto = z.infer<typeof equipItemDtoSchema>;

/**
 * Resolves the slot an item must be equipped into from its catalog
 * `metadata.slot`, mirroring the back's `deriveSlotForItem`
 * (`AVATAR_ACCESSORY` -> `head`/`face`/`back`, `DESK_UPGRADE` -> `desk_decor`).
 * Returns `null` when the slot is missing/invalid or does not fit the kind
 * (the back answers `409`), so the item must not be offered anywhere.
 */
export function resolveItemSlot(
  kind: ShopItemKind,
  metadata: Readonly<Record<string, unknown>> | undefined,
): EquippedSlotName | null {
  const parsed = equippedSlotNameSchema.safeParse(metadata?.slot);
  if (!parsed.success) {
    return null;
  }
  const slot = parsed.data;
  const fits =
    slot === 'desk_decor'
      ? kind === 'DESK_UPGRADE'
      : kind === 'AVATAR_ACCESSORY';
  return fits ? slot : null;
}
