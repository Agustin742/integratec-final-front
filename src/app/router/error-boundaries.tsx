import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/states';
import { useLocation, useNavigate, useRouteError } from 'react-router';
import { ForbiddenPage } from '../pages/forbidden-page';
import { NotFoundPage } from '../pages/not-found-page';
import { messages } from '../messages';
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

/**
 * Last line of defence, above the shell. If the shell itself throws there is
 * no layout to rely on, so this renders a self-contained page with a plain
 * anchor home (a full load also resets a broken router).
 */
export function RootErrorBoundary() {
  return (
    <main className="mx-auto w-full max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-primary">{messages.title}</h1>
      <ErrorState
        headingLevel="h2"
        title={messages.errors.root.title}
        description={messages.errors.root.description}
        action={
          <>
            <Button type="button" onClick={reloadPage}>
              {messages.errors.reload}
            </Button>
            <a href="/" className={homeLinkClass}>
              {messages.errors.goHome}
            </a>
          </>
        }
      />
    </main>
  );
}
