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
import { MicIcon, MicOffIcon, PhoneOffIcon, ReactionIcon } from './call-icons';
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

/**
 * Floating Meet/Discord-like control bar: round icon buttons whose name is also
 * their native tooltip. Presentational: state and actions come in as props.
 */
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
  const micLabel = self.muted ? callMessages.unmute : callMessages.mute;

  return (
    <div
      role="group"
      aria-label={callMessages.controlsLabel}
      className="flex flex-col items-center gap-2"
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-3xl border border-edge bg-card/95 p-2 text-card-foreground shadow-float backdrop-blur-md">
        <Button
          type="button"
          size="icon"
          variant={self.muted ? 'destructive' : 'outline'}
          className="rounded-full"
          aria-label={micLabel}
          title={micLabel}
          aria-pressed={self.muted}
          aria-describedby={hint ? hintId : undefined}
          disabled={micDisabled}
          onClick={onToggleMute}
        >
          {self.muted ? <MicOffIcon /> : <MicIcon />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-full"
              aria-label={callMessages.emotes}
              title={callMessages.emotes}
            >
              <ReactionIcon />
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
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="rounded-full"
          aria-label={callMessages.leave}
          title={callMessages.leave}
          onClick={onLeave}
        >
          <PhoneOffIcon />
        </Button>
        {isModerator && (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onEndCall}
          >
            {callMessages.endClass}
          </Button>
        )}
      </div>
      {hint && (
        <p
          id={hintId}
          className="max-w-md text-center text-sm text-background/80"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
