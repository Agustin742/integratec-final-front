import { act, screen } from '@testing-library/react';
import { createMemoryRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { expect, test } from 'vitest';
import { render } from '@/test/render';
import { waitForRoute } from './wait-for-route.test-helper';

test('waits for the redirected lazy destination, not just initial route initialization', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const router = createMemoryRouter(
    [
      {
        path: '/start',
        Component: () => <Navigate to="/destination" replace />,
      },
      {
        path: '/destination',
        lazy: {
          Component: async () => {
            await pending;
            return () => <h2>Destination ready</h2>;
          },
        },
      },
    ],
    { initialEntries: ['/start'] },
  );
  render(<RouterProvider router={router} />);
  let settled = false;
  const arrival = waitForRoute(router, '/destination').then(() => {
    settled = true;
  });

  try {
    await act(async () => {
      await Promise.resolve();
    });
    expect(router.state.initialized).toBe(true);
    expect(settled).toBe(false);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  } finally {
    await act(async () => {
      release();
      await arrival;
    });
  }

  expect(router.state.location.pathname).toBe('/destination');
  expect(router.state.navigation.state).toBe('idle');
  expect(
    screen.getByRole('heading', { name: 'Destination ready' }),
  ).toBeVisible();
});
