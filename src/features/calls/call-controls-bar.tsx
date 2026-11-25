import { useId } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CALL_EMOTES,
  type CallEmote,
} from '@/realtime/call-contracts.generated';
import { callMessages } from './call-messages';
import type { CallSelfState } from './call-session';

export interface CallControlsBarProps {
  readonly self: CallSelfState;
  readonly isModerator: boolean;
  readonly onToggleMute: () => void;
  readonly onSendEmote: (emote: CallEmote) => void;
  readonly onLeave: () => void;
  readonly onEndCall: () => void;
}

function Icon({ path }: { readonly path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

const MIC =
  'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3';
const MIC_OFF = `${MIC}M4 4l16 16`;
const PHONE_OFF = 'M4 15c4-4 12-4 16 0l-2 3-3-1.5V14a9 9 0 0 0-6 0v2.5L6 18z';

/** Meet/Discord-like bottom bar. Presentational: state and actions come in as props. */
export function CallControlsBar({
  self,
  isModerator,
  onToggleMute,
  onSendEmote,
  onLeave,
  onEndCall,
}: CallControlsBarProps) {
  const hintId = useId();
  const micDisabled = !self.hasMicrophone || (self.muted && !self.canUnmute);
  const hint = !self.hasMicrophone
    ? callMessages.noMicHint
    : self.muted && !self.canUnmute
      ? callMessages.forcedMuteHint
      : null;

  return (
    <div
      role="group"
      aria-label={callMessages.controlsLabel}
      className="flex flex-wrap items-center justify-center gap-3"
    >
      <Button
        type="button"
        variant={self.muted ? 'destructive' : 'outline'}
        aria-pressed={self.muted}
        aria-describedby={hint ? hintId : undefined}
        disabled={micDisabled}
        onClick={onToggleMute}
      >
        <Icon path={self.muted ? MIC_OFF : MIC} />
        {self.muted ? callMessages.unmute : callMessages.mute}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline">
            <span aria-hidden="true">😄</span>
            {callMessages.emotes}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top">
          {CALL_EMOTES.map((emote) => (
            <DropdownMenuItem key={emote} onSelect={() => onSendEmote(emote)}>
              <span aria-hidden="true">{callMessages.emoteIcons[emote]}</span>
              {callMessages.emoteLabels[emote]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button type="button" variant="secondary" onClick={onLeave}>
        <Icon path={PHONE_OFF} />
        {callMessages.leave}
      </Button>
      {isModerator && (
        <Button type="button" variant="destructive" onClick={onEndCall}>
          {callMessages.endClass}
        </Button>
      )}
      {hint && (
        <p
          id={hintId}
          className="w-full text-center text-sm text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
