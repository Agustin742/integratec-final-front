/**
 * Desk decor each student shows on their own desk. Pure data and layout (no
 * `three`), so the shop preview and the classroom stage can both use it.
 */
import type { ClassroomLayout } from '@/realtime';
import { DESK_HEIGHT, deriveDesks } from './classroom-desks';
import type { ClassroomKitModuleId } from './kit/classroom-kit-manifest';
import type { KitPlacement } from './kit/kit-placement';

/** Far corner of the desk top: the student sits towards `+z`. */
const DECOR_OFFSET_X = 0.5;
const DECOR_OFFSET_Z = -0.2;

/** Shop item code to kit module (`docs/art/classroom-desk-decor.md`). */
const MODULE_BY_CODE: ReadonlyMap<string, ClassroomKitModuleId> = new Map([
  ['desk_mug', 'desk-decor-mug'],
  ['desk_plant', 'desk-decor-plant'],
  ['desk_photo_frame', 'desk-decor-photo-frame'],
  ['desk_puzzle_cube', 'desk-decor-puzzle-cube'],
  ['desk_mini_globe', 'desk-decor-mini-globe'],
  ['desk_lamp', 'desk-decor-lamp'],
  ['desk_figurine', 'desk-decor-figurine'],
]);

export function resolveDeskDecorModule(
  code: string,
): ClassroomKitModuleId | null {
  return MODULE_BY_CODE.get(code) ?? null;
}

/** Synced `desk_decor` code by user id of connected members; `null` is empty. */
export type LiveDeskDecor = ReadonlyMap<string, string | null>;

export interface DeskDecorAssignment {
  readonly deskIndex: number;
  readonly code: string;
}

/**
 * What each desk shows: the synced item of a connected student, otherwise the
 * one from the desk map.
 */
export function resolveDeskDecor(
  desks: readonly {
    readonly deskIndex: number;
    readonly userId: string | null;
    readonly deskDecor?: { readonly shopItemCode: string } | null | undefined;
  }[],
  live?: LiveDeskDecor,
): DeskDecorAssignment[] {
  return desks.flatMap((desk) => {
    const synced = desk.userId === null ? undefined : live?.get(desk.userId);
    const code =
      synced === undefined ? (desk.deskDecor?.shopItemCode ?? null) : synced;
    return code === null ? [] : [{ deskIndex: desk.deskIndex, code }];
  });
}

/** One object per decorated desk; unknown codes and desks are left out. */
export function planDeskDecorPlacements(
  layout: ClassroomLayout,
  assignments: readonly DeskDecorAssignment[],
): KitPlacement[] {
  const students = deriveDesks(layout).filter(
    (desk) => desk.kind === 'student',
  );
  return assignments.flatMap(({ deskIndex, code }) => {
    const desk = students[deskIndex - 1];
    const moduleId = resolveDeskDecorModule(code);
    if (!desk || !moduleId) return [];
    return [
      {
        moduleId,
        position: [
          desk.centerX + DECOR_OFFSET_X,
          DESK_HEIGHT,
          desk.centerZ + DECOR_OFFSET_Z,
        ] as const,
        rotationY: 0,
      },
    ];
  });
}
