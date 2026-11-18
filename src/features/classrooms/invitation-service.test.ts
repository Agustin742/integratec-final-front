import { HttpResponse, http } from 'msw';
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
  classroomInvitationsQueryKey,
  createClassroomInvitationsPredicate,
  createUserScopePredicate,
} from '@/api/query-keys';
import {
  TEST_API_BASE_URL,
  createClassroomInvitationsHandler,
  createCreateClassroomInvitationHandler,
  createGenerateJoinCodeHandler,
  createRevokeClassroomInvitationHandler,
  createRevokeJoinCodeHandler,
  type ClassroomInvitationPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  createClassroomInvitation,
  generateClassroomJoinCode,
  isAbortError,
  isUncertainWriteError,
  listClassroomInvitations,
  revokeClassroomInvitation,
  revokeClassroomJoinCode,
} from './invitation-service';
import { classroomMessages } from './messages';

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

const classroomId = '4e5f6a7b-0000-4000-8000-000000000032';
const sampleInvitation: ClassroomInvitationPayload = {
  id: '71000000-0000-4000-8000-000000000001',
  kind: 'EMAIL',
  targetEmail: 'student@example.edu.ar',
  role: 'STUDENT',
  maxUses: 1,
  useCount: 0,
  state: 'PENDING',
  expiresAt: '2026-11-25T16:00:00.000Z',
  createdAt: '2026-11-18T16:00:00.000Z',
};

describe('invitations query keys and service', () => {
  test('scopes classroomInvitationsQueryKey by userId and classroomId and normalizes params', () => {
    const key = classroomInvitationsQueryKey('user-1', classroomId, {
      page: -2,
      pageSize: 500,
      status: 'REVOKED',
    });

    expect(key[0]).toEqual({
      scope: { userId: 'user-1', classroomId, linkedChildId: null },
      domain: 'classrooms',
      resource: 'invitations',
      params: { page: 1, pageSize: 100, status: 'REVOKED' },
    });

    const defaultKey = classroomInvitationsQueryKey('user-1', classroomId);
    expect(defaultKey[0].params).toEqual({
      page: 1,
      pageSize: 20,
      status: 'PENDING',
    });

    const userPredicate = createUserScopePredicate('user-1');
    const invitationsPredicate = createClassroomInvitationsPredicate(
      'user-1',
      classroomId,
    );
    const otherClassroomKey = classroomInvitationsQueryKey(
      'user-1',
      'other-room',
    );
    const otherUserKey = classroomInvitationsQueryKey('user-2', classroomId);

    expect(userPredicate({ queryKey: key })).toBe(true);
    expect(invitationsPredicate({ queryKey: key })).toBe(true);
    expect(invitationsPredicate({ queryKey: otherClassroomKey })).toBe(false);
    expect(invitationsPredicate({ queryKey: otherUserKey })).toBe(false);
  });

  test('lists paginated invitations and normalizes nullable targetEmail and maxUses', async () => {
    let capturedUrl = '';
    mswServer.use(
      createClassroomInvitationsHandler({
        classroomId,
        items: [
          sampleInvitation,
          {
            id: '81000000-0000-4000-8000-000000000002',
            kind: 'JOIN_CODE',
            targetEmail: null,
            role: 'STUDENT',
            maxUses: null,
            useCount: 3,
            state: 'PENDING',
            expiresAt: '2026-11-25T16:00:00.000Z',
            createdAt: '2026-11-18T16:01:00.000Z',
          },
        ],
        onRequest: (request) => {
          capturedUrl = request.url;
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const response = await listClassroomInvitations(client, classroomId, {
      page: 1,
      pageSize: 20,
      status: 'ALL',
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('20');
    expect(url.searchParams.get('status')).toBe('ALL');
    expect(response.total).toBe(2);
    expect(response.items[0].targetEmail).toBe('student@example.edu.ar');
    expect(response.items[1].targetEmail).toBeNull();
    expect(response.items[1].maxUses).toBeNull();
  });

  test('rejects malformed 200 invitations list responses', async () => {
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${classroomId}/invitations`,
        () => HttpResponse.json({ invalid: true }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      listClassroomInvitations(client, classroomId),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      status: 200,
    });
  });

  test('creates STUDENT email invitation without Idempotency-Key and maps errors', async () => {
    let capturedBody: unknown;
    let idempotencyHeader: string | null = 'unset';
    mswServer.use(
      createCreateClassroomInvitationHandler({
        classroomId,
        onRequest: (request, body) => {
          capturedBody = body;
          idempotencyHeader = request.headers.get('idempotency-key');
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const created = await createClassroomInvitation(
      client,
      classroomId,
      'ana@example.edu.ar',
    );
    expect(capturedBody).toEqual({
      email: 'ana@example.edu.ar',
      role: 'STUDENT',
    });
    expect(idempotencyHeader).toBeNull();
    expect(created.token).toBe('invite-secret-token-0001');

    mswServer.use(
      createCreateClassroomInvitationHandler({
        classroomId,
        error: {
          status: 400,
          body: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid email',
            correlationId: 'corr-400',
            details: [{ field: 'email', messages: ['Correo inválido'] }],
          },
        },
      }),
    );
    await expect(
      createClassroomInvitation(client, classroomId, 'bad'),
    ).rejects.toMatchObject({
      kind: 'validation',
      status: 400,
      fieldErrors: { email: ['Correo inválido'] },
    });

    mswServer.use(
      createCreateClassroomInvitationHandler({
        classroomId,
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Denied',
            correlationId: 'corr-403',
          },
        },
      }),
    );
    await expect(
      createClassroomInvitation(client, classroomId, 'ana@example.edu.ar'),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
      userMessage: classroomMessages.invitations.email.errors.forbidden,
    });

    mswServer.use(
      createCreateClassroomInvitationHandler({
        classroomId,
        error: {
          status: 404,
          body: {
            code: 'NOT_FOUND',
            message: 'Missing',
            correlationId: 'corr-404',
          },
        },
      }),
    );
    await expect(
      createClassroomInvitation(client, classroomId, 'ana@example.edu.ar'),
    ).rejects.toMatchObject({
      kind: 'not-found',
      status: 404,
      userMessage: classroomMessages.invitations.email.errors.notFound,
    });

    mswServer.use(
      http.post(
        `${TEST_API_BASE_URL}/classrooms/${classroomId}/invitations`,
        () => HttpResponse.json({ broken: true }, { status: 201 }),
      ),
    );
    try {
      await createClassroomInvitation(
        client,
        classroomId,
        'ana@example.edu.ar',
      );
      throw new Error('Expected malformed 201 error');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(isUncertainWriteError(error)).toBe(true);
    }
  });

  test('revokes invitation and maps 400/403/404/uncertain errors', async () => {
    mswServer.use(
      createRevokeClassroomInvitationHandler({
        classroomId,
      }),
    );
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const result = await revokeClassroomInvitation(
      client,
      classroomId,
      sampleInvitation.id,
    );
    expect(result).toEqual({ id: sampleInvitation.id, state: 'REVOKED' });

    mswServer.use(
      createRevokeClassroomInvitationHandler({
        classroomId,
        error: {
          status: 400,
          body: {
            code: 'BAD_REQUEST',
            message: 'Already used',
            correlationId: 'corr-rev-400',
          },
        },
      }),
    );
    await expect(
      revokeClassroomInvitation(client, classroomId, sampleInvitation.id),
    ).rejects.toMatchObject({
      kind: 'bad-request',
      status: 400,
      userMessage: classroomMessages.invitations.list.revokeBadRequest,
    });

    mswServer.use(
      createRevokeClassroomInvitationHandler({
        classroomId,
        error: 'network',
      }),
    );
    try {
      await revokeClassroomInvitation(client, classroomId, sampleInvitation.id);
      throw new Error('Expected network error');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(isUncertainWriteError(error)).toBe(true);
    }
  });

  test('generates and revokes join code and maps 404 / uncertain errors', async () => {
    let capturedBody: unknown;
    mswServer.use(
      createGenerateJoinCodeHandler({
        classroomId,
        onRequest: (_request, body) => {
          capturedBody = body;
        },
      }),
      createRevokeJoinCodeHandler({
        classroomId,
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const generated = await generateClassroomJoinCode(client, classroomId, {
      maxUses: 25,
      expiresInSeconds: 3600,
    });
    expect(capturedBody).toEqual({ maxUses: 25, expiresInSeconds: 3600 });
    expect(generated.code).toBe('K7P9X2M');
    expect(generated.maxUses).toBe(25);

    const revoked = await revokeClassroomJoinCode(client, classroomId);
    expect(revoked.success).toBe(true);

    mswServer.use(
      createRevokeJoinCodeHandler({
        classroomId,
        error: {
          status: 404,
          body: {
            code: 'NOT_FOUND',
            message: 'No active join code',
            correlationId: 'corr-jc-404',
          },
        },
      }),
    );
    await expect(
      revokeClassroomJoinCode(client, classroomId),
    ).rejects.toMatchObject({
      kind: 'not-found',
      status: 404,
      userMessage: classroomMessages.invitations.joinCode.errors.notFoundRevoke,
    });

    mswServer.use(
      createGenerateJoinCodeHandler({
        classroomId,
        error: {
          status: 503,
          body: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Unavailable',
            correlationId: 'corr-jc-503',
          },
        },
      }),
    );
    try {
      await generateClassroomJoinCode(client, classroomId, {});
      throw new Error('Expected 503 error');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(isUncertainWriteError(error)).toBe(true);
    }
  });

  test('rethrows AbortError unchanged on cancellation', async () => {
    const controller = new AbortController();
    mswServer.use(
      createGenerateJoinCodeHandler({
        classroomId,
        resolveResponse: async ({ request }) =>
          new Promise((_, reject) => {
            request.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const pending = generateClassroomJoinCode(
      client,
      classroomId,
      {},
      { signal: controller.signal },
    );
    controller.abort();

    try {
      await pending;
      throw new Error('Expected AbortError');
    } catch (error) {
      expect(isAbortError(error)).toBe(true);
    }
  });
});
