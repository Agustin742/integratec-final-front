import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAvatarParts } from '../avatar/avatar-parts';
import {
  PREVIEW_EXTRA_CLIPS,
  PREVIEW_SCENERY_IDS,
  PREVIEW_SCENERY_URLS,
  planPreviewScene,
} from './preview-scene-plan';

/** Small deterministic generator, so each seed is one "page refresh". */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const publicFile = (url: string) =>
  resolve(process.cwd(), 'public', url.slice(1));

/** Embedded textures load through `blob:` fetches, which the CSP blocks. */
function embeddedImages(url: string): number {
  const buffer = readFileSync(publicFile(url));
  const json = buffer.subarray(20, 20 + buffer.readUInt32LE(12));
  const document = JSON.parse(json.toString('utf8')) as { images?: unknown[] };
  return document.images?.length ?? 0;
}

describe('planPreviewScene', () => {
  it('is fully determined by the random source', () => {
    expect(planPreviewScene(seeded(7))).toEqual(planPreviewScene(seeded(7)));
  });

  it('varies the character and the scenery between refreshes', () => {
    const plans = Array.from({ length: 60 }, (_, i) =>
      planPreviewScene(seeded(i * 977 + 1)),
    );
    expect(new Set(plans.map((plan) => plan.sceneryId))).toEqual(
      new Set(PREVIEW_SCENERY_IDS),
    );
    expect(new Set(plans.map((plan) => plan.avatars[0]!.bodyId)).size).toBe(2);
    expect(
      new Set(plans.map((plan) => plan.avatars[0]!.hairId)).size,
    ).toBeGreaterThan(5);
  });

  it('keeps one character that changes outfits', () => {
    for (const random of [seeded(3), () => 0, () => 0.999999]) {
      const { avatars } = planPreviewScene(random);
      expect(avatars.length).toBe(4);
      expect(new Set(avatars.map((a) => a.topId)).size).toBe(4);
      expect(
        new Set(avatars.map((a) => `${a.bodyId}:${a.hairId}:${a.hairColor}`))
          .size,
      ).toBe(1);
      for (const avatar of avatars) {
        const parts = resolveAvatarParts(avatar);
        for (const url of [parts.bodyUrl, parts.hairUrl!, parts.topUrl!]) {
          expect(existsSync(publicFile(url))).toBe(true);
          expect(embeddedImages(url)).toBe(0);
        }
      }
    }
  });

  it('picks a second body animation besides the wave', () => {
    expect(PREVIEW_EXTRA_CLIPS).not.toContain('Wave');
    expect(PREVIEW_EXTRA_CLIPS).not.toContain('Idle');
    expect(PREVIEW_EXTRA_CLIPS).toContain(
      planPreviewScene(seeded(5)).extraClip,
    );
  });

  it('only uses existing scenery models without embedded textures', () => {
    for (const url of PREVIEW_SCENERY_URLS) {
      expect(existsSync(publicFile(url))).toBe(true);
      expect(embeddedImages(url)).toBe(0);
    }
  });

  it('keeps standing objects beside the character, never in front', () => {
    for (let i = 0; i < 60; i += 1) {
      const { pieces } = planPreviewScene(seeded(i * 31 + 2));
      expect(pieces.length).toBeGreaterThan(0);
      for (const piece of pieces) {
        expect(PREVIEW_SCENERY_URLS).toContain(piece.url);
        const [x, , z] = piece.position;
        const floor = /rug|ground-tile/.test(piece.url);
        const backdrop = piece.url.includes('/themes/');
        if (floor) expect(x).toBe(0);
        else if (backdrop) expect(z).toBeLessThanOrEqual(-0.8);
        else expect(Math.abs(x)).toBeGreaterThanOrEqual(0.6);
      }
    }
  });
});
