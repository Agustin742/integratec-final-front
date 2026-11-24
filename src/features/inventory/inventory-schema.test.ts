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
