import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  TEST_API_BASE_URL,
  createOwnStreakAndBadgesHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { StreakAndBadgesSection } from './streak-and-badges-section';

function renderSection() {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>
          <StreakAndBadgesSection />
        </SessionProvider>
      </ApiQueryProvider>,
    ),
  };
}

describe('StreakAndBadgesSection (HU-GAM-002)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('displays server-confirmed current and best streak and earned badges', async () => {
    mswServer.use(
      createOwnStreakAndBadgesHandler({
        payload: {
          streak: {
            currentStreak: 5,
            bestStreak: 12,
            lastQualifyingDay: '2026-11-18',
          },
          badges: [
            {
              id: 'b1',
              code: 'FIRST_SUBMISSION',
              name: 'Primera entrega',
              description: 'Completaste tu primera entrega a tiempo.',
              awardedAt: '2026-11-15T14:00:00.000Z',
            },
          ],
        },
      }),
    );

    const { container } = renderSection();

    expect(await screen.findByText('5 días')).toBeInTheDocument();
    expect(screen.getByText('12 días')).toBeInTheDocument();
    expect(
      screen.getByText('Último día calificado: 2026-11-18'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 obtenida')).toBeInTheDocument();
    expect(screen.getByText('Primera entrega')).toBeInTheDocument();
    expect(screen.getByText(/Obtenida el/)).toBeInTheDocument();

    const axeResults = await axe.run(container);
    expect(axeResults.violations).toEqual([]);
  });

  it('keeps streak at 0 for login-only state and shows empty state when badges is empty', async () => {
    mswServer.use(
      createOwnStreakAndBadgesHandler({
        payload: {
          streak: {
            currentStreak: 0,
            bestStreak: 0,
            lastQualifyingDay: null,
          },
          badges: [],
        },
      }),
    );

    renderSection();

    expect(await screen.findAllByText('0 días')).toHaveLength(2);
    expect(
      screen.getByText(/Iniciar sesión por sí solo no suma días/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Todavía no tenés medallas disponibles'),
    ).toBeInTheDocument();
  });

  it('shows ErrorState without fabricating 0 values on initial failure and StaleDataNotice on refresh failure', async () => {
    mswServer.use(
      createOwnStreakAndBadgesHandler({
        error: {
          status: 500,
          body: {
            code: 'INTERNAL_ERROR',
            message: 'Failed',
            correlationId: 'req-streak-500',
          },
        },
      }),
    );

    const { queryClient } = renderSection();

    expect(
      await screen.findByText('No pudimos cargar tu racha ni tus medallas'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0 días')).not.toBeInTheDocument();

    mswServer.use(
      createOwnStreakAndBadgesHandler({
        payload: {
          streak: {
            currentStreak: 3,
            bestStreak: 3,
            lastQualifyingDay: '2026-11-18',
          },
          badges: [],
        },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findAllByText('3 días')).toHaveLength(2);

    mswServer.use(
      createOwnStreakAndBadgesHandler({
        error: {
          status: 503,
          body: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Unavailable',
            correlationId: 'req-streak-503',
          },
        },
      }),
    );
    await queryClient.refetchQueries();

    await waitFor(() => {
      expect(
        screen.getByText('Racha y medallas pendientes de sincronización'),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByText('3 días')).toHaveLength(2);
  });
});
