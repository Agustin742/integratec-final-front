import { describe, expect, it } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { DESK_HEIGHT, deriveDesks } from './classroom-desks';
import { planDeskDecorPlacements, resolveDeskDecor } from './desk-decor';
import { getKitModuleUrl } from './kit/classroom-kit-manifest';

const CODES = [
  ['desk_mug', 'mug'],
  ['desk_plant', 'plant'],
  ['desk_photo_frame', 'photo-frame'],
  ['desk_puzzle_cube', 'puzzle-cube'],
  ['desk_mini_globe', 'mini-globe'],
  ['desk_lamp', 'lamp'],
  ['desk_figurine', 'figurine'],
] as const;

const desk = (
  deskIndex: number,
  userId: string | null,
  code: string | null,
) => ({
  deskIndex,
  userId,
  deskDecor: code === null ? null : { shopItemCode: code },
});

describe('resolveDeskDecor', () => {
  it('uses the desk map value for students who are not connected', () => {
    expect(
      resolveDeskDecor(
        [
          desk(1, 'a', 'desk_mug'),
          desk(2, 'b', null),
          { deskIndex: 3, userId: null },
        ],
        new Map(),
      ),
    ).toEqual([{ deskIndex: 1, code: 'desk_mug' }]);
  });

  it('prefers the synced value of a connected student, empty included', () => {
    expect(
      resolveDeskDecor(
        [
          desk(1, 'a', 'desk_mug'),
          desk(2, 'b', 'desk_lamp'),
          desk(3, 'c', null),
        ],
        new Map([
          ['a', 'desk_plant'],
          ['b', null],
          ['c', 'desk_figurine'],
        ]),
      ),
    ).toEqual([
      { deskIndex: 1, code: 'desk_plant' },
      { deskIndex: 3, code: 'desk_figurine' },
    ]);
  });
});

describe('planDeskDecorPlacements', () => {
  const students = deriveDesks(CLASSROOM_LAYOUT).filter(
    (footprint) => footprint.kind === 'student',
  );

  it.each(CODES)('places %s with its model', (code, assetId) => {
    const [placement] = planDeskDecorPlacements(CLASSROOM_LAYOUT, [
      { deskIndex: 1, code },
    ]);
    expect(placement && getKitModuleUrl(placement.moduleId)).toBe(
      `/models/scenes/classroom/desk-decor/${assetId}.glb`,
    );
  });

  it('sets the object on the far corner of the desk top, away from the seat', () => {
    const target = students[4]!;
    const [placement] = planDeskDecorPlacements(CLASSROOM_LAYOUT, [
      { deskIndex: 5, code: 'desk_mug' },
    ]);
    const [x, y, z] = placement!.position;
    expect(y).toBe(DESK_HEIGHT);
    // Inside the tabletop, on the board side (the student sits towards +z).
    expect(Math.abs(x - target.centerX)).toBeGreaterThanOrEqual(0.4);
    expect(Math.abs(x - target.centerX)).toBeLessThanOrEqual(0.56);
    expect(z - target.centerZ).toBeLessThan(0);
    expect(z - target.centerZ).toBeGreaterThanOrEqual(-0.24);
  });

  it('renders nothing for unknown codes or desks', () => {
    expect(
      planDeskDecorPlacements(CLASSROOM_LAYOUT, [
        { deskIndex: 1, code: 'desk_mystery' },
        { deskIndex: 1, code: 'toString' },
        { deskIndex: 99, code: 'desk_mug' },
      ]),
    ).toEqual([]);
  });
});
