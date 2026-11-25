import { Button } from '@/components/ui/button';
import { PhoneIcon } from './call-icons';
import { callMessages } from './call-messages';
import type { IncomingCall } from './use-classroom-call-signals';

const copy = callMessages.entry;

export interface ClassCallButtonViewProps {
  readonly canStart: boolean;
  readonly active: boolean;
  readonly inCall: boolean;
  readonly onClick: () => void;
  /** Icon-only variant for the chat headers, like their sibling actions. */
  readonly compact?: boolean;
}

/** Header call action: moderators start the class call, everybody else joins it while it runs. */
export function ClassCallButtonView({
  canStart,
  active,
  inCall,
  onClick,
  compact = false,
}: ClassCallButtonViewProps) {
  if (inCall || (!canStart && !active)) return null;
  const label = active ? copy.joinShort : copy.startClass;
  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        onClick={onClick}
      >
        <PhoneIcon />
      </Button>
    );
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <PhoneIcon />
      {label}
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
