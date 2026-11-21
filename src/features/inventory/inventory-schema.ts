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
 * Returns `true` when `kind` is equipable in `slot` for avatar/desk
 * customization (`AVATAR_ACCESSORY` -> `head`/`face`/`back`,
 * `DESK_UPGRADE` -> `desk_decor`).
 */
export function isEquipableInSlot(
  kind: ShopItemKind,
  slot: EquippedSlotName,
): boolean {
  if (slot === 'desk_decor') {
    return kind === 'DESK_UPGRADE';
  }
  return kind === 'AVATAR_ACCESSORY';
}

/**
 * Returns `true` when `kind` is an avatar or desk item covered by the
 * inventory panel (excluding classroom items and pet accessories).
 */
export function isEquipableKind(kind: ShopItemKind): boolean {
  return kind === 'AVATAR_ACCESSORY' || kind === 'DESK_UPGRADE';
}
