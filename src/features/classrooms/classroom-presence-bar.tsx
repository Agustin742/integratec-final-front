import type { components } from '@/api/schema.generated';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

function statusBadgeMeta(status: ClassroomPresence['status']): {
  readonly label: string;
  readonly variant: 'success' | 'warning' | 'outline';
} {
  switch (status) {
    case 'connected':
      return { label: messages.presence.liveBadge, variant: 'success' };
    case 'reconnecting':
      return { label: messages.presence.reconnectingBadge, variant: 'warning' };
    case 'connecting':
      return { label: messages.presence.connectingBadge, variant: 'outline' };
    default:
      return { label: messages.presence.disconnectedBadge, variant: 'outline' };
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

  const badge = statusBadgeMeta(presence.status);
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
      aria-live="polite"
      data-testid="classroom-presence-bar"
      className="min-w-0 space-y-2 rounded-xl border border-edge bg-card/90 p-3 text-sm text-card-foreground shadow-xs"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {presence.presenceUncertain && (
          <Badge variant="outline">{messages.presence.uncertainBadge}</Badge>
        )}
        {presence.status !== 'connected' && presence.message && (
          <span className="min-w-0 text-xs text-muted-foreground">
            {presence.message}
          </span>
        )}
        {presence.status === 'disconnected' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void presence.reconnect()}
          >
            {messages.presence.retryAction}
          </Button>
        )}
        {activeControls.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {activeControls.map((label) => (
              <Badge key={label} variant="warning">
                {label}
              </Badge>
            ))}
          </div>
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
