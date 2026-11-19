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
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createStudentWalletHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { pointsMessages } from './messages';
import { invalidateStudentWallet } from './use-student-wallet';
import { WalletIndicator } from './wallet-indicator';

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
const copy = pointsMessages.wallet;

function renderIndicator(targetClassroomId = classroomId) {
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const view = render(
    <SessionProvider service={session.service}>
      <WalletIndicator classroomId={targetClassroomId} />
    </SessionProvider>,
    { queryClient },
  );
  return { ...view, queryClient, session };
}

describe('WalletIndicator (#45)', () => {
  test('ready shows the confirmed balance, opens the dialog, and returns focus to the trigger on Escape', async () => {
    mswServer.use(createStudentWalletHandler(classroomId));
    const { container } = renderIndicator();

    const trigger = await screen.findByRole('button', {
      name: copy.indicator.accessibleName(copy.indicator.ready(130)),
    });
    expect(trigger).toHaveTextContent('130 puntos');
    await expectAccessible(container);

    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', {
      name: copy.panel.title,
    });
    expect(dialog).toHaveTextContent(copy.panel.description);
    // The panel shares the indicator's cache entry and shows the same balance.
    expect(within(dialog).getByText('130 puntos')).toBeVisible();
    await expectAccessible(document.body);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  test('pending shows the pending label and stays an enabled, named control', async () => {
    mswServer.use(createStudentWalletHandler(classroomId));
    const { container } = renderIndicator();

    const trigger = screen.getByRole('button', {
      name: copy.indicator.accessibleName(copy.indicator.pending),
    });
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveTextContent(copy.indicator.pending);
    await expectAccessible(container);
  });

  test('blank classroomId renders pending safely without throwing or calling the API', async () => {
    const onRequest = vi.fn();
    mswServer.use(createStudentWalletHandler(classroomId, { onRequest }));
    const { container } = renderIndicator('   ');

    const trigger = screen.getByRole('button', {
      name: copy.indicator.accessibleName(copy.indicator.pending),
    });
    expect(trigger).toHaveTextContent(copy.indicator.pending);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onRequest).not.toHaveBeenCalled();
    await expectAccessible(container);
  });

  test('malformed 200 payload shows the unavailable label instead of undefined puntos', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/${classroomId}/points`, () =>
        HttpResponse.json({
          classroomId,
          studentId: profile.id,
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
        }),
      ),
    );
    const { container } = renderIndicator();

    const trigger = await screen.findByRole('button', {
      name: copy.indicator.accessibleName(copy.indicator.unavailable),
    });
    expect(trigger).toHaveTextContent(copy.indicator.unavailable);
    expect(trigger).not.toHaveTextContent('undefined puntos');
    expect(trigger).not.toHaveTextContent('puntos');
    await expectAccessible(container);
  });

  test('a 403 wallet shows the unavailable label and never a numeric balance', async () => {
    mswServer.use(createStudentWalletHandler(classroomId, { status: 403 }));
    const { container } = renderIndicator();

    const trigger = await screen.findByRole('button', {
      name: copy.indicator.accessibleName(copy.indicator.unavailable),
    });
    expect(trigger).toHaveTextContent(copy.indicator.unavailable);
    // An unavailable balance is never zero or any other number.
    expect(trigger).not.toHaveTextContent('puntos');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  test.each([403, 404] as const)(
    'revoked access (%i) during background refresh replaces cached balance with unavailable and invalidates classroom context',
    async (status) => {
      mswServer.use(createStudentWalletHandler(classroomId));
      const { queryClient } = renderIndicator();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      expect(
        await screen.findByRole('button', {
          name: copy.indicator.accessibleName(copy.indicator.ready(130)),
        }),
      ).toBeVisible();

      mswServer.use(createStudentWalletHandler(classroomId, { status }));
      await act(async () => {
        await invalidateStudentWallet(queryClient, {
          userId: profile.id,
          classroomId,
        });
      });

      const unavailableTrigger = await screen.findByRole('button', {
        name: copy.indicator.accessibleName(copy.indicator.unavailable),
      });
      expect(unavailableTrigger).toBeVisible();
      expect(unavailableTrigger).not.toHaveTextContent('130 puntos');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: classroomDetailQueryKey(profile.id, classroomId),
        exact: true,
      });
    },
  );

  test('changing classroomId or userId resets the open dialog state', async () => {
    mswServer.use(
      createStudentWalletHandler(classroomId),
      createStudentWalletHandler(secondClassroomId, {
        response: { balance: 40 },
      }),
    );
    const { rerender, session } = renderIndicator();

    const trigger = await screen.findByRole('button', {
      name: copy.indicator.accessibleName(copy.indicator.ready(130)),
    });
    fireEvent.click(trigger);
    expect(
      await screen.findByRole('dialog', { name: copy.panel.title }),
    ).toBeVisible();

    rerender(
      <SessionProvider service={session.service}>
        <WalletIndicator classroomId={secondClassroomId} />
      </SessionProvider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const secondTrigger = await screen.findByRole('button', {
      name: copy.indicator.accessibleName(copy.indicator.ready(40)),
    });
    fireEvent.click(secondTrigger);
    expect(
      await screen.findByRole('dialog', { name: copy.panel.title }),
    ).toBeVisible();

    await act(async () => {
      session.set({
        status: 'authenticated',
        user: { ...profile, id: '00000000-0000-4000-8000-000000000009' },
      });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
