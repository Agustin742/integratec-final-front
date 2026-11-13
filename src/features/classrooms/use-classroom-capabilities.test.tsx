import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { StrictMode, type ReactNode } from 'react';
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
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { classroomDetailQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import type { SessionService, SessionSnapshot } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  TEST_API_BASE_URL,
  createClassroomDetailHandler,
  createErrorEnvelopeResponse,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { useClassroomCapabilities } from './use-classroom-capabilities';

const CLASSROOM_A = '11111111-1111-4111-8111-111111111111';
const CLASSROOM_B = '22222222-2222-4222-8222-222222222222';

const authenticated: SessionSnapshot = {
  status: 'authenticated',
  user: profile,
};

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

function setup(
  initialId: string,
  client: SessionService['client'] = createApiClient({
    baseUrl: TEST_API_BASE_URL,
  }),
) {
  const session = fakeSession(authenticated, client);
  const queryClient = createAppQueryClient();
  const view = renderHook(
    ({ id }: { id: string }) => useClassroomCapabilities(id),
    {
      initialProps: { id: initialId },
      wrapper: ({ children }: { children: ReactNode }) => (
        <StrictMode>
          <ApiQueryProvider client={queryClient}>
            <SessionProvider service={session.service}>
              {children}
            </SessionProvider>
          </ApiQueryProvider>
        </StrictMode>
      ),
    },
  );
  return { ...view, queryClient };
}

const errorEnvelope = (status: number, code: 'NOT_FOUND' | 'FORBIDDEN') =>
  createErrorEnvelopeResponse(status, {
    code,
    message: 'synthetic',
    correlationId: `corr-${status}`,
  });

describe('useClassroomCapabilities', () => {
  test('is pending first, then exposes the role and capabilities the server returned', async () => {
    mswServer.use(
      createClassroomDetailHandler(CLASSROOM_A, {
        myRole: 'TEACHER',
        capabilities: ['configure_classroom', 'invite_members'],
      }),
    );
    const { result } = setup(CLASSROOM_A);

    expect(result.current.status).toBe('pending');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') throw new Error('unreachable');
    expect(result.current.myRole).toBe('TEACHER');
    expect(result.current.capabilities).toEqual([
      'configure_classroom',
      'invite_members',
    ]);
    expect(result.current.can('invite_members')).toBe(true);
    expect(result.current.can('moderate_chat')).toBe(false);
  });

  test('the same user gets different answers in different classrooms', async () => {
    mswServer.use(
      createClassroomDetailHandler(CLASSROOM_A, {
        myRole: 'TEACHER',
        capabilities: ['moderate_chat'],
      }),
      createClassroomDetailHandler(CLASSROOM_B, {
        myRole: 'STUDENT',
        capabilities: ['chat_classmates'],
      }),
    );
    const { result, rerender } = setup(CLASSROOM_A);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') throw new Error('unreachable');
    expect(result.current.can('moderate_chat')).toBe(true);

    rerender({ id: CLASSROOM_B });

    // The previous classroom's answer is never reused for the new one.
    expect(result.current.status).toBe('pending');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') throw new Error('unreachable');
    expect(result.current.myRole).toBe('STUDENT');
    expect(result.current.can('moderate_chat')).toBe(false);
    expect(result.current.can('chat_classmates')).toBe(true);
  });

  test.each([
    [404, 'NOT_FOUND', 'not-found'],
    [403, 'FORBIDDEN', 'forbidden'],
  ] as const)(
    'a %i response becomes an error carrying the mapped ApiError',
    async (status, code, kind) => {
      mswServer.use(
        http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_A}`, () =>
          errorEnvelope(status, code),
        ),
      );
      const { result } = setup(CLASSROOM_A);

      await waitFor(() => expect(result.current.status).toBe('error'));
      if (result.current.status !== 'error') throw new Error('unreachable');
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect((result.current.error as ApiError).kind).toBe(kind);
    },
  );

  test('a later denial removes the capabilities that were already loaded', async () => {
    let denied = false;
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_A}`, () =>
        denied
          ? errorEnvelope(403, 'FORBIDDEN')
          : HttpResponse.json({
              id: CLASSROOM_A,
              name: 'Synthetic classroom',
              subject: null,
              schoolId: null,
              independentTeacherId: null,
              adultMode: false,
              chatMuted: false,
              collaborationLocked: false,
              gamesDisabled: false,
              myRole: 'TEACHER',
              capabilities: ['moderate_chat'],
              deskCount: 0,
              pet: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            }),
      ),
    );
    const { result, queryClient } = setup(CLASSROOM_A);
    await waitFor(() => expect(result.current.status).toBe('ready'));

    denied = true;
    await queryClient.invalidateQueries({
      queryKey: classroomDetailQueryKey(profile.id, CLASSROOM_A),
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect('capabilities' in result.current).toBe(false);
  });

  test('keys the cache by user and classroom and never touches web storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    mswServer.use(
      createClassroomDetailHandler(CLASSROOM_A, {
        capabilities: ['chat_classmates'],
      }),
    );
    const { result, queryClient } = setup(CLASSROOM_A);
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(
      queryClient.getQueryData(
        classroomDetailQueryKey(profile.id, CLASSROOM_A),
      ),
    ).toBeDefined();
    expect(
      queryClient.getQueryData(
        classroomDetailQueryKey(profile.id, CLASSROOM_B),
      ),
    ).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
  });

  test('wraps a failure that is not an ApiError instead of casting it', async () => {
    const failing = {
      GET: () => Promise.reject(new DOMException('aborted', 'AbortError')),
    } as unknown as SessionService['client'];
    const { result } = setup(CLASSROOM_A, failing);

    await waitFor(() => expect(result.current.status).toBe('error'));
    if (result.current.status !== 'error') throw new Error('unreachable');
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error.kind).toBe('unexpected');
  });
});
