import { describe, expect, test } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { buildClassroomScene } from './build-classroom-scene';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  resolveInteractableHit,
  type InteractableObjectNode,
} from './classroom-interactables';

const floor: InteractableObjectNode = {
  name: 'walkable-floor',
  userData: { walkableFloor: true },
  parent: null,
};

describe('deriveClassroomInteractables', () => {
  const interactables = deriveClassroomInteractables(CLASSROOM_LAYOUT);
  const byId = indexClassroomInteractables(interactables);

  test('covers all 3 interaction classes and maps each object to its intended target', () => {
    expect(interactables).toHaveLength(21);
    expect(byId.get('board')).toMatchObject({
      type: 'board',
      interactionClass: 'opens_panel',
      panelKey: 'activities',
    });
    expect(byId.get('shelf')).toMatchObject({
      type: 'shelf',
      interactionClass: 'opens_panel',
      panelKey: 'material',
    });
    expect(byId.get('bulletin-board')).toMatchObject({
      type: 'bulletin-board',
      interactionClass: 'opens_panel',
      panelKey: 'notices',
    });
    expect(byId.get('shop')).toMatchObject({
      type: 'shop',
      interactionClass: 'opens_panel',
      panelKey: 'shop',
    });
    expect(byId.get('tutor-bot')).toMatchObject({
      type: 'tutor-bot',
      interactionClass: 'opens_panel',
      panelKey: 'bot',
    });
    expect(byId.get('bot-station')).toMatchObject({
      type: 'bot-station',
      interactionClass: 'opens_panel',
      panelKey: 'bot',
    });
    expect(byId.get('teacher-desk')).toMatchObject({
      type: 'teacher-desk',
      interactionClass: 'opens_panel',
      panelKey: 'members',
    });
    expect(byId.get('pet')).toMatchObject({
      type: 'pet',
      interactionClass: 'decorative',
    });
    expect(byId.get('pet')?.panelKey).toBeUndefined();
    expect(byId.get('entrance')).toMatchObject({
      type: 'entrance',
      interactionClass: 'direct_transition',
    });
    expect(byId.get('entrance')?.panelKey).toBeUndefined();

    for (let deskIndex = 1; deskIndex <= 12; deskIndex += 1) {
      expect(byId.get(`student-desk:${deskIndex}`)).toMatchObject({
        type: 'student-desk',
        interactionClass: 'opens_panel',
        panelKey: 'grades',
        deskIndex,
      });
    }
  });

  test('keeps pet and tutor-bot strictly separate in id, interaction class, and position', () => {
    const pet = byId.get('pet')!;
    const bot = byId.get('tutor-bot')!;
    expect(pet.id).not.toBe(bot.id);
    expect(pet.interactionClass).toBe('decorative');
    expect(bot.interactionClass).toBe('opens_panel');
    expect(bot.panelKey).toBe('bot');
    expect(pet.worldPosition).not.toEqual(bot.worldPosition);
  });
});

describe('bot station', () => {
  test('is separate from the tutor bot and sits at its own prop spec', () => {
    const byId = indexClassroomInteractables(
      deriveClassroomInteractables(CLASSROOM_LAYOUT),
    );
    const station = byId.get('bot-station')!;
    const bot = byId.get('tutor-bot')!;
    expect(station.id).not.toBe(bot.id);
    expect(station.worldPosition).not.toEqual(bot.worldPosition);
    expect(station.panelKey).toBe(bot.panelKey);
  });

  test('resolves a hit on its proxy to the bot-station interactable', () => {
    const byId = indexClassroomInteractables(
      deriveClassroomInteractables(CLASSROOM_LAYOUT),
    );
    const built = buildClassroomScene(CLASSROOM_LAYOUT);
    const station = built.root.getObjectByName('classroom-bot-station')!;
    expect(
      resolveInteractableHit(
        [{ object: station.children[0] as unknown as InteractableObjectNode }],
        byId,
      )?.id,
    ).toBe('bot-station');
    built.dispose();
  });
});

describe('resolveInteractableHit', () => {
  const byId = indexClassroomInteractables(
    deriveClassroomInteractables(CLASSROOM_LAYOUT),
  );

  test('returns undefined when intersections are empty or floor is nearest', () => {
    expect(resolveInteractableHit([], byId)).toBeUndefined();
    expect(
      resolveInteractableHit(
        [
          { object: floor },
          {
            object: {
              name: 'classroom-board',
              userData: { placeholder: 'board' },
              parent: null,
            },
          },
        ],
        byId,
      ),
    ).toBeUndefined();
  });

  test('resolves instanced student desks and desk legs accurately', () => {
    const studentDesksNode: InteractableObjectNode = {
      name: 'student-desks',
      userData: {},
      parent: null,
    };
    const deskLegsNode: InteractableObjectNode = {
      name: 'desk-legs',
      userData: {},
      parent: null,
    };

    expect(
      resolveInteractableHit(
        [{ object: studentDesksNode, instanceId: 0 }, { object: floor }],
        byId,
      )?.id,
    ).toBe('student-desk:1');

    expect(
      resolveInteractableHit(
        [{ object: studentDesksNode, instanceId: 11 }, { object: floor }],
        byId,
      )?.id,
    ).toBe('student-desk:12');

    // Instances 0..3 belong to the teacher desk; 4..7 belong to student desk 1.
    expect(
      resolveInteractableHit(
        [{ object: deskLegsNode, instanceId: 3 }, { object: floor }],
        byId,
      )?.id,
    ).toBe('teacher-desk');

    expect(
      resolveInteractableHit(
        [{ object: deskLegsNode, instanceId: 4 }, { object: floor }],
        byId,
      )?.id,
    ).toBe('student-desk:1');

    expect(
      resolveInteractableHit(
        [{ object: deskLegsNode, instanceId: 11 }, { object: floor }],
        byId,
      )?.id,
    ).toBe('student-desk:2');
  });

  test('walks parent chain for placeholder groups and teacher-desk in built scene', () => {
    const built = buildClassroomScene(CLASSROOM_LAYOUT);
    try {
      const placeholderNames = [
        ['classroom-board', 'board'],
        ['classroom-shelf', 'shelf'],
        ['classroom-bulletin-board', 'bulletin-board'],
        ['classroom-shop', 'shop'],
        ['classroom-pet', 'pet'],
        ['classroom-tutor-bot', 'tutor-bot'],
      ] as const;

      for (const [objectName, expectedId] of placeholderNames) {
        const group = built.root.getObjectByName(objectName)!;
        const childMesh = group.children[0]!;
        expect(resolveInteractableHit([{ object: childMesh }], byId)?.id).toBe(
          expectedId,
        );
        const interactable = byId.get(expectedId)!;
        expect(
          Math.abs(group.position.x - interactable.worldPosition[0]),
        ).toBeLessThanOrEqual(0.2);
        expect(
          Math.abs(group.position.z - interactable.worldPosition[2]),
        ).toBeLessThanOrEqual(0.2);
      }

      const station = built.root.getObjectByName('classroom-bot-station')!;
      expect(
        resolveInteractableHit([{ object: station.children[0]! }], byId)?.id,
      ).toBe('bot-station');
      // Walk-up target is the floor in front of the prop, not its centre.
      expect(byId.get('bot-station')!.worldPosition[0]).toBeGreaterThan(
        station.position.x + 0.6,
      );

      const door = built.root.getObjectByName('classroom-door')!;
      expect(
        resolveInteractableHit([{ object: door.children[0]! }], byId)?.id,
      ).toBe('entrance');
      expect(door.position.x).toBeCloseTo(
        byId.get('entrance')!.worldPosition[0],
      );
      expect(byId.get('entrance')!.worldPosition).toEqual([
        0,
        0,
        CLASSROOM_LAYOUT.bounds.maxZ + 0.05,
      ]);

      const entrance = built.root.getObjectByName('entrance')!;
      expect(resolveInteractableHit([{ object: entrance }], byId)?.id).toBe(
        'entrance',
      );

      const teacherDesk = built.root.getObjectByName('teacher-desk')!;
      expect(resolveInteractableHit([{ object: teacherDesk }], byId)?.id).toBe(
        'teacher-desk',
      );

      const zone = built.root.getObjectByName('teaching-zone')!;
      expect(resolveInteractableHit([{ object: zone }], byId)).toBeUndefined();
    } finally {
      built.dispose();
    }
  });
});
