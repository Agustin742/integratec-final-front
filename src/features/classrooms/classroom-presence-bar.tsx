import type { components } from '@/api/schema.generated';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { classroomMessages as messages } from './messages';
import type { ClassroomPresence } from './use-classroom-presence';

type ClassroomControlsSource = Pick<
  components['schemas']['ClassroomContextResponseDto'],
  'chatMuted' | 'collaborationLocked' | 'gamesDisabled'
>;

export interface ClassroomPresenceBarProps {
  readonly presence: ClassroomPresence;
  readonly currentUserId: string;
  readonly classroom: ClassroomControlsSource;
}

function formatParticipantRole(role: string): string {
  if (role in messages.roles) {
    return messages.roles[role as keyof typeof messages.roles];
  }
  return role;
}

function statusIndicatorMeta(status: ClassroomPresence['status']): {
  readonly label: string;
  readonly pillClassName: string;
  readonly dotClassName: string;
} {
  switch (status) {
    case 'connected':
      return {
        label: messages.presence.liveBadge,
        pillClassName:
          'border-success-edge/40 bg-success/60 text-success-foreground',
        dotClassName: 'bg-success-foreground',
      };
    case 'reconnecting':
      return {
        label: messages.presence.reconnectingBadge,
        pillClassName:
          'border-warning-edge/50 bg-warning/60 text-warning-foreground',
        dotClassName: 'bg-warning-foreground motion-safe:animate-pulse',
      };
    case 'connecting':
      return {
        label: messages.presence.connectingBadge,
        pillClassName: 'border-edge/70 bg-tray/70 text-muted-foreground',
        dotClassName: 'bg-muted-foreground/70 motion-safe:animate-pulse',
      };
    default:
      return {
        label: messages.presence.disconnectedBadge,
        pillClassName: 'border-edge/70 bg-tray/70 text-muted-foreground',
        dotClassName: 'bg-muted-foreground/60',
      };
  }
}

/**
 * Honest connection status and live presence bar for `ClassroomWorkspace` (#37).
 * Never claims confirmed presence while `presenceUncertain` is true, and omits
 * `role="status"` so workspace loading-status assertions stay unambiguous.
 */
export function ClassroomPresenceBar({
  presence,
  currentUserId,
  classroom,
}: ClassroomPresenceBarProps) {
  if (presence.isIdle) {
    return null;
  }

  if (presence.status === 'rejected') {
    return (
      <Alert
        variant="destructive"
        role="alert"
        data-testid="classroom-realtime-rejected"
      >
        <AlertTitle as="h3">{messages.presence.rejectedTitle}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>{presence.message}</span>
          {presence.reason !== 'forbidden' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void presence.reconnect()}
            >
              {messages.presence.retryAction}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const statusMeta = statusIndicatorMeta(presence.status);
  const showParticipants =
    presence.status === 'connected' || presence.status === 'reconnecting';
  const activeControls: string[] = [];
  if (classroom.chatMuted)
    activeControls.push(messages.presence.controls.chatMuted);
  if (classroom.collaborationLocked) {
    activeControls.push(messages.presence.controls.collaborationLocked);
  }
  if (classroom.gamesDisabled) {
    activeControls.push(messages.presence.controls.gamesDisabled);
  }
  if (presence.frozen) activeControls.push(messages.presence.controls.frozen);

  return (
    <section
      aria-label={messages.presence.regionLabel}
      data-testid="classroom-presence-bar"
      className="min-w-0 space-y-2 rounded-xl border border-edge bg-card/90 p-3 text-sm text-card-foreground shadow-xs"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div
          aria-live="polite"
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${statusMeta.pillClassName}`}
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${statusMeta.dotClassName}`}
            />
            {statusMeta.label}
          </span>
          {presence.presenceUncertain && (
            <span className="text-xs font-medium text-muted-foreground">
              · {messages.presence.uncertainBadge}
            </span>
          )}
          {presence.status !== 'connected' && presence.message && (
            <span className="min-w-0 text-xs text-muted-foreground">
              — {presence.message}
            </span>
          )}
          {activeControls.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeControls.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-md border border-warning-edge/50 bg-warning/50 px-2 py-0.5 text-xs font-medium text-warning-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        {presence.status === 'disconnected' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="sm:ml-auto"
            onClick={() => void presence.reconnect()}
          >
            {messages.presence.retryAction}
          </Button>
        )}
      </div>

      {showParticipants &&
        (presence.participants.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {messages.presence.emptyParticipants}
          </p>
        ) : (
          <ul className="flex min-w-0 flex-wrap gap-2">
            {presence.participants.map((participant) => {
              const isSelf = participant.userId === currentUserId;
              const isParticipantReconnecting =
                participant.status === 'reconnecting';
              return (
                <li
                  key={participant.userId}
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-edge bg-tray/60 px-2.5 py-1 text-xs"
                >
                  <span className="max-w-44 truncate font-medium text-foreground">
                    {participant.displayName}
                  </span>
                  {isSelf && (
                    <span className="text-muted-foreground">
                      {messages.presence.youSuffix}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    · {formatParticipantRole(participant.role)}
                  </span>
                  {isParticipantReconnecting && (
                    <span className="text-warning-foreground">
                      ({messages.presence.participantReconnecting})
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
