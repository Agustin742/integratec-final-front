import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/states';
import { useLocation, useNavigate, useRouteError } from 'react-router';
import { ForbiddenPage } from '../pages/forbidden-page';
import { NotFoundPage } from '../pages/not-found-page';
import { messages } from '../messages';
import { useDocumentTitle } from './document-title';
import { GoHomeLink, homeLinkClass } from './go-home-link';
import { reloadPage } from './reload';
import { classifyRouteError } from './route-errors';

/**
 * Boundary for everything that renders inside the shell. A page error, a
 * failed lazy chunk or a thrown 403/404 replaces only the page area: the
 * banner, navigation and toast host stay mounted.
 *
 * It never navigates to login (the session layer owns 401) and never renders
 * the error itself, only copy chosen by `classifyRouteError`.
 */
export function RouteErrorBoundary() {
  const kind = classifyRouteError(useRouteError());
  const location = useLocation();
  const navigate = useNavigate();
  // Not-found and forbidden are pages: they title themselves.
  useDocumentTitle(
    kind === 'stale-chunk'
      ? messages.errors.staleChunk.title
      : kind === 'unexpected'
        ? messages.errors.unexpected.title
        : undefined,
  );

  switch (kind) {
    case 'not-found':
      return <NotFoundPage />;
    case 'forbidden':
      return <ForbiddenPage />;
    case 'stale-chunk':
      return (
        <ErrorState
          headingLevel="h2"
          title={messages.errors.staleChunk.title}
          description={messages.errors.staleChunk.description}
          action={
            <Button type="button" onClick={reloadPage}>
              {messages.errors.reload}
            </Button>
          }
        />
      );
    case 'unexpected':
      return (
        <ErrorState
          headingLevel="h2"
          title={messages.errors.unexpected.title}
          description={messages.errors.unexpected.description}
          // Navigating to the same URL makes the router drop the caught error
          // and render the route again; loaders run again too.
          onRetry={() => void navigate(location, { replace: true })}
          action={<GoHomeLink />}
        />
      );
  }
}

const rootActionClass =
  'inline-flex min-h-11 items-center rounded-xl px-5 py-2 font-display text-base font-semibold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

/**
 * Last line of defence, above the shell. If the shell itself throws there is
 * no layout to rely on, so this renders a self-contained page with a plain
 * anchor home (a full load also resets a broken router).
 *
 * It deliberately uses plain markup and no shared component: if a shared
 * primitive (`ErrorState`, `Button`) is what broke, rendering it here would
 * throw again with nothing left above to catch it. It keeps the same semantics
 * (landmark, heading, alert, keyboard-reachable actions with visible focus).
 */
export function RootErrorBoundary() {
  useDocumentTitle(messages.errors.root.title);

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-primary">{messages.title}</h1>
      <div
        role="alert"
        className="space-y-3 rounded-2xl border border-edge bg-card p-5 text-card-foreground shadow-panel"
      >
        <h2 className="text-xl font-bold">{messages.errors.root.title}</h2>
        <p>{messages.errors.root.description}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reloadPage}
            className={`${rootActionClass} bg-primary text-primary-foreground`}
          >
            {messages.errors.reload}
          </button>
          <a href="/" className={homeLinkClass}>
            {messages.errors.goHome}
          </a>
        </div>
      </div>
    </main>
  );
}
