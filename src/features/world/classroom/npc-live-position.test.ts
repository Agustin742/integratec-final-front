import { describe, expect, test } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
} from './classroom-interactables';
import {
  createNpcLivePositions,
  npcFollowOffset,
  resolveLiveInteractable,
} from './npc-live-position';
import { selectProximityTarget } from './proximity';

const byId = indexClassroomInteractables(
  deriveClassroomInteractables(CLASSROOM_LAYOUT),
);

describe('resolveLiveInteractable', () => {
  test('moves an NPC interactable to its live position, keeping the rest', () => {
    const positions = createNpcLivePositions();
    positions.set('tutorBot', { x: 3, z: -2 });
    const bot = byId.get('tutor-bot')!;
    const live = resolveLiveInteractable(bot, positions);
    expect(live.worldPosition).toEqual([3, bot.worldPosition[1], -2]);
    expect(live.id).toBe('tutor-bot');
    expect(live.footprint).toBe(bot.footprint);
    expect(bot.worldPosition[0]).not.toBe(3);
  });

  test('returns the very same object when nothing moved it', () => {
    const positions = createNpcLivePositions();
    const bot = byId.get('tutor-bot')!;
    const shop = byId.get('shop')!;
    expect(resolveLiveInteractable(bot, positions)).toBe(bot);
    expect(resolveLiveInteractable(bot, undefined)).toBe(bot);
    positions.set('tutorBot', { x: 3, z: -2 });
    expect(resolveLiveInteractable(shop, positions)).toBe(shop);
  });

  test('the highlight offset is how far the bot walked from its catalog spot', () => {
    const positions = createNpcLivePositions();
    const bot = byId.get('tutor-bot')!;
    expect(npcFollowOffset(bot, positions)).toEqual([0, 0]);
    positions.set('tutorBot', {
      x: bot.worldPosition[0] + 1.5,
      z: bot.worldPosition[2] - 0.5,
    });
    const [dx, dz] = npcFollowOffset(bot, positions);
    expect(dx).toBeCloseTo(1.5, 5);
    expect(dz).toBeCloseTo(-0.5, 5);
    expect(npcFollowOffset(byId.get('shop')!, positions)).toEqual([0, 0]);
  });

  test('proximity follows the bot instead of its home', () => {
    const positions = createNpcLivePositions();
    const bot = byId.get('tutor-bot')!;
    const standingAt = { x: 2, z: 2 };
    expect(
      selectProximityTarget({ position: standingAt, candidates: [bot] }),
    ).toBeUndefined();
    positions.set('tutorBot', { x: 2.5, z: 2 });
    expect(
      selectProximityTarget({
        position: standingAt,
        candidates: [resolveLiveInteractable(bot, positions)],
      }),
    ).toBe('tutor-bot');
  });
});
