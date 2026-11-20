import { useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { LoadingState } from '@/components/feedback/states';
import { BaseLayout } from '@/components/layout/base-layout';
import { Button } from '@/components/ui/button';
import { Toast, toast } from '@/components/ui/toast';
import { ChatDock } from '@/features/chat-dock/chat-dock';
import { resetClassroomModeStore } from '@/features/classrooms/classroom-mode-store';
import { DailyReviewDialog } from '@/features/daily-review/daily-review-dialog';
import { NotificationCenter } from '@/features/notifications/notification-center';
import {
  useSessionCleanup,
  useSessionService,
  useSessionSnapshot,
} from '@/session/provider';
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
  const snapshot = useSessionSnapshot();
  const { controller } = useSessionService();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);
  // The shell outlives every protected route, so logout from any page clears
  // the per-user classroom view preference (rules/state-management.md).
  useSessionCleanup(resetClassroomModeStore);

  const handleLogout = async () => {
    if (isLoggingOutRef.current) {
      return;
    }
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    try {
      const result = await controller.logout();
      if (result.cleanupFailed) {
        toast.warning(messages.shell.logoutCleanupFailedTitle, {
          id: 'session-logout',
          description: messages.shell.logoutCleanupFailedBody,
        });
      } else if (result.serverConfirmed) {
        toast.success(messages.shell.logoutConfirmedTitle, {
          id: 'session-logout',
          description: messages.shell.logoutConfirmedBody,
        });
      } else {
        toast.warning(messages.shell.logoutLocalOnlyTitle, {
          id: 'session-logout',
          description: messages.shell.logoutLocalOnlyBody,
        });
      }
    } finally {
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <BaseLayout
        mainId={MAIN_CONTENT_ID}
        header={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-primary">
              {messages.title}
            </h1>
            {snapshot.status === 'authenticated' && (
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <p className="min-w-0 text-sm text-muted-foreground">
                  <span className="sr-only">
                    {messages.shell.signedInAsPrefix}{' '}
                  </span>
                  <span className="font-semibold text-foreground">
                    {snapshot.user.displayName}
                  </span>
                </p>
                <NavLink
                  to="/profile"
                  className="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
                >
                  {messages.shell.profileLink}
                </NavLink>
                <NotificationCenter />
                <DailyReviewDialog />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11"
                  busy={isLoggingOut}
                  onClick={() => void handleLogout()}
                >
                  {isLoggingOut
                    ? messages.shell.loggingOutAction
                    : messages.shell.logoutAction}
                </Button>
              </div>
            )}
          </div>
        }
      >
        <Outlet />
      </BaseLayout>
      {/* The chat dock owns the bottom-right corner, so toasts move to the
          bottom-left and never sit on a conversation or its composer. */}
      <ChatDock />
      <Toast position="bottom-left" />
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
