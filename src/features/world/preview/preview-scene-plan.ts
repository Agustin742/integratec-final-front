/**
 * What one visit to a public screen shows: a random character in one outfit, a
 * second animation and the scenery. Pure data over the existing
 * catalogs; randomness is injected so a plan can be reproduced.
 */
import {
  BODY_OPTIONS,
  CLOTHING_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  hairOptionsFor,
  topOptionsFor,
  type Avatar,
} from '@/features/profile/avatar-options';
import { PREVIEW_FRAME } from '../camera';

/** Returns a number in `[0, 1)`, like `Math.random`. */
export type RandomSource = () => number;

/** Positive standing gestures shown besides the wave. */
export const PREVIEW_EXTRA_CLIPS = ['Cheer', 'Clap', 'Dance'] as const;

export interface PreviewPiece {
  readonly url: string;
  readonly position: readonly [number, number, number];
  readonly scale: number;
}

/**
 * `[file, half width in meters, scale]`; tall pieces are scaled into frame, and
 * wide ones are shrunk further by `placeSide`.
 */
type SidePiece = readonly [string, number, number?];

interface Space {
  readonly folder: string;
  readonly sides: readonly SidePiece[];
  /** Flat piece under the character. */
  readonly floor?: string;
}

// Table-top lab pieces (glassware, microscope) are left out: they would sit
// on the floor.
const SPACES = {
  hallway: {
    folder: 'hallway',
    floor: 'hallway-runner-rug',
    sides: [
      ['hallway-bench', 0.8],
      ['locker-bank', 0.76],
      ['room-signpost', 0.33],
      ['trophy-display-case', 0.78],
      ['water-fountain', 0.42],
    ],
  },
  schoolyard: {
    folder: 'schoolyard',
    floor: 'courtyard-ground-tile',
    sides: [
      ['basketball-hoop', 0.74, 0.7],
      ['courtyard-tree', 1.19, 0.7],
      ['garden-planter-bench', 1.16],
      ['picnic-table', 1.04],
      ['schoolyard-gazebo-arch', 1.23, 0.8],
    ],
  },
  library: {
    folder: 'library',
    sides: [
      ['book-return-cart', 0.44],
      ['librarian-checkout-desk', 1.08],
      ['library-floor-globe-lamp', 0.63],
      ['reading-nook-armchair', 0.65],
      ['reading-table', 1.1],
      ['tall-bookshelf-arch', 0.91],
    ],
  },
  lab: {
    folder: 'lab',
    sides: [
      ['fume-hood-cabinet', 0.82],
      ['lab-stool', 0.19],
      ['lab-workbench', 1.1],
      ['science-display-shelf', 0.71],
    ],
  },
} as const satisfies Record<string, Space>;

/** Classroom theme corners: each is a whole backdrop behind the character. */
const THEMES = ['warm', 'night', 'space', 'forest', 'holiday'] as const;

type SpaceId = keyof typeof SPACES;
export type PreviewSceneryId = SpaceId | `theme-${(typeof THEMES)[number]}`;

export const PREVIEW_SCENERY_IDS: readonly PreviewSceneryId[] = [
  ...(Object.keys(SPACES) as SpaceId[]),
  ...THEMES.map((theme) => `theme-${theme}` as const),
];

const themeUrl = (theme: string) =>
  `/models/scenes/classroom/themes/${theme}.glb`;
const spaceUrl = (folder: string, file: string) =>
  `/models/scenes/${folder}/${file}.glb`;

export const PREVIEW_SCENERY_URLS: readonly string[] = [
  ...THEMES.map(themeUrl),
  ...Object.values<Space>(SPACES).flatMap((space) =>
    [
      ...space.sides.map(([file]) => file),
      ...(space.floor ? [space.floor] : []),
    ].map((file) => spaceUrl(space.folder, file)),
  ),
];

/** Free room around the character before a side piece starts. */
const SIDE_CLEARANCE = 0.5;
const SIDE_Z = -0.6;
/** Theme corners are 0.98 m deep and stand behind the character. */
const THEME_Z = -0.95;

/** Stands a piece beside the character, shrunk only if it would be cut off. */
function placeSide(
  folder: string,
  [file, halfWidth, scale = 1]: SidePiece,
  side: -1 | 1,
): PreviewPiece {
  const widest = (PREVIEW_FRAME.halfWidth - SIDE_CLEARANCE) / (2 * halfWidth);
  const fitted = Math.min(scale, widest);
  return {
    url: spaceUrl(folder, file),
    position: [side * (SIDE_CLEARANCE + halfWidth * fitted), 0, SIDE_Z],
    scale: fitted,
  };
}

/** Every side piece on both sides, as a plan would place it. */
export const PREVIEW_SIDE_PIECES: readonly PreviewPiece[] =
  Object.values<Space>(SPACES).flatMap((space) =>
    space.sides.flatMap((piece) => [
      placeSide(space.folder, piece, -1),
      placeSide(space.folder, piece, 1),
    ]),
  );

export interface PreviewScenePlan {
  readonly sceneryId: PreviewSceneryId;
  readonly pieces: readonly PreviewPiece[];
  readonly avatar: Avatar;
  readonly extraClip: (typeof PREVIEW_EXTRA_CLIPS)[number];
}

/** Removes and returns a random entry of `pool`. */
function take<T>(pool: T[], random: RandomSource): T {
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool.splice(index, 1)[0] as T;
}

const pick = <T>(items: readonly T[], random: RandomSource): T =>
  take([...items], random);

const pickValue = <T extends string>(
  options: readonly { readonly value: T }[],
  random: RandomSource,
): T => pick(options, random).value;

function planCharacter(random: RandomSource): Avatar {
  const bodyId = pickValue(BODY_OPTIONS, random);
  return {
    bodyId,
    hairId: pickValue(hairOptionsFor(bodyId), random),
    hairColor: pickValue(HAIR_COLOR_OPTIONS, random),
    topId: pickValue(topOptionsFor(bodyId), random),
    clothingColor: pickValue(CLOTHING_COLOR_OPTIONS, random),
  };
}

function planPieces(
  sceneryId: PreviewSceneryId,
  random: RandomSource,
): PreviewPiece[] {
  if (sceneryId.startsWith('theme-')) {
    return [
      {
        url: themeUrl(sceneryId.slice('theme-'.length)),
        position: [0, 0, THEME_Z],
        scale: 1,
      },
    ];
  }
  const space: Space = SPACES[sceneryId as SpaceId];
  const pool = [...space.sides];
  const sides = ([-1, 1] as const).map((side) =>
    placeSide(space.folder, take(pool, random), side),
  );
  if (!space.floor) return sides;
  return [
    ...sides,
    {
      url: spaceUrl(space.folder, space.floor),
      position: [0, 0, 0],
      scale: 1,
    },
  ];
}

export function planPreviewScene(random: RandomSource): PreviewScenePlan {
  const sceneryId = pick(PREVIEW_SCENERY_IDS, random);
  return {
    sceneryId,
    pieces: planPieces(sceneryId, random),
    avatar: planCharacter(random),
    extraClip: pick(PREVIEW_EXTRA_CLIPS, random),
  };
}
