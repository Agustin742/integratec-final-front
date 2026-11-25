import type { ClassroomLayout } from '@/realtime';
import type { PlaceholderKind } from './build-classroom-scene';
import {
  DESK_HEIGHT,
  TEACHER_DESK_INDEX,
  deriveDesks,
} from './classroom-desks';

/** Width of the back-wall entrance gap (shell); the door and exit target sit in it. */
export const ENTRANCE_WIDTH = 2;

export interface ClassroomPropSpec {
  readonly position: readonly [number, number, number];
  readonly rotationY?: number;
  readonly interactablePosition: readonly [number, number, number];
  readonly footprint: readonly [number, number];
  readonly beaconHeight: number;
}

export interface ClassroomPropSpecs {
  readonly board: ClassroomPropSpec;
  readonly shelf: ClassroomPropSpec;
  readonly bulletinBoard: ClassroomPropSpec;
  readonly shop: ClassroomPropSpec;
  readonly pet: ClassroomPropSpec;
  readonly tutorBot: ClassroomPropSpec;
  readonly botStation: ClassroomPropSpec;
  readonly entrance: ClassroomPropSpec;
}

/**
 * Single source of truth for classroom prop placements, footprints, and
 * beacon heights shared between `buildClassroomScene` and the interactable
 * picking/highlight catalog. Keeps zero `three` runtime imports so the
 * accessible DOM bar never pulls Three.js into the eager chunk.
 */
export function deriveClassroomPropSpecs(
  layout: ClassroomLayout,
): ClassroomPropSpecs {
  const { bounds } = layout;
  const frontZ = bounds.minZ;
  const teacher = deriveDesks(layout).find((desk) => desk.kind === 'teacher');
  const tutorBotPos: readonly [number, number, number] = [
    teacher ? teacher.centerX + teacher.width / 2 - 0.5 : 0,
    DESK_HEIGHT,
    teacher ? teacher.centerZ : 0,
  ];

  return {
    board: {
      position: [0, 0, frontZ],
      interactablePosition: [0, 0, frontZ + 0.14],
      footprint: [4.4, 0.28],
      beaconHeight: 2.65,
    },
    shelf: {
      position: [-6.7, 0, frontZ],
      interactablePosition: [-6.7, 0, frontZ + 0.14],
      footprint: [1.8, 0.32],
      beaconHeight: 1.85,
    },
    bulletinBoard: {
      position: [bounds.minX, 0, bounds.maxZ - 1.8],
      rotationY: Math.PI / 2,
      interactablePosition: [bounds.minX + 0.16, 0, bounds.maxZ - 1.8],
      footprint: [0.32, 2.0],
      beaconHeight: 2.35,
    },
    shop: {
      position: [4.8, 0, frontZ],
      interactablePosition: [4.8, 0, frontZ + 0.14],
      footprint: [2.0, 0.32],
      beaconHeight: 2.25,
    },
    pet: {
      position: [7, 0, frontZ],
      interactablePosition: [7, 0, frontZ + 0.14],
      footprint: [1.0, 0.32],
      beaconHeight: 0.85,
    },
    tutorBot: {
      position: tutorBotPos,
      interactablePosition: tutorBotPos,
      footprint: [0.45, 0.45],
      beaconHeight: DESK_HEIGHT + 0.95,
    },
    // Tutor Corner under the left window bay, facing +x (`docs/art/tutor-bot.md`).
    botStation: {
      position: [-6.95, 0, 1.05],
      rotationY: Math.PI / 2,
      // Walk-up strip on the floor in front (+x) of the prop, not its centre.
      interactablePosition: [-5.95, 0, 1.05],
      footprint: [0.7, 1.53],
      beaconHeight: 1.6,
    },
    entrance: {
      position: [0, 0.012, bounds.maxZ + 0.05],
      interactablePosition: [0, 0, bounds.maxZ + 0.05],
      footprint: [ENTRANCE_WIDTH, 0.6],
      beaconHeight: 0.55,
    },
  };
}

export type InteractionClass =
  'decorative' | 'opens_panel' | 'direct_transition';

export type ClassroomInteractableType =
  | 'board'
  | 'shelf'
  | 'bulletin-board'
  | 'shop'
  | 'pet'
  | 'tutor-bot'
  | 'bot-station'
  | 'student-desk'
  | 'teacher-desk'
  | 'entrance';

export type ClassroomInteractablePanelKey =
  'activities' | 'material' | 'notices' | 'shop' | 'bot' | 'members' | 'grades';

export interface ClassroomInteractable {
  readonly id: string;
  readonly type: ClassroomInteractableType;
  readonly interactionClass: InteractionClass;
  readonly panelKey?: ClassroomInteractablePanelKey;
  readonly deskIndex?: number;
  readonly worldPosition: readonly [number, number, number];
  readonly footprint: readonly [number, number];
  readonly beaconHeight: number;
}

export interface InteractableObjectNode {
  readonly name?: string;
  readonly userData: Record<string, unknown>;
  readonly parent: InteractableObjectNode | null;
}

export interface InteractableIntersection {
  readonly object: InteractableObjectNode;
  readonly instanceId?: number | undefined;
}

export interface InteractablePointerEvent {
  readonly nativeEvent: {
    readonly button?: number;
    readonly pointerType?: string;
  };
  readonly pointerType?: string;
  readonly intersections: readonly InteractableIntersection[];
  readonly stopPropagation: () => void;
}

const PLACEHOLDER_INTERACTABLE_IDS: ReadonlySet<PlaceholderKind> = new Set([
  'board',
  'shelf',
  'bulletin-board',
  'shop',
  'pet',
  'tutor-bot',
  'bot-station',
  'entrance',
]);

/**
 * Derives the typed catalog of 3D interactable objects directly from the
 * authoritative classroom layout and desk footprints so world positions,
 * highlight footprints, and collision obstacles stay in sync.
 */
export function deriveClassroomInteractables(
  layout: ClassroomLayout,
): ClassroomInteractable[] {
  const specs = deriveClassroomPropSpecs(layout);
  const desks = deriveDesks(layout);
  const teacher = desks.find((desk) => desk.kind === 'teacher');
  const students = desks.filter((desk) => desk.kind === 'student');

  const interactables: ClassroomInteractable[] = [
    {
      id: 'board',
      type: 'board',
      interactionClass: 'opens_panel',
      panelKey: 'activities',
      worldPosition: specs.board.interactablePosition,
      footprint: specs.board.footprint,
      beaconHeight: specs.board.beaconHeight,
    },
    {
      id: 'shelf',
      type: 'shelf',
      interactionClass: 'opens_panel',
      panelKey: 'material',
      worldPosition: specs.shelf.interactablePosition,
      footprint: specs.shelf.footprint,
      beaconHeight: specs.shelf.beaconHeight,
    },
    {
      id: 'bulletin-board',
      type: 'bulletin-board',
      interactionClass: 'opens_panel',
      panelKey: 'notices',
      worldPosition: specs.bulletinBoard.interactablePosition,
      footprint: specs.bulletinBoard.footprint,
      beaconHeight: specs.bulletinBoard.beaconHeight,
    },
    {
      id: 'shop',
      type: 'shop',
      interactionClass: 'opens_panel',
      panelKey: 'shop',
      worldPosition: specs.shop.interactablePosition,
      footprint: specs.shop.footprint,
      beaconHeight: specs.shop.beaconHeight,
    },
    {
      id: 'pet',
      type: 'pet',
      interactionClass: 'decorative',
      worldPosition: specs.pet.interactablePosition,
      footprint: specs.pet.footprint,
      beaconHeight: specs.pet.beaconHeight,
    },
    {
      id: 'tutor-bot',
      type: 'tutor-bot',
      interactionClass: 'opens_panel',
      panelKey: 'bot',
      worldPosition: specs.tutorBot.interactablePosition,
      footprint: specs.tutorBot.footprint,
      beaconHeight: specs.tutorBot.beaconHeight,
    },
    {
      id: 'bot-station',
      type: 'bot-station',
      interactionClass: 'opens_panel',
      panelKey: 'bot',
      worldPosition: specs.botStation.interactablePosition,
      footprint: specs.botStation.footprint,
      beaconHeight: specs.botStation.beaconHeight,
    },
  ];

  if (teacher) {
    interactables.push({
      id: 'teacher-desk',
      type: 'teacher-desk',
      interactionClass: 'opens_panel',
      panelKey: 'members',
      worldPosition: [teacher.centerX, 0, teacher.centerZ],
      footprint: [teacher.width, teacher.depth],
      beaconHeight: DESK_HEIGHT + 0.45,
    });
  }

  students.forEach((desk, index) => {
    const deskIndex = index + 1;
    interactables.push({
      id: `student-desk:${deskIndex}`,
      type: 'student-desk',
      interactionClass: 'opens_panel',
      panelKey: 'grades',
      deskIndex,
      worldPosition: [desk.centerX, 0, desk.centerZ],
      footprint: [desk.width, desk.depth],
      beaconHeight: DESK_HEIGHT + 0.45,
    });
  });

  interactables.push({
    id: 'entrance',
    type: 'entrance',
    interactionClass: 'direct_transition',
    worldPosition: specs.entrance.interactablePosition,
    footprint: specs.entrance.footprint,
    beaconHeight: specs.entrance.beaconHeight,
  });

  return interactables;
}

export function indexClassroomInteractables(
  interactables: readonly ClassroomInteractable[],
): ReadonlyMap<string, ClassroomInteractable> {
  return new Map(interactables.map((item) => [item.id, item]));
}

/**
 * Resolves the nearest raycast intersection into a `ClassroomInteractable`.
 * When the walkable floor is nearest, returns `undefined` so floor movement wins.
 */
export function resolveInteractableHit(
  intersections: readonly InteractableIntersection[],
  interactablesById: ReadonlyMap<string, ClassroomInteractable>,
): ClassroomInteractable | undefined {
  const nearest = intersections[0];
  if (!nearest) return undefined;

  const { object, instanceId } = nearest;
  if (object.userData.walkableFloor === true) {
    return undefined;
  }

  if (object.name === 'student-desks' && instanceId !== undefined) {
    return interactablesById.get(`student-desk:${instanceId + 1}`);
  }

  if (object.name === 'desk-legs' && instanceId !== undefined) {
    const deskIdx = Math.floor(instanceId / 4);
    if (deskIdx === TEACHER_DESK_INDEX) {
      return interactablesById.get('teacher-desk');
    }
    const studentNumber = deskIdx > TEACHER_DESK_INDEX ? deskIdx : deskIdx + 1;
    return interactablesById.get(`student-desk:${studentNumber}`);
  }

  for (
    let current: InteractableObjectNode | null = object;
    current;
    current = current.parent
  ) {
    if (current.name === 'teacher-desk') {
      return interactablesById.get('teacher-desk');
    }
    const placeholder = current.userData.placeholder;
    if (
      typeof placeholder === 'string' &&
      PLACEHOLDER_INTERACTABLE_IDS.has(placeholder as PlaceholderKind)
    ) {
      return interactablesById.get(placeholder);
    }
  }

  return undefined;
}
