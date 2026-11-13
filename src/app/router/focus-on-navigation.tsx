import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';
import { useSessionSnapshot } from '@/session/provider';

/** Target of the skip link and of focus management after navigation. */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * A client-side navigation does not reload the page, so focus would stay on a
 * link that may no longer exist and screen readers would announce nothing.
 * After the pathname changes, focus moves to the new page's heading (or to the
 * main landmark when it has none), which makes assistive technology read it.
 *
 * It never runs for the first render, nor for the redirect that resolves a
 * first load (for example `/` to `/login`): nothing has been navigated yet and
 * moving focus on load would be surprising. Search and hash changes keep focus.
 *
 * It lives above every layout (see `RouterRoot`), so a navigation between
 * layouts, such as login to home after signing in, is still announced.
 */
function useFocusOnNavigation() {
  const { pathname } = useLocation();
  const matches = useMatches();
  const { status } = useSessionSnapshot();
  const previousPathname = useRef(pathname);
  const initialLoadResolved = useRef(false);
  const initialRedirectPending = matches.some(
    ({ id }) =>
      (id === 'protected' && status === 'unauthenticated') ||
      (id === 'public-only' && status === 'authenticated'),
  );

  useEffect(() => {
    const pathnameChanged = previousPathname.current !== pathname;
    previousPathname.current = pathname;

    // Settle only after the initial session and its guard redirect have landed.
    // A later REPLACE (including sign-in) is ordinary application navigation.
    if (!initialLoadResolved.current) {
      initialLoadResolved.current =
        status !== 'initializing' && !initialRedirectPending;
      return;
    }
    if (!pathnameChanged) return;

    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;
    const heading = main.querySelector<HTMLElement>('h1, h2');
    if (heading) {
      // Headings are not focusable by default; -1 allows focus() only.
      heading.tabIndex = -1;
      heading.focus();
    } else {
      main.focus();
    }
  }, [pathname, status, initialRedirectPending]);
}

/** Root route component: focus management shared by every layout, then the matched layout. */
export function RouterRoot() {
  useFocusOnNavigation();
  return <Outlet />;
}
