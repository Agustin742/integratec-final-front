import { deriveNpcHomes, type ClassroomLayout } from '@/realtime';
import type { PlaceholderKind } from './build-classroom-scene';
import {
  DESK_HEIGHT,
  TEACHER_DESK_INDEX,
  deriveDesks,
} from './classroom-desks';

/** Half the station's 1.278 m depth once rotated to face +x. */
const BOT_STATION_HALF_DEPTH = 1.278 / 2;
/** Clear floor between the station and the bot's home hover spot. */
const BOT_HOME_GAP = 0.7;

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
  readonly reportCardStand: ClassroomPropSpec;
  readonly chatComputer: ClassroomPropSpec;
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
  // Tutor Corner (`docs/art/tutor-bot.md`); the bot hovers just in front of it.
  const stationX = -6.95;
  const stationZ = 1.05;
  // Michi sleeps on its bed cushion; its live position replaces this once it walks.
  const petHome = deriveNpcHomes(layout).pet;
  const botHome: readonly [number, number, number] = [
    stationX + BOT_STATION_HALF_DEPTH + BOT_HOME_GAP,
    0,
    stationZ,
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
      interactablePosition: [petHome.x, 0, petHome.z],
      footprint: [0.5, 0.5],
      beaconHeight: 0.7,
    },
    // Home of the roaming tutor bot: where it rests when not moving. Its live
    // position replaces `interactablePosition` once it walks (`npc-live-position`).
    tutorBot: {
      position: botHome,
      rotationY: Math.PI / 2,
      interactablePosition: botHome,
      footprint: [0.6, 0.6],
      beaconHeight: 1.35,
    },
    // Tutor Corner under the left window bay, facing +x (`docs/art/tutor-bot.md`).
    botStation: {
      position: [stationX, 0, stationZ],
      rotationY: Math.PI / 2,
      // Walk-up strip on the floor in front (+x) of the prop, not its centre.
      interactablePosition: [-5.95, 0, 1.05],
      footprint: [0.7, 1.53],
      beaconHeight: 1.6,
    },
    // Report card stand on the front wall between the board and the shop kiosk
    // (`docs/art/classroom-interactive.md`); pivot at its footprint centre.
    reportCardStand: {
      position: [2.95, 0, frontZ + 0.32],
      interactablePosition: [2.95, 0, frontZ + 0.95],
      footprint: [0.78, 0.48],
      beaconHeight: 1.6,
    },
    // Chat computer on the left wall, facing +x. The doc's right-wall spot would
    // stand in front of the isometric camera, so it moves to the far wall.
    chatComputer: {
      position: [bounds.minX + 0.38, 0, -3],
      rotationY: Math.PI / 2,
      interactablePosition: [bounds.minX + 1.15, 0, -3],
      footprint: [0.55, 0.88],
      beaconHeight: 1.5,
    },
    entrance: {
      position: [0, 0.012, bounds.maxZ + 0.05],
      interactablePosition: [0, 0, bounds.maxZ + 0.05],
      footprint: [ENTRANCE_WIDTH, 0.6],
      beaconHeight: 0.55,
    },
  };
}

/**
 * `npc` targets a synced roaming character (`npcId`): it follows the NPC and
 * hands the interaction to the realtime layer instead of opening a panel.
 */
export type InteractionClass =
  'decorative' | 'opens_panel' | 'direct_transition' | 'npc';

export type ClassroomInteractableType =
  | 'board'
  | 'shelf'
  | 'bulletin-board'
  | 'shop'
  | 'pet'
  | 'tutor-bot'
  | 'bot-station'
  | 'chat-computer'
  | 'report-card-stand'
  | 'student-desk'
  | 'teacher-desk'
  | 'entrance';

export type ClassroomInteractablePanelKey =
  | 'activities'
  | 'material'
  | 'notices'
  | 'shop'
  | 'bot'
  | 'chat'
  | 'members'
  | 'grades';

export interface ClassroomInteractable {
  readonly id: string;
  readonly type: ClassroomInteractableType;
  readonly interactionClass: InteractionClass;
  readonly panelKey?: ClassroomInteractablePanelKey;
  readonly deskIndex?: number;
  /** Synced NPC id for `npc` interactables (key of `ClassroomState.npcs`). */
  readonly npcId?: string;
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
  'chat-computer',
  'report-card-stand',
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
      interactionClass: 'npc',
      npcId: 'pet',
      worldPosition: specs.pet.interactablePosition,
      footprint: specs.pet.footprint,
      beaconHeight: specs.pet.beaconHeight,
    },
    {
      id: 'tutor-bot',
      type: 'tutor-bot',
      interactionClass: 'npc',
      npcId: 'tutorBot',
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
    {
      id: 'chat-computer',
      type: 'chat-computer',
      interactionClass: 'opens_panel',
      panelKey: 'chat',
      worldPosition: specs.chatComputer.interactablePosition,
      footprint: specs.chatComputer.footprint,
      beaconHeight: specs.chatComputer.beaconHeight,
    },
    {
      id: 'report-card-stand',
      type: 'report-card-stand',
      interactionClass: 'opens_panel',
      panelKey: 'grades',
      worldPosition: specs.reportCardStand.interactablePosition,
      footprint: specs.reportCardStand.footprint,
      beaconHeight: specs.reportCardStand.beaconHeight,
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

  if (instanceId !== undefined && object.userData.deskKind === 'student') {
    return interactablesById.get(
      `student-desk:${Math.floor(instanceId / 4) + 1}`,
    );
  }
  if (instanceId !== undefined && object.userData.deskKind === 'teacher') {
    return interactablesById.get('teacher-desk');
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
