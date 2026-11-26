import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiClient } from '@/api/client';
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
  it('reads the streak and earned badges from GET /gamification/me', async () => {
    const payload = {
      streak: {
        currentStreak: 4,
        bestStreak: 9,
        lastQualifyingDay: '2026-11-18',
      },
      badges: [
        {
          id: 'badge-1',
          code: 'FIRST_SUBMISSION',
          name: 'Primera entrega',
          description: 'Completaste tu primera entrega a tiempo.',
          awardedAt: '2026-11-15T14:00:00.000Z',
        },
      ],
    };
    server.use(createOwnStreakAndBadgesHandler({ payload }));

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    await expect(fetchOwnStreakAndBadges(client)).resolves.toEqual(payload);
  });

  it('rejects malformed payloads and negative streak counts', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/gamification/me`, () =>
        HttpResponse.json({
          streak: {
            currentStreak: -1,
            bestStreak: 0,
            lastQualifyingDay: null,
          },
          badges: [],
        }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(fetchOwnStreakAndBadges(client)).rejects.toMatchObject({
      kind: 'unexpected',
      status: null,
    });
  });

  it('scopes streak-and-badges query key by userId', () => {
    const keyA = ownStreakAndBadgesQueryKey('user-a');
    const keyB = ownStreakAndBadgesQueryKey('user-b');
    expect(keyA).not.toEqual(keyB);
  });
});
