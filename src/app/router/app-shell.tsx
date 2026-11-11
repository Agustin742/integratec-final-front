import {
  Outlet,
  useHref,
  useLinkClickHandler,
  useLocation,
} from 'react-router';
import { LoadingState } from '@/components/feedback/states';
import { BaseLayout } from '@/components/layout/base-layout';
import { SidebarNav, SidebarNavItem } from '@/components/layout/sidebar-nav';
import { Toast } from '@/components/ui/toast';
import { messages } from '../messages';

export const SHOWCASE_PATH = '/dev/ui';

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
  return (
    <>
      <BaseLayout
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
