import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';

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
  const navigationType = useNavigationType();
  const previousPathname = useRef(pathname);
  const navigatedByUser = useRef(false);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    const isRedirect = navigationType === 'REPLACE';
    if (!isRedirect) navigatedByUser.current = true;
    if (isRedirect && !navigatedByUser.current) return;

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
  }, [pathname, navigationType]);
}

/** Root route component: focus management shared by every layout, then the matched layout. */
export function RouterRoot() {
  useFocusOnNavigation();
  return <Outlet />;
}
