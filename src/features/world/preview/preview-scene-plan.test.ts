import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OrthographicCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  BODY_OPTIONS,
  CLOTHING_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  hairOptionsFor,
  topOptionsFor,
} from '@/features/profile/avatar-options';
import { resolveAvatarParts } from '../avatar/avatar-parts';
import { framePreviewCamera } from '../camera';
import {
  PREVIEW_EXTRA_CLIPS,
  PREVIEW_SCENERY_IDS,
  PREVIEW_SCENERY_URLS,
  PREVIEW_SIDE_PIECES,
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
    expect(new Set(plans.map((plan) => plan.avatar.bodyId)).size).toBe(2);
    expect(
      new Set(plans.map((plan) => plan.avatar.hairId)).size,
    ).toBeGreaterThan(5);
  });

  it('dresses one character in a single outfit with existing models', () => {
    for (const random of [seeded(3), () => 0, () => 0.999999]) {
      const parts = resolveAvatarParts(planPreviewScene(random).avatar);
      for (const url of [parts.bodyUrl, parts.hairUrl!, parts.topUrl!]) {
        expect(existsSync(publicFile(url))).toBe(true);
      }
    }
  });

  it('only gestures positively besides the wave', () => {
    expect([...PREVIEW_EXTRA_CLIPS]).toEqual(['Cheer', 'Clap', 'Dance']);
    expect(PREVIEW_EXTRA_CLIPS).toContain(
      planPreviewScene(seeded(5)).extraClip,
    );
  });

  it('only uses existing scenery models', () => {
    for (const url of PREVIEW_SCENERY_URLS) {
      expect(existsSync(publicFile(url))).toBe(true);
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

describe('character catalog', () => {
  it.each(BODY_OPTIONS.map((option) => option.value))(
    'has every model the %s body can be drawn with',
    (bodyId) => {
      for (const hair of hairOptionsFor(bodyId)) {
        for (const top of topOptionsFor(bodyId)) {
          const parts = resolveAvatarParts({
            bodyId,
            hairId: hair.value,
            topId: top.value,
            hairColor: HAIR_COLOR_OPTIONS[0]!.value,
            clothingColor: CLOTHING_COLOR_OPTIONS[0]!.value,
          });
          for (const url of [parts.bodyUrl, parts.hairUrl, parts.topUrl]) {
            expect(url !== null && existsSync(publicFile(url))).toBe(true);
          }
        }
      }
    },
  );
});

/** Horizontal extent of a model, read from its position accessors. */
function modelExtentX(url: string): readonly [number, number] {
  const buffer = readFileSync(publicFile(url));
  const json = buffer.subarray(20, 20 + buffer.readUInt32LE(12));
  const doc = JSON.parse(json.toString('utf8')) as {
    scenes: { nodes: number[] }[];
    nodes: {
      mesh?: number;
      children?: number[];
      translation?: number[];
      scale?: number[];
    }[];
    meshes: { primitives: { attributes: { POSITION: number } }[] }[];
    accessors: { min: number[]; max: number[] }[];
  };
  let min = Infinity;
  let max = -Infinity;
  const visit = (index: number, offset: number, scale: number) => {
    const node = doc.nodes[index]!;
    const at = offset + (node.translation?.[0] ?? 0) * scale;
    const by = scale * (node.scale?.[0] ?? 1);
    if (node.mesh !== undefined) {
      for (const primitive of doc.meshes[node.mesh]!.primitives) {
        const accessor = doc.accessors[primitive.attributes.POSITION]!;
        min = Math.min(min, at + accessor.min[0]! * by);
        max = Math.max(max, at + accessor.max[0]! * by);
      }
    }
    for (const child of node.children ?? []) visit(child, at, by);
  };
  for (const index of doc.scenes[0]!.nodes) visit(index, 0, 1);
  return [min, max];
}

describe('side pieces in the 16:9 panel', () => {
  // The panel keeps 16:9 at every width: phone, tablet and desktop sizes.
  it.each([
    [312, 175.5],
    [640, 360],
    [672, 378],
  ])('stay inside a %ix%i frame', (width, height) => {
    const camera = new OrthographicCamera();
    framePreviewCamera(camera, width, height);
    expect(PREVIEW_SIDE_PIECES.length).toBeGreaterThan(30);

    for (const { url, position, scale } of PREVIEW_SIDE_PIECES) {
      for (const edge of modelExtentX(url)) {
        const point = new Vector3(position[0] + edge * scale, 0, 0);
        expect(Math.abs(point.project(camera).x), url).toBeLessThanOrEqual(1);
      }
    }
  });

  it('are only shrunk as much as needed', () => {
    for (const piece of PREVIEW_SIDE_PIECES) {
      expect(piece.scale).toBeGreaterThanOrEqual(0.7);
    }
  });
});
