import { QueryClientContext } from '@tanstack/react-query';
import { useContext, type ReactNode, type RefObject } from 'react';
import { EmptyState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { useChatInbox } from '@/features/chat-inbox/use-chat-inbox';
import { classroomMessages } from './messages';
import {
  useClassroomPanels,
  type PanelDescriptor,
} from './panels/classroom-panels';

export interface Classroom2DLayoutProps {
  readonly classroomId?: string;
  readonly panels: readonly PanelDescriptor[];
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
  /** Extra item of the features list (the voice call). */
  readonly callAction?: ReactNode;
}

/**
 * Accessible 2D Classic Mode workspace layout (`HU-ESP-003`, `#34`).
 * Mounts zero WebGL/Three.js canvas elements and derives reachable panel
 * controls strictly from server-confirmed `availablePanels` (`canOpenPanel`).
 * Hides `chat` only when the global chat dock actually has a live inbox entry
 * for this classroom; otherwise keeps `chat` in the 2D panel grid as fallback.
 */
export function Classroom2DLayout(props: Classroom2DLayoutProps) {
  const queryClient = useContext(QueryClientContext);
  if (!queryClient || !props.classroomId) {
    return <Classroom2DLayoutContent {...props} hideChat={false} />;
  }
  return (
    <Classroom2DLayoutWithInbox
      classroomId={props.classroomId}
      panels={props.panels}
      headingRef={props.headingRef}
      callAction={props.callAction}
    />
  );
}

function Classroom2DLayoutWithInbox({
  classroomId,
  panels,
  headingRef,
  callAction,
}: Classroom2DLayoutProps & { readonly classroomId: string }) {
  const { inbox } = useChatInbox();
  const hideChat =
    inbox?.items.some((item) => item.classroomId === classroomId) ?? false;
  return (
    <Classroom2DLayoutContent
      panels={panels}
      headingRef={headingRef}
      callAction={callAction}
      hideChat={hideChat}
    />
  );
}

function Classroom2DLayoutContent({
  panels,
  headingRef,
  callAction,
  hideChat,
}: Pick<Classroom2DLayoutProps, 'panels' | 'headingRef' | 'callAction'> & {
  readonly hideChat: boolean;
}) {
  const { canOpenPanel, openPanel } = useClassroomPanels();
  const visiblePanels = panels.filter(
    (panel) => !(hideChat && panel.key === 'chat') && canOpenPanel(panel.key),
  );

  return (
    <section
      aria-labelledby="classroom-2d-heading"
      className="min-w-0 space-y-4 rounded-2xl border border-edge bg-card p-5 text-card-foreground shadow-panel"
    >
      <div className="min-w-0 space-y-1">
        <h3
          id="classroom-2d-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg font-semibold text-foreground outline-none"
        >
          {classroomMessages.viewMode.mode2dHeading}
        </h3>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {classroomMessages.viewMode.mode2dDescription}
        </p>
      </div>

      {visiblePanels.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={classroomMessages.viewMode.mode2dEmptyTitle}
          description={classroomMessages.viewMode.mode2dEmptyDescription}
        />
      ) : (
        <nav aria-label={classroomMessages.viewMode.mode2dNavLabel}>
          <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePanels.map((panel) => (
              <li key={panel.key} className="min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  aria-label={panel.title}
                  className="h-auto min-h-11 w-full justify-between px-4 py-3 text-left"
                  onClick={(event) => openPanel(panel.key, event.currentTarget)}
                >
                  <span className="min-w-0 wrap-anywhere">{panel.title}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xs font-medium text-muted-foreground"
                  >
                    {classroomMessages.viewMode.openPanelAction}
                  </span>
                </Button>
              </li>
            ))}
            {callAction ? (
              <li className="min-w-0 empty:hidden">{callAction}</li>
            ) : null}
          </ul>
        </nav>
      )}
    </section>
  );
}
