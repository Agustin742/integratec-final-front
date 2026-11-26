import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_CODES,
  ACCESSORY_FIXED_COLORS,
} from '@/features/world/avatar/accessory-catalog';
import {
  resolveAvatarPreview,
  resolveItemPreview,
} from './item-preview-source';

const accessory = (code: string) => ({
  kind: 'AVATAR_ACCESSORY' as const,
  code,
  metadata: {},
});

/**
 * Mirror of `back/apps/api/prisma/seed-shop-catalog.ts` (CI has no backend
 * checkout): update it together with the seed.
 */
const SHOP_CODES = {
  AVATAR_ACCESSORY: `head_headband head_cap head_backwards_cap head_beanie
    head_headphones head_graduation_cap head_top_hat head_crown
    head_astronaut_helmet face_face_paint face_round_glasses
    face_square_glasses face_face_mask face_sunglasses face_masquerade_mask
    back_backpack back_rolling_backpack back_racket back_guitar
    back_superhero_cape back_wings hand_pencil hand_book hand_ruler hand_mug
    hand_phone hand_mate hand_magnifying_glass hand_paintbrush hand_tablet
    hand_trophy neck_scarf neck_necklace neck_bow_tie neck_lanyard_badge
    neck_bandana neck_achievement_medal ears_earrings ears_star_earrings
    ears_ear_cuffs`,
  DESK_UPGRADE: `desk_mug desk_plant desk_photo_frame desk_puzzle_cube
    desk_mini_globe desk_lamp desk_figurine`,
  AVATAR_STYLE: `hair_side_part hair_fringe hair_wavy hair_messy
    hair_long_curls hair_long_wavy hair_half_up hair_braid hair_two_braids
    hair_dreads hair_two_pigtails hair_box_braids hair_soft_mohawk
    hair_afro_with_headband top_school_polo top_vest top_sweater
    top_flannel_shirt top_track_jacket top_denim_jacket top_hoodie
    top_shirt_and_tie top_winter_coat top_holiday_sweater
    top_national_team_jersey`,
} as const;

const SHOP_ITEMS = Object.entries(SHOP_CODES).flatMap(([kind, codes]) =>
  codes
    .split(/\s+/)
    .map((code) => [code, kind as keyof typeof SHOP_CODES] as const),
);

const publicFileExists = (url: string) =>
  existsSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));

describe('shop catalog previews', () => {
  it('mirrors the whole seed', () => {
    expect(SHOP_ITEMS).toHaveLength(72);
  });

  it.each(SHOP_ITEMS)('previews %s with existing models', (code, kind) => {
    for (const bodyId of ['male', 'female'] as const) {
      const source = resolveItemPreview({ kind, code, metadata: {} }, bodyId);
      expect(source.type).not.toBe('illustration');
      const urls =
        source.type === 'glb'
          ? [source.url]
          : source.type === 'worn'
            ? [source.url, source.bodyUrl]
            : [];
      expect(urls.filter((url) => !publicFileExists(url))).toEqual([]);
    }
  });
});

describe('resolveAvatarPreview', () => {
  it('draws a top on the chosen body with the default clothing color', () => {
    expect(resolveAvatarPreview({ type: 'top', id: 'vest' }, 'female')).toEqual(
      {
        type: 'worn',
        part: 'top',
        url: '/models/avatars/female/top-vest.glb',
        bodyUrl: '/models/avatars/female/body.glb',
        tint: '#5B4F96',
      },
    );
  });

  it('draws a hair style on the chosen body with the chosen color', () => {
    expect(
      resolveAvatarPreview(
        { type: 'hair', id: 'long-curls', color: '#112233' },
        'male',
      ),
    ).toEqual({
      type: 'worn',
      part: 'hair',
      url: '/models/avatars/shared/hair-long-curls.glb',
      bodyUrl: '/models/avatars/male/body.glb',
      tint: '#112233',
    });
  });

  it('draws an accessory alone, fitted to the chosen body', () => {
    expect(
      resolveAvatarPreview({ type: 'accessory', code: 'neck_scarf' }, 'female'),
    ).toMatchObject({
      type: 'glb',
      url: '/models/avatars/female/neck-scarf.glb',
    });
  });

  it.each([
    { type: 'hair', id: 'mystery' },
    { type: 'top', id: 'toString' },
    { type: 'accessory', code: 'mystery' },
  ] as const)('has no preview for %o', (ref) => {
    expect(resolveAvatarPreview(ref, 'male')).toEqual({ type: 'illustration' });
  });
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
