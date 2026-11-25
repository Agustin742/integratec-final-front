import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_CODES,
  ACCESSORY_FIXED_COLORS,
} from '@/features/world/avatar/accessory-catalog';
import { resolveItemPreview } from './item-preview-source';

const accessory = (code: string) => ({
  kind: 'AVATAR_ACCESSORY' as const,
  code,
  metadata: {},
});

describe('resolveItemPreview', () => {
  it.each(ACCESSORY_CODES)(
    'previews %s with an existing catalog model and its worn color',
    (code) => {
      const source = resolveItemPreview(accessory(code));
      expect(source).toMatchObject({
        type: 'glb',
        tint: ACCESSORY_FIXED_COLORS[code],
      });
      const url = source.type === 'glb' ? source.url : '';
      expect(
        existsSync(resolve(process.cwd(), 'public', url.replace(/^\//, ''))),
      ).toBe(true);
    },
  );

  it('previews body-fitted items on the male body', () => {
    expect(resolveItemPreview(accessory('neck_scarf'))).toMatchObject({
      url: '/models/avatars/male/neck-scarf.glb',
    });
    expect(resolveItemPreview(accessory('hand_mate'))).toMatchObject({
      url: '/models/avatars/shared/hand-mate.glb',
    });
  });

  it.each([
    ['desk_mug', 'mug'],
    ['desk_plant', 'plant'],
    ['desk_photo_frame', 'photo-frame'],
    ['desk_puzzle_cube', 'puzzle-cube'],
    ['desk_mini_globe', 'mini-globe'],
    ['desk_lamp', 'lamp'],
    ['desk_figurine', 'figurine'],
  ])('previews %s with its desk decor model, untinted', (code, assetId) => {
    const source = resolveItemPreview({
      kind: 'DESK_UPGRADE',
      code,
      metadata: { assetId, slot: 'desk_decor' },
    });
    const url = `/models/scenes/classroom/desk-decor/${assetId}.glb`;
    expect(source).toEqual({ type: 'glb', url });
    expect(existsSync(resolve(process.cwd(), 'public', url.slice(1)))).toBe(
      true,
    );
  });

  it('falls back to an illustration without a model', () => {
    expect(
      resolveItemPreview({
        kind: 'DESK_UPGRADE',
        code: 'desk_mystery',
        metadata: {},
      }),
    ).toEqual({ type: 'illustration' });
    expect(
      resolveItemPreview({
        kind: 'AVATAR_STYLE',
        code: 'head_cap',
        metadata: {},
      }),
    ).toEqual({ type: 'illustration' });
    expect(resolveItemPreview(accessory('mystery'))).toEqual({
      type: 'illustration',
    });
    expect(resolveItemPreview(accessory('toString'))).toEqual({
      type: 'illustration',
    });
  });
});
