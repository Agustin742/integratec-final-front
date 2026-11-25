import { describe, expect, test } from 'vitest';
import type { ActivityListItemDto } from './activity-schema';
import { groupActivities } from './activity-board-model';
import { formatActivityRelativeDue } from './format-activity-deadline';

const NOW = Date.parse('2026-11-24T12:00:00.000Z');

function item(
  overrides: Partial<ActivityListItemDto> & { id: string },
): ActivityListItemDto {
  return {
    classroomId: 'c',
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: overrides.id,
    description: '',
    opensAt: null,
    dueAt: '2026-12-07T12:00:00.000Z',
    allowLate: false,
    maxScore: 10,
    weightMultiplier: 1,
    publishedAt: null,
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-10T12:00:00.000Z',
    updatedAt: '2026-11-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('groupActivities', () => {
  test('staff: drafts, published and past due, in that order, skipping empty groups', () => {
    const groups = groupActivities(
      [
        item({ id: 'past', dueAt: '2026-11-01T12:00:00.000Z' }),
        item({ id: 'draft', state: 'DRAFT' }),
        item({ id: 'open' }),
      ],
      { isStaff: true, now: NOW },
    );
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['drafts', ['draft']],
      ['published', ['open']],
      ['closed', ['past']],
    ]);
    expect(
      groupActivities([item({ id: 'open' })], { isStaff: true, now: NOW }).map(
        (g) => g.key,
      ),
    ).toEqual(['published']);
  });

  test('students: to-do (pending, overdue) before delivered (submitted, graded)', () => {
    const groups = groupActivities(
      [
        item({ id: 'g', status: 'graded' }),
        item({ id: 'p', status: 'pending' }),
        item({ id: 'o', status: 'overdue' }),
        item({ id: 's', status: 'submitted' }),
      ],
      { isStaff: false, now: NOW },
    );
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['todo', ['p', 'o']],
      ['done', ['g', 's']],
    ]);
  });

  test('students without own status fall back to one published group', () => {
    const groups = groupActivities([item({ id: 'x' })], {
      isStaff: false,
      now: NOW,
    });
    expect(groups.map((g) => g.key)).toEqual(['published']);
  });
});

describe('formatActivityRelativeDue', () => {
  test('describes future and past instants in Spanish', () => {
    expect(formatActivityRelativeDue('2026-12-07T12:00:00.000Z', NOW)).toMatch(
      /13 días/,
    );
    expect(formatActivityRelativeDue('2026-11-20T12:00:00.000Z', NOW)).toMatch(
      /hace 4 días/,
    );
    expect(formatActivityRelativeDue('2026-11-24T15:00:00.000Z', NOW)).toMatch(
      /3 horas/,
    );
    expect(formatActivityRelativeDue('2026-11-25T12:00:00.000Z', NOW)).toMatch(
      /mañana/,
    );
  });
});
