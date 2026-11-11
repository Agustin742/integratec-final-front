import { useEffect, useRef } from 'react';
import {
  Outlet,
  useHref,
  useLinkClickHandler,
  useLocation,
  useNavigationType,
} from 'react-router';
import { LoadingState } from '@/components/feedback/states';
import { BaseLayout } from '@/components/layout/base-layout';
import { SidebarNav, SidebarNavItem } from '@/components/layout/sidebar-nav';
import { Toast } from '@/components/ui/toast';
import { messages } from '../messages';

export const SHOWCASE_PATH = '/dev/ui';

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

/** Router-aware sidebar link: client-side navigation with a real `href`. */
function ShowcaseNavItem() {
  const href = useHref(SHOWCASE_PATH);
  const onClick = useLinkClickHandler(SHOWCASE_PATH);
  const { pathname } = useLocation();

  return (
    <SidebarNavItem
      href={href}
      onClick={onClick}
      current={pathname === SHOWCASE_PATH}
    >
      {messages.showcase.title}
    </SidebarNavItem>
  );
}

export type AppShellProps = {
  /** Shows the development-only showcase link in the sidebar. */
  showcase?: boolean;
};

/**
 * Layout route: every page renders inside the F04 base layout through
 * `<Outlet />`, and the toast host lives here so it is mounted exactly once.
 */
export function AppShell({ showcase = false }: AppShellProps) {
  useFocusOnNavigation();

  return (
    <>
      <BaseLayout
        mainId={MAIN_CONTENT_ID}
        header={
          <h1 className="text-2xl font-bold text-primary">{messages.title}</h1>
        }
        sidebarLabel={showcase ? messages.showcase.navigation : undefined}
        sidebar={
          showcase ? (
            <SidebarNav>
              <ShowcaseNavItem />
            </SidebarNav>
          ) : undefined
        }
      >
        <Outlet />
      </BaseLayout>
      <Toast />
    </>
  );
}

/** Shown while the first lazy route module resolves on a hard load. */
export function AppHydrateFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <LoadingState />
    </div>
  );
}
