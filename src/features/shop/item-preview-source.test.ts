import { describe, expect, it } from 'vitest';
import { resolveItemPreview } from './item-preview-source';

describe('resolveItemPreview', () => {
  it('maps avatar accessories with a known assetId to their GLB', () => {
    expect(
      resolveItemPreview({
        kind: 'AVATAR_ACCESSORY',
        code: 'cap_blue',
        metadata: { slot: 'head', assetId: 'cap' },
      }),
    ).toEqual({
      type: 'glb',
      url: '/models/avatars/male/accessory-cap.glb',
    });
    expect(
      resolveItemPreview({
        kind: 'AVATAR_ACCESSORY',
        code: 'backpack_explorer',
        metadata: { assetId: 'backpack' },
      }),
    ).toEqual({
      type: 'glb',
      url: '/models/avatars/male/accessory-backpack.glb',
    });
  });

  it('picks the square frame only for square glasses', () => {
    const base = { kind: 'AVATAR_ACCESSORY', metadata: { assetId: 'glasses' } };
    expect(
      resolveItemPreview({ ...base, code: 'glasses_round' } as never),
    ).toEqual({
      type: 'glb',
      url: '/models/avatars/male/accessory-round-glasses.glb',
    });
    expect(
      resolveItemPreview({ ...base, code: 'glasses_square' } as never),
    ).toEqual({
      type: 'glb',
      url: '/models/avatars/male/accessory-square-glasses.glb',
    });
  });

  it('falls back to an illustration without a model', () => {
    expect(
      resolveItemPreview({
        kind: 'DESK_UPGRADE',
        code: 'desk_plant',
        metadata: { assetId: 'desk_plant' },
      }),
    ).toEqual({ type: 'illustration' });
    expect(
      resolveItemPreview({
        kind: 'AVATAR_ACCESSORY',
        code: 'mystery',
        metadata: { assetId: 'toString' },
      }),
    ).toEqual({ type: 'illustration' });
    expect(
      resolveItemPreview({
        kind: 'AVATAR_ACCESSORY',
        code: 'x',
        metadata: {},
      }),
    ).toEqual({ type: 'illustration' });
  });
});
