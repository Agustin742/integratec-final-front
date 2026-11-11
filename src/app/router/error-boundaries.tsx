import { Button } from '@/components/ui/button';
import { feedbackMessages } from '@/components/feedback/messages';
import { StaleScene, UnexpectedScene } from '@/components/illustrations/scenes';
import { useLocation, useNavigate, useRouteError } from 'react-router';
import { ForbiddenPage } from '../pages/forbidden-page';
import { NotFoundPage } from '../pages/not-found-page';
import { StatusView } from '../pages/status-view';
import { messages } from '../messages';
import { useDocumentTitle } from './document-title';
import { GoHomeLink, homeLinkClass } from './go-home-link';
import { reloadPage } from './reload';
import { classifyRouteError } from './route-errors';

/**
 * Boundary for everything that renders inside a layout. A page error, a
 * failed lazy chunk or a thrown 403/404 replaces only the page area: the
 * banner and toast host of the layout stay mounted.
 *
 * It never navigates to login (the session layer owns 401) and never renders
 * the error itself, only copy chosen by `classifyRouteError`. Every view
 * titles the tab itself through `StatusView`.
 */
export function RouteErrorBoundary() {
  const kind = classifyRouteError(useRouteError());
  const location = useLocation();
  const navigate = useNavigate();

  switch (kind) {
    case 'not-found':
      return <NotFoundPage />;
    case 'forbidden':
      return <ForbiddenPage />;
    case 'stale-chunk':
      return (
        <StatusView
          role="alert"
          {...messages.errors.staleChunk}
          scene={<StaleScene className="h-auto w-full" />}
          actions={
            <>
              <Button type="button" onClick={reloadPage}>
                {messages.errors.reload}
              </Button>
              <GoHomeLink variant="secondary" />
            </>
          }
        />
      );
    case 'unexpected':
      return (
        <StatusView
          role="alert"
          {...messages.errors.unexpected}
          scene={<UnexpectedScene className="h-auto w-full" />}
          actions={
            <>
              {/* Navigating to the same URL makes the router drop the caught
                  error and render the route again; loaders run again too. */}
              <Button
                type="button"
                onClick={() => void navigate(location, { replace: true })}
              >
                {feedbackMessages.retry}
              </Button>
              <GoHomeLink variant="secondary" />
            </>
          }
        />
      );
  }
}

const rootActionClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2 font-display text-base font-semibold key-bevel motion-press focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

/**
 * Last line of defence, above every layout. If a layout itself throws there is
 * no chrome to rely on, so this renders a self-contained page with a plain
 * anchor home (a full load also resets a broken router).
 *
 * It deliberately uses plain markup and no shared component (no `ErrorState`,
 * `Button` or scene): if a shared primitive is what broke, rendering it here
 * would throw again with nothing left above to catch it. It is styled with
 * design-token utility classes only, and keeps the same semantics (landmark,
 * heading, alert, keyboard-reachable actions with visible focus).
 */
export function RootErrorBoundary() {
  useDocumentTitle(messages.errors.root.title);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-center font-display text-3xl font-bold text-primary">
          {messages.title}
        </h1>
        <div
          role="alert"
          className="space-y-4 rounded-3xl border border-edge bg-card p-6 text-center text-card-foreground shadow-float sm:p-8"
        >
          <h2 className="text-3xl text-balance">
            {messages.errors.root.title}
          </h2>
          <p className="text-pretty text-muted-foreground">
            {messages.errors.root.description}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={reloadPage}
              className={`${rootActionClass} bg-primary text-primary-foreground [--key:var(--key-primary)]`}
            >
              {messages.errors.reload}
            </button>
            <a href="/" className={homeLinkClass}>
              {messages.errors.goHome}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
