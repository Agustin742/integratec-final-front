import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import type { components } from '@/api/schema.generated';
import { NotFoundPage } from '@/app/pages/not-found-page';
import { useDocumentTitle } from '@/app/router/document-title';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { joinMessages } from './join-messages';
import { readClassroomJoinOutcome } from './join-schema';
import { classroomMessages as messages } from './messages';
import { useClassroomContext } from './use-classroom-capabilities';
import { useClassroomContextEvents } from './use-classroom-context-events';
import { classroomPanelCatalog } from './panels/classroom-panel-catalog';
import {
  ClassroomPanelsProvider,
  type PanelDescriptor,
} from './panels/classroom-panels';

type WorkspacePanel = PanelDescriptor & {
  key: components['schemas']['ClassroomPanelKey'];
};
type WorkspaceProps = { panels?: readonly WorkspacePanel[] };
export function ClassroomWorkspace({
  panels = classroomPanelCatalog,
}: WorkspaceProps) {
  const { classroomId } = useParams();
  const safeFocus = useRef<HTMLDivElement>(null);
  return (
    <div ref={safeFocus} tabIndex={-1} aria-label={messages.title}>
      {classroomId ? (
        <WorkspaceContext
          classroomId={classroomId}
          panels={panels}
          safeFocus={safeFocus}
        />
      ) : (
        <NotFoundPage />
      )}
    </div>
  );
}

function WorkspaceContext({
  classroomId,
  panels,
  safeFocus,
}: {
  classroomId: string;
  panels: readonly WorkspacePanel[];
  safeFocus: RefObject<HTMLDivElement | null>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const latestLocation = useRef(location);
  const consumedRoute = useRef<string | null>(null);
  const unmountedRef = useRef(false);
  useLayoutEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);
  useLayoutEffect(() => {
    latestLocation.current = location;
  }, [location]);
  const claimPanelRoute = () => {
    if (consumedRoute.current === location.key) return false;
    consumedRoute.current = location.key;
    return true;
  };
  const closePanelRoute = () => {
    // A departing dialog or unmounting workspace must not redirect a newer navigation.
    if (unmountedRef.current) return;
    if (latestLocation.current.key === location.key)
      void navigate(`/classrooms/${encodeURIComponent(classroomId)}`, {
        replace: true,
      });
  };
  // One-shot join banner: latch the outcome from router state, then clear the
  // state (replace) so reloads and back/forward never replay it or retain ids.
  const incomingOutcome = readClassroomJoinOutcome(location.state, classroomId);
  const [latched, setLatched] = useState(() => ({
    classroomId,
    stateKey: location.key,
    outcome: incomingOutcome,
  }));
  if (
    incomingOutcome &&
    (latched.stateKey !== location.key || latched.classroomId !== classroomId)
  ) {
    setLatched({
      classroomId,
      stateKey: location.key,
      outcome: incomingOutcome,
    });
  } else if (latched.classroomId !== classroomId) {
    setLatched({ classroomId, stateKey: location.key, outcome: null });
  }
  const joinOutcome =
    latched.classroomId === classroomId ? latched.outcome : null;
  const clearedState = useRef<string | null>(null);
  const hasIncomingOutcome = incomingOutcome !== null;
  useEffect(() => {
    if (!hasIncomingOutcome || clearedState.current === location.key) return;
    clearedState.current = location.key;
    void navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      { replace: true, state: null },
    );
  }, [hasIncomingOutcome, location, navigate]);
  const context = useClassroomContext(classroomId);
  useClassroomContextEvents(classroomId);
  useDocumentTitle(
    context.status === 'ready' ? context.classroom.name : messages.title,
  );

  if (context.status === 'pending')
    return <LoadingState label={messages.loading} />;
  if (context.status === 'error') {
    // This context-only entry does not distinguish unknown and denied resources.
    if (
      context.error.kind === 'not-found' ||
      context.error.kind === 'forbidden'
    ) {
      return <NotFoundPage />;
    }
    return (
      <ErrorState
        headingLevel="h2"
        title={messages.errorTitle}
        description={messages.errorDescription}
        onRetry={context.retry}
      />
    );
  }
  const { classroom, userId } = context;
  // Types describe the published contract, not validation of network bytes.
  // Missing or malformed availability never falls back to role/capabilities.
  const keys: unknown = classroom.availablePanels;
  const availability =
    Array.isArray(keys) && keys.every((key) => typeof key === 'string')
      ? { confirmed: true as const, keys }
      : { confirmed: false as const };
  return (
    <section key={`${userId}:${classroomId}`} className="min-w-0 space-y-6">
      <ClassroomPanelsProvider
        userId={userId}
        classroomId={classroomId}
        routeOwner={location.key}
        registry={panels}
        availability={availability}
        description={messages.panelDescription}
        fallbackFocus={() => heading.current ?? safeFocus.current}
      >
        <header className="min-w-0 space-y-2">
          <h2
            ref={heading}
            tabIndex={-1}
            className="font-display text-2xl font-semibold text-foreground wrap-anywhere"
          >
            {classroom.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {messages.role}: {messages.roles[classroom.myRole]}
          </p>
        </header>
        {joinOutcome && (
          <Alert
            variant={joinOutcome.alreadyMember ? 'info' : 'success'}
            role="status"
            aria-live="polite"
            data-testid="classroom-join-outcome"
          >
            <AlertTitle as="h3">
              {joinOutcome.alreadyMember
                ? joinMessages.outcome.alreadyMemberTitle
                : joinMessages.outcome.joinedTitle}
            </AlertTitle>
            <AlertDescription>
              {joinOutcome.role === 'TEACHER'
                ? joinOutcome.alreadyMember
                  ? joinMessages.outcome.teacherAlreadyMemberBody
                  : joinMessages.outcome.teacherJoinedBody
                : joinOutcome.alreadyMember
                  ? joinMessages.outcome.alreadyMemberBody
                  : joinMessages.outcome.joinedBody}{' '}
              {joinOutcome.desk
                ? joinMessages.outcome.formatAssignedDesk(
                    joinOutcome.desk.deskIndex,
                  )
                : joinMessages.outcome.noDeskAssigned}
            </AlertDescription>
          </Alert>
        )}
        <Outlet
          key={location.key}
          context={{ ...classroom, claimPanelRoute, closePanelRoute }}
        />
      </ClassroomPanelsProvider>
    </section>
  );
}
