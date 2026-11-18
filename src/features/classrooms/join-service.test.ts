import { http, HttpResponse } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  TEST_API_BASE_URL,
  createAcceptInvitationHandler,
  createJoinClassroomByCodeHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { joinMessages } from './join-messages';
import {
  joinClassroomByCodeSchema,
  readClassroomJoinOutcome,
  validateInvitationQueryToken,
} from './join-schema';
import {
  acceptClassroomInvitation,
  isJoinCancellation,
  joinClassroomWithCode,
} from './join-service';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

function createSignedInTestClient(accessToken = 'student-access-token') {
  return createApiClient({
    baseUrl: TEST_API_BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

describe('join-schema', () => {
  test('validates and uppercases classroom join codes while keeping normalizable letters', () => {
    expect(joinClassroomByCodeSchema.parse({ code: '  k7p9x2m  ' })).toEqual({
      code: 'K7P9X2M',
    });
    expect(joinClassroomByCodeSchema.parse({ code: 'aula2026' })).toEqual({
      code: 'AULA2026',
    });

    expect(joinClassroomByCodeSchema.safeParse({ code: '   ' }).success).toBe(
      false,
    );
    expect(joinClassroomByCodeSchema.safeParse({ code: 'ab1' }).success).toBe(
      false,
    );
    expect(
      joinClassroomByCodeSchema.safeParse({ code: 'K7P9-X2M' }).success,
    ).toBe(false);
    expect(
      joinClassroomByCodeSchema.safeParse({ code: 'A'.repeat(33) }).success,
    ).toBe(false);
  });

  test('validates invitation query tokens without letting duplicate or whitespace tokens pass', () => {
    expect(validateInvitationQueryToken(new URLSearchParams(''))).toEqual({
      status: 'absent',
    });
    expect(
      validateInvitationQueryToken(
        new URLSearchParams('token=inv-valid-student-token'),
      ),
    ).toEqual({
      status: 'valid',
      token: 'inv-valid-student-token',
    });

    for (const query of [
      'token=',
      'token=%20%20',
      'token=inv+1',
      'token=a&token=b',
      `token=${'x'.repeat(129)}`,
    ]) {
      expect(
        validateInvitationQueryToken(new URLSearchParams(query)),
        query,
      ).toEqual({ status: 'invalid' });
    }
  });

  test('reads join outcome only when classroomId matches the active route', () => {
    const validOutcome = {
      classroomId: 'classroom-demo-1',
      membershipId: 'membership-student-1',
      role: 'STUDENT' as const,
      desk: { id: 'desk-4', deskIndex: 4 },
      alreadyMember: false,
    };

    expect(
      readClassroomJoinOutcome(
        { joinOutcome: validOutcome },
        'classroom-demo-1',
      ),
    ).toEqual(validOutcome);
    expect(
      readClassroomJoinOutcome(
        { joinOutcome: validOutcome },
        'other-classroom',
      ),
    ).toBeNull();
    expect(readClassroomJoinOutcome(null, 'classroom-demo-1')).toBeNull();
    expect(
      readClassroomJoinOutcome(
        { joinOutcome: { classroomId: 'classroom-demo-1' } },
        'classroom-demo-1',
      ),
    ).toBeNull();
  });
});

describe('join-service', () => {
  test('accepts a valid invitation and treats repeated same-user acceptance as idempotent', async () => {
    mswServer.use(createAcceptInvitationHandler());
    const client = createSignedInTestClient('token-user-a');

    const first = await acceptClassroomInvitation(client, {
      token: 'inv-valid-student-token',
    });
    expect(first).toEqual({
      classroomId: 'classroom-demo-1',
      membershipId: 'membership-student-1',
      role: 'STUDENT',
      desk: { id: 'desk-4', deskIndex: 4 },
      alreadyMember: false,
    });

    const second = await acceptClassroomInvitation(client, {
      token: 'inv-valid-student-token',
    });
    expect(second.alreadyMember).toBe(true);
    expect(second.membershipId).toBe(first.membershipId);
  });

  test.each(['invitations/accept', 'classrooms/join'] as const)(
    'reports uncertainty and recovery without automatically retrying %s after a transport failure',
    async (endpoint) => {
      let requests = 0;
      mswServer.use(
        http.post(`${TEST_API_BASE_URL}/${endpoint}`, () => {
          requests += 1;
          return HttpResponse.error();
        }),
      );
      const client = createSignedInTestClient();
      const operation =
        endpoint === 'invitations/accept'
          ? acceptClassroomInvitation(client, {
              token: 'inv-valid-student-token',
            })
          : joinClassroomWithCode(client, { code: 'K7P9X2M' });
      await expect(operation).rejects.toMatchObject({
        kind: 'network',
        userMessage:
          'Se perdió la conexión y no pudimos confirmar si te uniste al aula. Revisá tus aulas antes de volver a intentarlo.',
      });
      expect(requests).toBe(1);
    },
  );

  test('maps invitation error statuses to privacy-safe es-AR messages without leaking server details', async () => {
    mswServer.use(createAcceptInvitationHandler());
    const client = createSignedInTestClient();

    for (const token of ['inv-revoked-token', 'inv-used-token']) {
      await expect(
        acceptClassroomInvitation(client, { token }),
      ).rejects.toMatchObject({
        status: 400,
        userMessage: joinMessages.errors.invitationInvalidOrExpired,
        fieldErrors: {},
      });
    }

    await expect(
      acceptClassroomInvitation(client, { token: 'inv-expired-token' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      userMessage: joinMessages.errors.invitationInvalidOrExpired,
      fieldErrors: {},
    });

    await expect(
      acceptClassroomInvitation(client, { token: 'inv-unknown-token' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      userMessage: joinMessages.errors.invitationInvalidOrExpired,
      fieldErrors: {},
    });

    await expect(
      acceptClassroomInvitation(client, { token: 'inv-conflict-token' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      userMessage: joinMessages.errors.invitationConflict,
      fieldErrors: {},
    });

    await expect(
      acceptClassroomInvitation(client, { token: 'inv-rate-limited-token' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      userMessage: joinMessages.errors.rateLimited,
      fieldErrors: {},
    });

    const unauthenticatedClient = createApiClient({
      baseUrl: TEST_API_BASE_URL,
    });
    await expect(
      acceptClassroomInvitation(unauthenticatedClient, {
        token: 'inv-valid-student-token',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'unauthenticated',
      status: 401,
      userMessage: joinMessages.errors.unauthenticated,
    });
  });

  test('joins a classroom by normalized code and handles idempotent re-join', async () => {
    const seenPayloads: unknown[] = [];
    mswServer.use(
      createJoinClassroomByCodeHandler({
        onRequest: (_request, body) => {
          seenPayloads.push(body);
        },
      }),
    );
    const client = createSignedInTestClient('token-student-1');

    const first = await joinClassroomWithCode(client, { code: '  k7p9x2m  ' });
    expect(seenPayloads).toEqual([{ code: 'K7P9X2M' }]);
    expect(first).toEqual({
      classroomId: 'classroom-demo-1',
      membershipId: 'membership-student-1',
      role: 'STUDENT',
      desk: { id: 'desk-4', deskIndex: 4 },
      alreadyMember: false,
    });

    const second = await joinClassroomWithCode(client, { code: 'K7P9X2M' });
    expect(second.alreadyMember).toBe(true);
    expect(second.membershipId).toBe(first.membershipId);
    expect(second.desk).toEqual(first.desk);
  });

  test('maps join-by-code error classes (400, 404, 409, 429, network, malformed payload)', async () => {
    mswServer.use(createJoinClassroomByCodeHandler());
    const client = createSignedInTestClient();

    for (const [code, status, expectedMessage] of [
      ['REVOKED1', 400, joinMessages.errors.codeInvalidOrExpired],
      ['EXPIRED1', 400, joinMessages.errors.codeInvalidOrExpired],
      ['UNKNOWN1', 404, joinMessages.errors.codeInvalidOrExpired],
      ['FULLCODE', 409, joinMessages.errors.codeExhaustedOrConflict],
      ['RATELIM1', 429, joinMessages.errors.rateLimited],
    ] as const) {
      await expect(joinClassroomWithCode(client, { code })).rejects.toThrow(
        ApiError,
      );
      await expect(
        joinClassroomWithCode(client, { code }),
      ).rejects.toMatchObject({
        status,
        userMessage: expectedMessage,
        fieldErrors: {},
      });
    }

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/classrooms/join`, () =>
        HttpResponse.error(),
      ),
    );
    await expect(
      joinClassroomWithCode(client, { code: 'K7P9X2M' }),
    ).rejects.toMatchObject({
      kind: 'network',
      userMessage: joinMessages.errors.network,
    });

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/classrooms/join`, () =>
        HttpResponse.json({ classroomId: '' }, { status: 201 }),
      ),
    );
    await expect(
      joinClassroomWithCode(client, { code: 'K7P9X2M' }),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      userMessage: joinMessages.errors.unexpected,
    });
  });

  test('rethrows AbortError without wrapping it as a join error', async () => {
    mswServer.use(createAcceptInvitationHandler());
    const client = createSignedInTestClient();
    const controller = new AbortController();
    controller.abort();

    try {
      await acceptClassroomInvitation(
        client,
        { token: 'inv-valid-student-token' },
        { signal: controller.signal },
      );
      expect.unreachable('Expected AbortError');
    } catch (error) {
      expect(isJoinCancellation(error)).toBe(true);
    }
  });
});
