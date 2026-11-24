import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
import type { components } from '@/api/schema.generated';
import { NotFoundPage } from '@/app/pages/not-found-page';
import { useDocumentTitle } from '@/app/router/document-title';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WalletIndicator } from '@/features/points/wallet-indicator';
import { Button, buttonStyles } from '@/components/ui/button';
import {
  isEditableTarget,
  isInteractionBlocked,
} from '@/lib/input-arbitration';
import { useSessionCleanup, useSessionSnapshot } from '@/session/provider';
import { Classroom2DLayout } from './classroom-2d-layout';
import { Classroom3DStage, clearLoadedWorldAssets } from './classroom-3d-stage';
import { Classroom3DTopBar } from './classroom-3d-top-bar';
import { useClassroomViewMode } from './classroom-mode-store';
import { ClassroomPresenceBar } from './classroom-presence-bar';
import { joinMessages } from './join-messages';
import { readClassroomJoinOutcome } from './join-schema';
import { classroomMessages as messages } from './messages';
import { PerformanceOfferBanner } from './performance-offer-banner';
import {
  beginPerformanceOffer,
  usePerformanceOfferStore,
} from './performance-offer-store';
import { useClassroomContext } from './use-classroom-capabilities';
import { useClassroomContextEvents } from './use-classroom-context-events';
import { useClassroomPresence } from './use-classroom-presence';
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
  const activeViewHeadingRef = useRef<HTMLHeadingElement>(null);
  const lostAccessHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocusSwitchRef = useRef(false);
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
  const snapshot = useSessionSnapshot();
  const sessionUserId =
    snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const scopeKey =
    sessionUserId !== null ? `${sessionUserId}:${classroomId}` : '';
  const [revokedScopeKey, setRevokedScopeKey] = useState<string | null>(null);
  const isRevoked = scopeKey !== '' && revokedScopeKey === scopeKey;

  const context = useClassroomContext(classroomId, { enabled: !isRevoked });
  useClassroomContextEvents(classroomId, !isRevoked);
  useSessionCleanup(() => clearLoadedWorldAssets({ disposeDecoders: true }));
  useEffect(() => {
    return () => {
      clearLoadedWorldAssets({ scopeKey: classroomId });
    };
  }, [classroomId]);
  const { mode, setMode, toggleMode } = useClassroomViewMode(sessionUserId);

  const isParent =
    context.status === 'ready' && context.classroom.myRole === 'PARENT';
  const modeToggleEnabled = context.status === 'ready' && !isParent;
  const handleLostAccess = useCallback(() => {
    if (scopeKey !== '') {
      setRevokedScopeKey(scopeKey);
    }
  }, [scopeKey]);
  const presence = useClassroomPresence({
    classroomId,
    userId: sessionUserId,
    enabled: modeToggleEnabled && !isRevoked,
    mode,
    onLostAccess: handleLostAccess,
  });

  useEffect(() => {
    if (presence.lostAccess) {
      lostAccessHeadingRef.current?.focus();
    }
  }, [presence.lostAccess]);

  const handleModeToggle = useCallback(() => {
    pendingFocusSwitchRef.current = true;
    // Switching to 2D by hand answers a visible 2D offer (no-op otherwise),
    // so it does not reappear stale after returning to 3D.
    if (mode === '3d') {
      usePerformanceOfferStore.getState().accept();
    }
    toggleMode();
  }, [mode, toggleMode]);

  useLayoutEffect(() => {
    if (
      modeToggleEnabled &&
      pendingFocusSwitchRef.current &&
      activeViewHeadingRef.current
    ) {
      pendingFocusSwitchRef.current = false;
      activeViewHeadingRef.current.focus();
    }
  }, [modeToggleEnabled, mode]);

  useEffect(() => {
    if (!modeToggleEnabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat
      ) {
        return;
      }
      const keyMatches =
        event.code === 'KeyM' || event.key.toLowerCase() === 'm';
      if (!keyMatches || isEditableTarget(event.target)) {
        return;
      }
      if (isInteractionBlocked()) {
        return;
      }
      event.preventDefault();
      handleModeToggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modeToggleEnabled, handleModeToggle]);
  useDocumentTitle(
    presence.lostAccess
      ? messages.presence.lostAccessTitle
      : context.status === 'ready'
        ? context.classroom.name
        : messages.title,
  );

  if (presence.lostAccess) {
    return (
      <section
        key={`${sessionUserId ?? 'none'}:${classroomId}`}
        className="min-w-0 space-y-4"
      >
        <Alert
          variant="destructive"
          role="alert"
          data-testid="classroom-lost-access"
        >
          <AlertTitle as="h2" ref={lostAccessHeadingRef} tabIndex={-1}>
            {messages.presence.lostAccessTitle}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{presence.lostAccessMessage}</p>
            <Link
              to="/"
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
            >
              {messages.backToList}
            </Link>
          </AlertDescription>
        </Alert>
      </section>
    );
  }
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
  const immersive = !isParent && mode === '3d';
  const joinAlert = joinOutcome && (
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
          ? joinMessages.outcome.formatAssignedDesk(joinOutcome.desk.deskIndex)
          : joinMessages.outcome.noDeskAssigned}
      </AlertDescription>
    </Alert>
  );
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
        immersive={immersive}
      >
        {immersive ? (
          <Classroom3DStage
            headingRef={activeViewHeadingRef}
            scopeKey={classroomId}
            classroomId={classroomId}
            petName={classroom.pet?.name ?? null}
            selfPose={presence.selfPose}
            connectionKey={presence.connectionKey}
            frozen={presence.frozen}
            remoteParticipants={presence.remoteParticipants}
            onIntentChange={presence.sendIntent}
            onSustainedLowFps={beginPerformanceOffer}
            topSlot={
              <>
                <Classroom3DTopBar
                  classroomName={classroom.name}
                  roleLabel={messages.roles[classroom.myRole]}
                  headingRef={heading}
                  modeToggleLabel={messages.viewMode.switchTo2d}
                  onToggleMode={handleModeToggle}
                  wallet={
                    classroom.myRole === 'STUDENT' ? (
                      <WalletIndicator classroomId={classroomId} />
                    ) : null
                  }
                  presence={
                    <ClassroomPresenceBar
                      presence={presence}
                      currentUserId={userId}
                      classroom={classroom}
                    />
                  }
                />
                {joinAlert && (
                  <div className="pointer-events-auto w-full max-w-3xl">
                    {joinAlert}
                  </div>
                )}
                {/* Sustained low fps shows a non-blocking offer (#56); the
                    app never switches modes without the user's choice. */}
                <div className="pointer-events-auto w-full max-w-3xl empty:hidden">
                  <PerformanceOfferBanner
                    onAccept={() => {
                      pendingFocusSwitchRef.current = true;
                      setMode('2d');
                    }}
                    onDecline={() => activeViewHeadingRef.current?.focus()}
                  />
                </div>
              </>
            }
          />
        ) : (
          <>
            <header className="min-w-0 space-y-3">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Link
                    to="/"
                    aria-label={messages.backToList}
                    title={messages.backToList}
                    className={buttonStyles({
                      variant: 'outline',
                      size: 'icon',
                    })}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-6"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </Link>
                  <div className="min-w-0 space-y-1.5">
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
                  </div>
                </div>
                {!isParent && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Visual cue only: aria-keyshortcuts on the button already announces Alt+M. */}
                    <span
                      aria-hidden="true"
                      className="hidden text-xs text-muted-foreground sm:inline"
                    >
                      {messages.viewMode.shortcutHint}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-keyshortcuts="Alt+M"
                      onClick={handleModeToggle}
                    >
                      {mode === '3d'
                        ? messages.viewMode.switchTo2d
                        : messages.viewMode.switchTo3d}
                    </Button>
                  </div>
                )}
              </div>
              {classroom.myRole === 'STUDENT' && (
                <WalletIndicator classroomId={classroomId} />
              )}
              {!isParent && (
                <ClassroomPresenceBar
                  presence={presence}
                  currentUserId={userId}
                  classroom={classroom}
                />
              )}
            </header>
            {joinAlert}
            {!isParent && (
              <Classroom2DLayout
                panels={panels}
                headingRef={activeViewHeadingRef}
              />
            )}
          </>
        )}
        <Outlet
          key={location.key}
          context={{ ...classroom, claimPanelRoute, closePanelRoute }}
        />
      </ClassroomPanelsProvider>
    </section>
  );
}
