import { useState } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { messages } from '../messages';
import { buildLoginRedirect, readReturnTarget } from './return-target';

function VerifyingSession() {
  return <LoadingState label={messages.session.verifying} />;
}

/**
 * Guard for the protected branch. Protected content is rendered only once the
 * session is authenticated; every other status renders something that carries
 * no private data. Only session state decides here: a 403/404 from a resource
 * never reaches this component, so it cannot cause a login redirect.
 */
export function RequireAuth() {
  const snapshot = useSessionSnapshot();
  const { controller } = useSessionService();
  const location = useLocation();

  switch (snapshot.status) {
    case 'initializing':
      return <VerifyingSession />;
    case 'unauthenticated':
      return <Navigate replace to={buildLoginRedirect(location)} />;
    case 'unable-to-verify':
      return (
        <ErrorState
          headingLevel="h2"
          title={messages.session.unableTitle}
          description={messages.session.unableDescription}
          onRetry={() => void controller.initialize()}
        />
      );
    case 'authenticated':
      return <Outlet />;
  }
}

/**
 * Guard for login, register and password reset: a signed-in user has nothing
 * to do there. Invitation acceptance is deliberately not behind this guard.
 */
export function PublicOnly() {
  const { status } = useSessionSnapshot();
  const [searchParams] = useSearchParams();
  // Loading replaces the page only until the session first resolves. A later
  // `initializing` (a login attempt in flight) must not unmount a form that
  // is still showing its own pending and error state.
  const [resolved, setResolved] = useState(status !== 'initializing');
  if (!resolved && status !== 'initializing') setResolved(true);

  if (status === 'authenticated') {
    return <Navigate replace to={readReturnTarget(searchParams)} />;
  }
  if (!resolved) return <VerifyingSession />;
  return <Outlet />;
}
