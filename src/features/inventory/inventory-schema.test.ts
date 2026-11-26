import { describe, expect, it } from 'vitest';
import { equipmentStateDtoSchema, resolveItemSlot } from './inventory-schema';

describe('avatar style shop items', () => {
  it('are never offered for equipping', () => {
    expect(
      resolveItemSlot('AVATAR_STYLE', { styleType: 'hair', styleId: 'dreads' }),
    ).toBeNull();
    // Even a stray slot in the metadata cannot make a style equippable.
    expect(
      resolveItemSlot('AVATAR_STYLE', { slot: 'head', styleType: 'hair' }),
    ).toBeNull();
  });

  it('parse in equipment state without invalidating the whole payload', () => {
    const parsed = equipmentStateDtoSchema.safeParse({
      classroomId: 'c1',
      studentId: 's1',
      slots: {
        head: {
          slot: 'head',
          shopItemId: 'i1',
          shopItemCode: 'hair_dreads',
          shopItemName: 'Rastas',
          kind: 'AVATAR_STYLE',
        },
      },
    });
    expect(parsed.success).toBe(true);
  });
});

describe.each(['hand', 'neck', 'ears'] as const)(
  '%s accessory slot',
  (slot) => {
    it('is offered to avatar accessories only', () => {
      expect(resolveItemSlot('AVATAR_ACCESSORY', { slot })).toBe(slot);
      expect(resolveItemSlot('DESK_UPGRADE', { slot })).toBeNull();
    });

    it('parses an equipment state with an item in it', () => {
      const parsed = equipmentStateDtoSchema.safeParse({
        classroomId: 'c1',
        studentId: 's1',
        slots: {
          [slot]: {
            slot,
            shopItemId: 'i1',
            shopItemCode: `${slot}_item`,
            shopItemName: 'Accesorio',
            kind: 'AVATAR_ACCESSORY',
          },
        },
      });
      expect(parsed.success).toBe(true);
    });
  },
);
