import { act, screen, waitFor } from '@testing-library/react';
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
import { createAppQueryClient } from '@/api/query-client';
import {
  studentWalletQueryKey,
  type StudentWalletQueryParams,
} from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  TEST_API_BASE_URL,
  createStudentWalletHandler,
  type PointMovementPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import {
  invalidateStudentWallet,
  useStudentWallet,
  type StudentWalletState,
} from './use-student-wallet';

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
});

afterAll(() => {
  mswServer.close();
});

const classroomId = '4e5f6a7b-0000-4000-8000-000000000045';

/** Serializes hook state, projecting the `ApiError` fields JSON would drop. */
function serializeState(state: StudentWalletState): string {
  return JSON.stringify(state, (_key: string, value: unknown) =>
    value instanceof ApiError
      ? { kind: value.kind, status: value.status, code: value.code }
      : value,
  );
}

function WalletProbe({
  classroomId: probeClassroomId,
  params,
}: {
  readonly classroomId: string;
  readonly params?: StudentWalletQueryParams;
}) {
  const state = useStudentWallet(probeClassroomId, params);
  return <output>{serializeState(state)}</output>;
}

function renderWallet(params?: StudentWalletQueryParams) {
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const view = render(
    <SessionProvider service={session.service}>
      <WalletProbe classroomId={classroomId} params={params} />
    </SessionProvider>,
    { queryClient },
  );
  return { ...view, queryClient, session };
}

const walletOutput = (): HTMLElement => screen.getByRole('status');

describe('useStudentWallet (#45)', () => {
  test('ready state renders the server balance, a movement reason, and the pagination meta total', async () => {
    mswServer.use(createStudentWalletHandler(classroomId));
    renderWallet();

    const output = await waitFor(() => {
      const node = walletOutput();
      expect(node).toHaveTextContent('"status":"ready"');
      return node;
    });
    expect(output).toHaveTextContent('"balance":130');
    expect(output).toHaveTextContent('Activity graded: Fractions Quiz');
    expect(output).toHaveTextContent('"total":3');
    expect(output).toHaveTextContent('"totalPages":1');
  });

  test('sends the requested page and pageSize and caches distinct pages under distinct keys', async () => {
    const requestedUrls: string[] = [];
    const pageTwoMovement: PointMovementPayload = {
      id: '00000000-0000-4000-8000-000000000304',
      entryKind: 'EARNING',
      amount: 15,
      sourceType: 'submission_grade',
      sourceId: '00000000-0000-4000-8000-000000000314',
      reason: 'Activity graded: Decimals Exam',
      actorId: '00000000-0000-4000-8000-000000000321',
      createdAt: '2026-11-16T10:00:00.000Z',
    };
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: {
          page: 2,
          pageSize: 10,
          balance: 95,
          items: [pageTwoMovement],
          total: 45,
        },
      }),
    );
    renderWallet({ page: 2, pageSize: 10 });

    const output = await waitFor(() => {
      const node = walletOutput();
      expect(node).toHaveTextContent('"status":"ready"');
      return node;
    });
    expect(requestedUrls.length).toBeGreaterThan(0);
    const url = new URL(requestedUrls[0]);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
    expect(output).toHaveTextContent('"balance":95');
    expect(output).toHaveTextContent('Activity graded: Decimals Exam');
    expect(output).toHaveTextContent('"page":2');
    expect(output).toHaveTextContent('"totalPages":5');
    expect(
      studentWalletQueryKey(profile.id, classroomId, { page: 1, pageSize: 10 }),
    ).not.toEqual(
      studentWalletQueryKey(profile.id, classroomId, {
        page: 2,
        pageSize: 10,
      }),
    );
    expect(
      studentWalletQueryKey(profile.id, classroomId, { page: 2, pageSize: 10 }),
    ).not.toEqual(
      studentWalletQueryKey(profile.id, classroomId, {
        page: 2,
        pageSize: 20,
      }),
    );
  });

  test('maps 403 to a forbidden ApiError and never renders a balance', async () => {
    mswServer.use(createStudentWalletHandler(classroomId, { status: 403 }));
    renderWallet();

    const output = await waitFor(() => {
      const node = walletOutput();
      expect(node).toHaveTextContent('"status":"error"');
      return node;
    });
    expect(output).toHaveTextContent('"kind":"forbidden"');
    expect(output).not.toHaveTextContent('"status":"ready"');
    expect(output).not.toHaveTextContent('"balance"');
  });

  test('maps 404 to a not-found ApiError', async () => {
    mswServer.use(createStudentWalletHandler(classroomId, { status: 404 }));
    renderWallet();

    const output = await waitFor(() => {
      const node = walletOutput();
      expect(node).toHaveTextContent('"status":"error"');
      return node;
    });
    expect(output).toHaveTextContent('"kind":"not-found"');
  });

  test('invalidation refetches the wallet and shows the new server balance', async () => {
    mswServer.use(createStudentWalletHandler(classroomId));
    const { queryClient } = renderWallet();
    await waitFor(() =>
      expect(walletOutput()).toHaveTextContent('"status":"ready"'),
    );
    expect(walletOutput()).toHaveTextContent('"balance":130');

    // Later MSW handlers win, so the refetch observes the new balance.
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        response: { balance: 110 },
      }),
    );

    await act(async () => {
      await invalidateStudentWallet(queryClient, {
        userId: profile.id,
        classroomId,
      });
    });

    await waitFor(() =>
      expect(walletOutput()).toHaveTextContent('"balance":110'),
    );
  });

  test('stays pending and never requests the wallet while signed out', async () => {
    const onRequest = vi.fn();
    mswServer.use(createStudentWalletHandler(classroomId, { onRequest }));
    const session = fakeSession(
      { status: 'unauthenticated' },
      createApiClient({ baseUrl: TEST_API_BASE_URL }),
    );
    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });
    render(
      <SessionProvider service={session.service}>
        <WalletProbe classroomId={classroomId} />
      </SessionProvider>,
      { queryClient },
    );

    expect(walletOutput()).toHaveTextContent('"status":"pending"');
    await act(async () => {
      await Promise.resolve();
    });
    expect(onRequest).not.toHaveBeenCalled();
  });
});
