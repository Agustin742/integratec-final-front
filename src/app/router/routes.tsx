import { createBrowserRouter, type RouteObject } from 'react-router';
import { PublicOnly, RequireAuth } from './guards';
import { AppHydrateFallback, AppShell, SHOWCASE_PATH } from './app-shell';

/**
 * The component showcase is a development aid. It is registered by the dev
 * server and by the `showcase` build mode used by the browser suite; production
 * builds resolve the constant to false and drop the lazy chunk entirely.
 */
export const showcaseEnabled = __UI_SHOWCASE__;

// Gated on the build-time constant itself (not on a runtime option) so the
// bundler can prove the dynamic import unreachable and drop the chunk.
const showcaseRoute: RouteObject | null = __UI_SHOWCASE__
  ? {
      path: SHOWCASE_PATH.slice(1),
      lazy: {
        Component: async () =>
          (await import('../ui-foundations')).UiFoundations,
      },
    }
  : null;

export type AppRoutesOptions = {
  showcase?: boolean;
};

/**
 * Route table shared by the browser router and the tests (memory router).
 * Every page is a lazy module: its chunk loads when the route is first matched.
 */
export function createAppRoutes({
  showcase = showcaseEnabled,
}: AppRoutesOptions = {}): RouteObject[] {
  return [
    {
      // Layout route without a path: the shell wraps every child.
      Component: () => <AppShell showcase={showcase} />,
      HydrateFallback: AppHydrateFallback,
      children: [
        // Signed-out pages: a signed-in user is redirected away from them.
        {
          Component: PublicOnly,
          children: [
            {
              path: 'login',
              lazy: {
                Component: async () =>
                  (await import('../pages/login-page')).LoginPage,
              },
            },
            {
              path: 'register',
              lazy: {
                Component: async () =>
                  (await import('../pages/register-page')).RegisterPage,
              },
            },
            {
              path: 'password-reset',
              lazy: {
                Component: async () =>
                  (await import('../pages/password-reset-page'))
                    .PasswordResetPage,
              },
            },
          ],
        },
        // Reachable signed in or out: an invited user may already have an account.
        {
          path: 'invitations/accept',
          lazy: {
            Component: async () =>
              (await import('../pages/invitation-accept-page'))
                .InvitationAcceptPage,
          },
        },
        // Protected area. This pathless branch is behind the session guard;
        // everything that requires a signed-in user nests here.
        {
          id: 'protected',
          Component: RequireAuth,
          children: [
            {
              index: true,
              lazy: {
                Component: async () =>
                  (await import('../pages/home-page')).HomePage,
              },
            },
          ],
        },
        // Reserved: a separate minimal area for parent users (extended scope)
        // mounts as its own branch here, with its own guard.
        ...(showcase && showcaseRoute ? [showcaseRoute] : []),
        {
          path: '*',
          lazy: {
            Component: async () =>
              (await import('../pages/not-found-page')).NotFoundPage,
          },
        },
      ],
    },
  ];
}

/** Creates the browser router once, outside React, for `RouterProvider`. */
export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}
