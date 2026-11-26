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
  /**
   * Where the action lives: "rail" is a floating item of the 3D side rail and
   * "tile" an item of the 2D features list; both match their sibling items.
   */
  readonly appearance?: 'rail' | 'tile';
  /** Sibling-item classes supplied by the host rail. */
  readonly className?: string;
}

/** Classroom call action: moderators start the class call, everybody else joins it while it runs. */
export function ClassCallButtonView({
  canStart,
  active,
  inCall,
  onClick,
  appearance = 'tile',
  className,
}: ClassCallButtonViewProps) {
  if (inCall || (!canStart && !active)) return null;
  const label = active ? copy.joinShort : copy.startClass;
  if (appearance === 'rail') {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        className={className}
        onClick={onClick}
      >
        <PhoneIcon />
        <span className="max-sm:sr-only" aria-hidden="true">
          {label}
        </span>
      </button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={label}
      className="h-auto min-h-11 w-full justify-between px-4 py-3 text-left"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-2 wrap-anywhere">
        <PhoneIcon />
        {label}
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-xs font-medium text-muted-foreground"
      >
        {active ? copy.railJoin : copy.railStart}
      </span>
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
