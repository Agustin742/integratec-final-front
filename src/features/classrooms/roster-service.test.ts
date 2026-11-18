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
  classroomRosterQueryKey,
  createClassroomRosterPredicate,
  createUserScopePredicate,
} from '@/api/query-keys';
import {
  TEST_API_BASE_URL,
  createClassroomRosterHandler,
  createRemoveClassroomStudentHandler,
  type RosterStudentPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { classroomMessages } from './messages';
import {
  isAbortError,
  isUncertainWriteError,
  listClassroomRoster,
  removeClassroomStudent,
} from './roster-service';

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

const classroomId = '4e5f6a7b-0000-4000-8000-000000000333';
const sampleStudent: RosterStudentPayload = {
  membershipId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  displayName: 'Valentina Pérez',
  state: 'ACTIVE',
  deletedAt: null,
  guardians: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      displayName: 'Carlos Pérez',
      state: 'ACTIVE',
    },
  ],
};

describe('roster query keys and service', () => {
  test('scopes classroomRosterQueryKey by userId and classroomId and normalizes filters', () => {
    const key = classroomRosterQueryKey('user-1', classroomId, {
      page: 0,
      pageSize: 250,
      state: 'ACTIVE',
      q: '  Val  ',
    });

    expect(key[0]).toEqual({
      scope: { userId: 'user-1', classroomId, linkedChildId: null },
      domain: 'classrooms',
      resource: 'roster',
      params: { page: 1, pageSize: 100, state: 'ACTIVE', q: 'Val' },
    });

    const userPredicate = createUserScopePredicate('user-1');
    const rosterPredicate = createClassroomRosterPredicate(
      'user-1',
      classroomId,
    );
    const otherClassroomKey = classroomRosterQueryKey('user-1', 'other-room');
    const otherUserKey = classroomRosterQueryKey('user-2', classroomId);

    expect(userPredicate({ queryKey: key })).toBe(true);
    expect(rosterPredicate({ queryKey: key })).toBe(true);
    expect(rosterPredicate({ queryKey: otherClassroomKey })).toBe(false);
    expect(rosterPredicate({ queryKey: otherUserKey })).toBe(false);
  });

  test('lists paginated roster with state and prefix query params', async () => {
    let capturedUrl = '';
    mswServer.use(
      createClassroomRosterHandler({
        classroomId,
        items: [sampleStudent],
        onRequest: (request) => {
          capturedUrl = request.url;
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const response = await listClassroomRoster(client, classroomId, {
      page: 2,
      pageSize: 10,
      state: 'ACTIVE',
      q: '  Val ',
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
    expect(url.searchParams.get('state')).toBe('ACTIVE');
    expect(url.searchParams.get('q')).toBe('Val');
    expect(response.total).toBe(1);
    expect(response.items).toEqual([]);
  });

  test('rejects malformed 200 roster responses without leaking invalid data', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/${classroomId}/roster`, () =>
        HttpResponse.json({ unexpected: true }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      listClassroomRoster(client, classroomId),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      status: 200,
    });
  });

  test('removes student using student userId (204) and maps 403/404/uncertain errors', async () => {
    let calledStudentId = '';
    mswServer.use(
      createRemoveClassroomStudentHandler({
        classroomId,
        onRequest: (_request, studentId) => {
          calledStudentId = studentId;
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      removeClassroomStudent(client, classroomId, sampleStudent.userId),
    ).resolves.toBeUndefined();
    expect(calledStudentId).toBe(sampleStudent.userId);
    expect(calledStudentId).not.toBe(sampleStudent.membershipId);

    mswServer.use(
      createRemoveClassroomStudentHandler({
        classroomId,
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Denied by backend',
            correlationId: 'corr-403',
          },
        },
      }),
    );
    await expect(
      removeClassroomStudent(client, classroomId, sampleStudent.userId),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
      userMessage: classroomMessages.roster.removeForbidden,
    });

    mswServer.use(
      createRemoveClassroomStudentHandler({
        classroomId,
        error: {
          status: 404,
          body: {
            code: 'NOT_FOUND',
            message: 'Foreign classroom',
            correlationId: 'corr-404',
          },
        },
      }),
    );
    await expect(
      removeClassroomStudent(client, classroomId, sampleStudent.userId),
    ).rejects.toMatchObject({
      kind: 'not-found',
      status: 404,
      userMessage: classroomMessages.roster.removeNotFound,
    });

    mswServer.use(
      createRemoveClassroomStudentHandler({
        classroomId,
        error: 'network',
      }),
    );
    try {
      await removeClassroomStudent(client, classroomId, sampleStudent.userId);
      throw new Error('Expected network error');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(isUncertainWriteError(error)).toBe(true);
      expect((error as ApiError).userMessage).toBe(
        classroomMessages.roster.removeUncertain,
      );
    }
  });

  test('rethrows AbortError unchanged on cancellation', async () => {
    const controller = new AbortController();
    mswServer.use(
      createRemoveClassroomStudentHandler({
        classroomId,
        resolveResponse: async ({ request }) => {
          await new Promise((_resolve, reject) => {
            request.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          });
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const pending = removeClassroomStudent(
      client,
      classroomId,
      sampleStudent.userId,
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
