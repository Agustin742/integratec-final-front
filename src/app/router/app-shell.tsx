import { Outlet } from 'react-router';
import { LoadingState } from '@/components/feedback/states';
import { BaseLayout } from '@/components/layout/base-layout';
import { Toast } from '@/components/ui/toast';
import { messages } from '../messages';
import { MAIN_CONTENT_ID } from './focus-on-navigation';

/** Development-only showcase route. It is reached by URL; nothing links to it. */
export const SHOWCASE_PATH = '/dev/ui';

/**
 * Layout route for the application area: every page renders inside the F04
 * base layout through `<Outlet />`, and the toast host lives here so it is
 * mounted exactly once. It renders no sidebar: navigation arrives with the
 * features that need it, and an empty aside would only take space.
 */
export function AppShell() {
  return (
    <>
      <BaseLayout
        mainId={MAIN_CONTENT_ID}
        header={
          <h1 className="text-2xl font-bold text-primary">{messages.title}</h1>
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
