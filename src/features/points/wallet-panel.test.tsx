import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
import { createAppQueryClient } from '@/api/query-client';
import { classroomDetailQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { paginationMessages } from '@/components/pagination/pagination-controls';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createStudentWalletHandler,
  type PointMovementPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { invalidateStudentWallet } from './use-student-wallet';
import { pointsMessages } from './messages';
import { WalletPanel } from './wallet-panel';

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
const secondClassroomId = '4e5f6a7b-0000-4000-8000-000000000099';
const copy = pointsMessages.wallet.panel;

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

function renderPanel(targetClassroomId = classroomId) {
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const view = render(
    <SessionProvider service={session.service}>
      <WalletPanel classroomId={targetClassroomId} />
    </SessionProvider>,
    { queryClient },
  );
  return { ...view, queryClient, session };
}

describe('WalletPanel (#45)', () => {
  test('shows the loading state while the wallet is pending', async () => {
    // A handler whose request hook never settles keeps the query pending.
    const neverSettles = new Promise<never>(() => {});
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        onRequest: () => neverSettles,
      }),
    );
    const { container } = renderPanel();

    expect(screen.getByRole('status')).toHaveTextContent(copy.loading);
    await expectAccessible(container);
  });

  test('blank classroomId renders loading safely without throwing or requesting the API', async () => {
    const onRequest = vi.fn();
    mswServer.use(createStudentWalletHandler(classroomId, { onRequest }));
    const { container } = renderPanel('   ');

    expect(screen.getByRole('status')).toHaveTextContent(copy.loading);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onRequest).not.toHaveBeenCalled();
    await expectAccessible(container);
  });

  test('ready renders the balance, the movements with school-zone dates, verbatim reasons, and signed amounts', async () => {
    mswServer.use(createStudentWalletHandler(classroomId));
    const { container } = renderPanel();

    expect(await screen.findByText('130 puntos')).toBeVisible();
    expect(screen.getByText(copy.balanceLabel)).toBeVisible();
    // Column headers label every movement card, roster-style.
    expect(screen.getAllByText(copy.dateColumn).length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.reasonColumn).length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.movementColumn).length).toBeGreaterThan(0);
    // Dates render in the school time zone (America/Argentina/Buenos_Aires).
    expect(screen.getByText('10/11/2026, 09:00')).toBeVisible();
    expect(screen.getByText('12/11/2026, 12:30')).toBeVisible();
    expect(screen.getByText('14/11/2026, 06:15')).toBeVisible();
    // The server-written reason is rendered verbatim, never reinvented.
    expect(screen.getByText('Activity graded: Fractions Quiz')).toBeVisible();
    expect(screen.getByText('Shop purchase: Blue Classroom Cap')).toBeVisible();
    expect(
      screen.getByText('Regrade adjustment: Fractions Quiz'),
    ).toBeVisible();
    // Signed text carries the movement direction, never color alone.
    expect(screen.getByText('+50')).toBeVisible();
    expect(screen.getByText('-20')).toBeVisible();
    expect(screen.getByText('+5')).toBeVisible();
    await expectAccessible(container);
  });

  test('pagination requests and renders page 2 when total exceeds the page size', async () => {
    const requestedUrls: string[] = [];
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: { total: 45 },
      }),
    );
    renderPanel();

    expect(await screen.findByText('+50')).toBeVisible();
    const navigation = screen.getByRole('navigation', {
      name: paginationMessages.navigationLabel,
    });
    expect(navigation).toBeVisible();

    // Later MSW handlers win, so the page-2 request observes this fixture.
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: {
          page: 2,
          items: [pageTwoMovement],
          total: 45,
        },
      }),
    );
    fireEvent.click(
      within(navigation).getByRole('button', {
        name: paginationMessages.nextPage,
      }),
    );

    expect(
      await screen.findByText('Activity graded: Decimals Exam'),
    ).toBeVisible();
    expect(
      requestedUrls.some(
        (url) => new URL(url).searchParams.get('page') === '2',
      ),
    ).toBe(true);
  });

  test('an empty wallet shows the teaching empty state and no pagination', async () => {
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        response: { items: [], total: 0, balance: 0 },
      }),
    );
    const { container } = renderPanel();

    expect(await screen.findByText(copy.emptyTitle)).toBeVisible();
    expect(screen.getByText(copy.emptyDescription)).toBeVisible();
    // A confirmed empty wallet is a legitimate server zero balance.
    expect(screen.getByText('0 puntos')).toBeVisible();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  test('an out-of-range page with total > 0 shows emptyPage copy instead of empty wallet copy', async () => {
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        response: { total: 45 },
      }),
    );
    const { container } = renderPanel();

    expect(await screen.findByText('+50')).toBeVisible();

    mswServer.use(
      createStudentWalletHandler(classroomId, {
        response: {
          page: 2,
          items: [],
          total: 45,
        },
      }),
    );
    const navigation = screen.getByRole('navigation', {
      name: paginationMessages.navigationLabel,
    });
    fireEvent.click(
      within(navigation).getByRole('button', {
        name: paginationMessages.nextPage,
      }),
    );

    expect(await screen.findByText(copy.emptyPageTitle)).toBeVisible();
    expect(screen.getByText(copy.emptyPageDescription)).toBeVisible();
    expect(screen.queryByText(copy.emptyTitle)).not.toBeInTheDocument();
    expect(
      screen.getByRole('navigation', {
        name: paginationMessages.navigationLabel,
      }),
    ).toBeVisible();
    await expectAccessible(container);
  });

  test('malformed 200 payload renders the error state instead of crashing or showing undefined puntos', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/${classroomId}/points`, () =>
        HttpResponse.json({
          classroomId,
          studentId: profile.id,
          balance: -5,
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
        }),
      ),
    );
    const { container } = renderPanel();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy.errorTitle);
    expect(screen.queryByText(/puntos/)).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  test('a 403 wallet shows the error state and Reintentar shows loading while refetching before recovering', async () => {
    mswServer.use(createStudentWalletHandler(classroomId, { status: 403 }));
    renderPanel();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy.errorTitle);
    expect(alert).toHaveTextContent(copy.errorDescription);

    let releaseRetry!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        onRequest: () => gate,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: copy.retryAction }));
    expect(await screen.findByText(copy.loading)).toBeVisible();

    releaseRetry();
    expect(await screen.findByText('130 puntos')).toBeVisible();
    expect(screen.getByText('+50')).toBeVisible();
  });

  test.each([403, 404] as const)(
    'a %i background refresh hides cached balance and movements and invalidates classroom context',
    async (status) => {
      mswServer.use(createStudentWalletHandler(classroomId));
      const { queryClient } = renderPanel();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      expect(await screen.findByText('130 puntos')).toBeVisible();
      expect(screen.getByText('Activity graded: Fractions Quiz')).toBeVisible();

      mswServer.use(createStudentWalletHandler(classroomId, { status }));
      await act(async () => {
        await invalidateStudentWallet(queryClient, {
          userId: profile.id,
          classroomId,
        });
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(copy.errorTitle);
      expect(screen.queryByText('130 puntos')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Activity graded: Fractions Quiz'),
      ).not.toBeInTheDocument();
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: classroomDetailQueryKey(profile.id, classroomId),
        exact: true,
      });
    },
  );

  test('a failed background refresh keeps the confirmed list, shows the stale notice, and marks pagination busy while refetching', async () => {
    mswServer.use(
      createStudentWalletHandler(classroomId, { response: { total: 45 } }),
    );
    const { queryClient } = renderPanel();

    expect(await screen.findByText('+50')).toBeVisible();
    expect(screen.queryByText(copy.staleTitle)).not.toBeInTheDocument();

    // Later MSW handlers win: the invalidation refetch now fails with 500.
    mswServer.use(createStudentWalletHandler(classroomId, { status: 500 }));
    await act(async () => {
      await invalidateStudentWallet(queryClient, {
        userId: profile.id,
        classroomId,
      });
    });

    expect(await screen.findByText(copy.staleTitle)).toBeVisible();
    expect(screen.getByText(copy.staleDescription)).toBeVisible();
    // The confirmed movements stay on screen; the balance stays server-owned.
    expect(screen.getByText('130 puntos')).toBeVisible();
    expect(screen.getByText('Activity graded: Fractions Quiz')).toBeVisible();
    expect(screen.getByText('+50')).toBeVisible();

    let releaseRefresh!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        onRequest: () => gate,
        response: { total: 45 },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar datos' }));

    const refreshingButton = await screen.findByRole('button', {
      name: 'Actualizando...',
    });
    expect(refreshingButton).toHaveAttribute('aria-busy', 'true');
    expect(refreshingButton).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation')).getByRole('button', {
          name: paginationMessages.nextPage,
        }),
      ).toBeDisabled(),
    );

    releaseRefresh();
    await waitFor(() =>
      expect(screen.queryByText(copy.staleTitle)).not.toBeInTheDocument(),
    );
  });

  test('switching classroomId or userId resets pagination back to page 1', async () => {
    const requestedUrls: string[] = [];
    mswServer.use(
      createStudentWalletHandler(classroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: { total: 45 },
      }),
      createStudentWalletHandler(secondClassroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: { balance: 80, total: 45 },
      }),
    );

    const { rerender, session } = renderPanel();
    expect(await screen.findByText('+50')).toBeVisible();

    mswServer.use(
      createStudentWalletHandler(classroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: { page: 2, items: [pageTwoMovement], total: 45 },
      }),
      createStudentWalletHandler(secondClassroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: { balance: 80, total: 45 },
      }),
    );
    fireEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', {
        name: paginationMessages.nextPage,
      }),
    );
    expect(
      await screen.findByText('Activity graded: Decimals Exam'),
    ).toBeVisible();

    requestedUrls.length = 0;
    rerender(
      <SessionProvider service={session.service}>
        <WalletPanel classroomId={secondClassroomId} />
      </SessionProvider>,
    );

    expect(await screen.findByText('80 puntos')).toBeVisible();
    expect(
      requestedUrls.some(
        (url) =>
          url.includes(secondClassroomId) &&
          new URL(url).searchParams.get('page') === '1',
      ),
    ).toBe(true);

    // Move to page 2 in the second classroom, then switch userId and confirm page resets to 1.
    mswServer.use(
      createStudentWalletHandler(secondClassroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: { page: 2, items: [pageTwoMovement], total: 45 },
      }),
    );
    fireEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', {
        name: paginationMessages.nextPage,
      }),
    );
    expect(
      await screen.findByText('Activity graded: Decimals Exam'),
    ).toBeVisible();

    requestedUrls.length = 0;
    mswServer.use(
      createStudentWalletHandler(secondClassroomId, {
        onRequest: (request) => {
          requestedUrls.push(request.url);
        },
        response: { balance: 25, total: 3 },
      }),
    );
    await act(async () => {
      session.set({
        status: 'authenticated',
        user: { ...profile, id: '00000000-0000-4000-8000-000000000009' },
      });
    });

    expect(await screen.findByText('25 puntos')).toBeVisible();
    expect(
      requestedUrls.some(
        (url) =>
          url.includes(secondClassroomId) &&
          new URL(url).searchParams.get('page') === '1',
      ),
    ).toBe(true);
  });
});
