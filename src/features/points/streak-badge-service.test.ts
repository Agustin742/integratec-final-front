import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { ownStreakAndBadgesQueryKey } from '@/api/query-keys';
import {
  TEST_API_BASE_URL,
  createOwnStreakAndBadgesHandler,
} from '@/test/msw/handlers';
import { fetchOwnStreakAndBadges } from './streak-badge-service';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('streak-badge-service', () => {
  it('reads server-computed streak and locked/unlocked badges without mutating them', async () => {
    server.use(
      createOwnStreakAndBadgesHandler({
        payload: {
          currentStreak: 4,
          bestStreak: 9,
          lastQualifiedDate: '2026-11-18',
          badges: [
            {
              id: 'badge-1',
              code: 'FIRST_SUBMISSION',
              name: 'Primera entrega',
              description: 'Completaste tu primera entrega a tiempo.',
              unlocked: true,
              unlockedAt: '2026-11-15T14:00:00.000Z',
            },
            {
              id: 'badge-2',
              code: 'STREAK_7',
              name: 'Semana constante',
              description: 'Mantené una racha de 7 días calificados.',
              unlocked: false,
              unlockedAt: null,
            },
          ],
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const first = await fetchOwnStreakAndBadges(client);
    const second = await fetchOwnStreakAndBadges(client);

    expect(first.currentStreak).toBe(4);
    expect(first.bestStreak).toBe(9);
    expect(first.lastQualifiedDate).toBe('2026-11-18');
    expect(first.badges).toHaveLength(2);
    expect(second).toEqual(first);
  });

  it('rejects malformed payloads and negative streak counts', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/users/me/streak-and-badges`, () =>
        HttpResponse.json({
          currentStreak: -1,
          bestStreak: 0,
          lastQualifiedDate: null,
          badges: [],
        }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(fetchOwnStreakAndBadges(client)).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('scopes streak-and-badges query key by userId', () => {
    const keyA = ownStreakAndBadgesQueryKey('user-a');
    const keyB = ownStreakAndBadgesQueryKey('user-b');
    expect(keyA).not.toEqual(keyB);
  });
});
