import type { createMemoryRouter } from 'react-router';

/**
 * Initial initialization may precede a guard redirect and another lazy import.
 * Call inside act(); keep the test's configured timeout as the failure bound.
 */
export function waitForRoute(
  router: ReturnType<typeof createMemoryRouter>,
  pathname: string,
): Promise<void> {
  const hasArrived = () =>
    router.state.initialized &&
    router.state.location.pathname === pathname &&
    router.state.navigation.state === 'idle';

  if (hasArrived()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = router.subscribe(() => {
      if (hasArrived()) {
        unsubscribe();
        resolve();
      }
    });
  });
}
