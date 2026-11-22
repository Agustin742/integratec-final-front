import type { ClassroomLayout } from '@/realtime';
import type { PlaceholderKind } from './build-classroom-scene';
import { DESK_HEIGHT, deriveDesks } from './classroom-desks';

export type InteractionClass =
  'decorative' | 'opens_panel' | 'direct_transition';

export type ClassroomInteractableType =
  | 'board'
  | 'shelf'
  | 'bulletin-board'
  | 'shop'
  | 'pet'
  | 'tutor-bot'
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
  const { bounds } = layout;
  const frontZ = bounds.minZ;
  const desks = deriveDesks(layout);
  const teacher = desks.find((desk) => desk.kind === 'teacher');
  const students = desks.filter((desk) => desk.kind === 'student');

  const interactables: ClassroomInteractable[] = [
    {
      id: 'board',
      type: 'board',
      interactionClass: 'opens_panel',
      panelKey: 'activities',
      worldPosition: [0, 0, frontZ + 0.14],
      footprint: [4.4, 0.28],
      beaconHeight: 2.65,
    },
    {
      id: 'shelf',
      type: 'shelf',
      interactionClass: 'opens_panel',
      panelKey: 'material',
      worldPosition: [-6.7, 0, frontZ + 0.14],
      footprint: [1.8, 0.32],
      beaconHeight: 1.85,
    },
    {
      id: 'bulletin-board',
      type: 'bulletin-board',
      interactionClass: 'opens_panel',
      panelKey: 'notices',
      worldPosition: [bounds.minX + 0.16, 0, bounds.maxZ - 1.8],
      footprint: [0.32, 2.0],
      beaconHeight: 2.35,
    },
    {
      id: 'shop',
      type: 'shop',
      interactionClass: 'opens_panel',
      panelKey: 'shop',
      worldPosition: [4.8, 0, frontZ + 0.14],
      footprint: [2.0, 0.32],
      beaconHeight: 2.25,
    },
    {
      id: 'pet',
      type: 'pet',
      interactionClass: 'decorative',
      worldPosition: [7, 0, frontZ + 0.14],
      footprint: [1.0, 0.32],
      beaconHeight: 0.85,
    },
    {
      id: 'tutor-bot',
      type: 'tutor-bot',
      interactionClass: 'opens_panel',
      panelKey: 'bot',
      worldPosition: [
        teacher ? teacher.centerX + teacher.width / 2 - 0.5 : 0,
        DESK_HEIGHT,
        teacher ? teacher.centerZ : 0,
      ],
      footprint: [0.45, 0.45],
      beaconHeight: DESK_HEIGHT + 0.95,
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
    worldPosition: [0, 0, bounds.maxZ + 0.05],
    footprint: [2.0, 0.6],
    beaconHeight: 0.55,
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
    const id = deskIdx === 0 ? 'teacher-desk' : `student-desk:${deskIdx}`;
    return interactablesById.get(id);
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
