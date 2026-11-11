import { createBrowserRouter, type RouteObject } from 'react-router';
import { PublicOnly, RequireAuth } from './guards';
import { NotFoundPage } from '../pages/not-found-page';
import { RootErrorBoundary, RouteErrorBoundary } from './error-boundaries';
import { AppHydrateFallback, AppShell, SHOWCASE_PATH } from './app-shell';
import { AuthLayout } from './auth-layout';
import { RouterRoot } from './focus-on-navigation';

/**
 * The component showcase is a development aid. It is registered by the dev
 * server and by the `showcase` build mode used by the browser suite; production
 * builds resolve the constant to false and drop the lazy chunk entirely.
 */
export const showcaseEnabled = __UI_SHOWCASE__;

// Gated on the build-time constant itself (not on a runtime option) so the
// bundler can prove the dynamic import unreachable and drop the chunk. Built
// per router: react-router mutates route objects as it resolves `lazy`, so one
// object must never be shared between routers.
const createShowcaseRoute = (): RouteObject | null =>
  __UI_SHOWCASE__
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
  /** Extra routes mounted in the protected branch (tests and future areas). */
  protectedRoutes?: RouteObject[];
};

/**
 * Route table shared by the browser router and the tests (memory router).
 * Every page is a lazy module: its chunk loads when the route is first matched.
 */
export function createAppRoutes({
  showcase = showcaseEnabled,
  protectedRoutes = [],
}: AppRoutesOptions = {}): RouteObject[] {
  const showcaseRoute = showcase ? createShowcaseRoute() : null;
  return [
    {
      // Root route: no chrome of its own, so it still renders if a layout throws.
      // It only manages focus after navigation, for every layout.
      id: 'root',
      Component: RouterRoot,
      ErrorBoundary: RootErrorBoundary,
      children: [
        {
          // Public layout route: split screen with no navigation, for every
          // signed-out screen. Its own error boundary keeps the layout mounted.
          Component: AuthLayout,
          HydrateFallback: AppHydrateFallback,
          children: [
            {
              id: 'auth-page',
              ErrorBoundary: RouteErrorBoundary,
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
              ],
            },
          ],
        },
        {
          // Application layout route without a path: the shell wraps every child.
          Component: AppShell,
          HydrateFallback: AppHydrateFallback,
          children: [
            {
              // Pathless wrapper: a page error replaces only the page area, so the
              // shell (banner, navigation, toast host) stays mounted.
              id: 'page',
              ErrorBoundary: RouteErrorBoundary,
              children: [
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
                    ...protectedRoutes,
                  ],
                },
                // Reserved: a separate minimal area for parent users (extended scope)
                // mounts as its own branch here, with its own guard.
                ...(showcaseRoute ? [showcaseRoute] : []),
                {
                  path: '*',
                  // Static: the boundary already bundles this tiny view.
                  Component: NotFoundPage,
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

/** Creates the browser router once, outside React, for `RouterProvider`. */
export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}
