import { Button } from '@/components/ui/button';
import { callMessages } from './call-messages';
import type { IncomingCall } from './use-classroom-call-signals';

const copy = callMessages.entry;

export interface ClassCallBannerProps {
  /** The server granted this user the right to run class calls. */
  readonly canStart: boolean;
  /** A class call is running in this classroom. */
  readonly active: boolean;
  readonly inCall: boolean;
  readonly onStart: () => void;
  readonly onJoin: () => void;
}

/**
 * Classroom entry point. Moderators start the class call; everybody else only
 * sees the join banner once it is running (the server rejects other starts).
 */
export function ClassCallBanner({
  canStart,
  active,
  inCall,
  onStart,
  onJoin,
}: ClassCallBannerProps) {
  if (inCall) return null;
  if (active) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-info-edge bg-info px-4 py-3 text-info-foreground"
      >
        <p className="font-display font-semibold">{copy.classActive}</p>
        <Button type="button" size="sm" onClick={onJoin}>
          {copy.join}
        </Button>
      </div>
    );
  }
  if (!canStart) return null;
  return (
    <div>
      <Button type="button" variant="secondary" onClick={onStart}>
        {copy.startClass}
      </Button>
    </div>
  );
}

export interface ClassCallButtonViewProps {
  readonly canStart: boolean;
  readonly active: boolean;
  readonly inCall: boolean;
  readonly onClick: () => void;
}

/** Compact call button for the chat headers, with the same rules as the banner. */
export function ClassCallButtonView({
  canStart,
  active,
  inCall,
  onClick,
}: ClassCallButtonViewProps) {
  if (inCall || (!canStart && !active)) return null;
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {active ? copy.joinShort : copy.startClass}
    </Button>
  );
}

export interface IncomingCallPromptProps {
  readonly calls: readonly IncomingCall[];
  readonly onAccept: (call: IncomingCall) => void;
  readonly onDecline: (call: IncomingCall) => void;
}

/** Ringing direct calls: non-modal cards so the user can finish what they were doing. */
export function IncomingCallPrompt({
  calls,
  onAccept,
  onDecline,
}: IncomingCallPromptProps) {
  if (calls.length === 0) return null;
  return (
    <div
      role="region"
      aria-label={callMessages.incoming.group}
      aria-live="assertive"
      className="fixed top-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3"
    >
      {calls.map((call) => {
        const title = callMessages.incoming.title(call.callerDisplayName);
        return (
          <div
            key={call.callerUserId}
            role="group"
            aria-label={title}
            className="space-y-3 rounded-2xl border border-edge bg-popover p-4 text-popover-foreground shadow-float"
          >
            <p className="font-display font-semibold">{title}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => onAccept(call)}>
                {callMessages.incoming.accept}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDecline(call)}
              >
                {callMessages.incoming.decline}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
