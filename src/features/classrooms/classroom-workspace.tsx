import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import type { components } from '@/api/schema.generated';
import { NotFoundPage } from '@/app/pages/not-found-page';
import { useDocumentTitle } from '@/app/router/document-title';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { WalletIndicator } from '@/features/points/wallet-indicator';
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
  useLayoutEffect(() => {
    latestLocation.current = location;
  }, [location]);
  const claimPanelRoute = () => {
    if (consumedRoute.current === location.key) return false;
    consumedRoute.current = location.key;
    return true;
  };
  const closePanelRoute = () => {
    // A departing dialog must not redirect a newer classroom/navigation.
    if (latestLocation.current.key === location.key)
      void navigate(`/classrooms/${encodeURIComponent(classroomId)}`, {
        replace: true,
      });
  };
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
          {/* The server context decides who sees their own wallet (S2.4); no
              client role string is trusted here. */}
          {classroom.myRole === 'STUDENT' && (
            <WalletIndicator classroomId={classroomId} />
          )}
        </header>
        <Outlet
          key={location.key}
          context={{ ...classroom, claimPanelRoute, closePanelRoute }}
        />
      </ClassroomPanelsProvider>
    </section>
  );
}
