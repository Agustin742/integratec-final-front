import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type {
  CallEmote,
  CallModerate,
} from '@/realtime/call-contracts.generated';
import { CallControlsBar } from './call-controls-bar';
import { callMessages } from './call-messages';
import { CallStage } from './call-stage';
import type { CallParticipantState, CallSelfState } from './call-session';
import type { MicCaptureErrorCode } from './mic-capture';
import { TeacherPanel } from './teacher-panel';

export interface CallViewProps {
  readonly title: string;
  readonly participants: readonly CallParticipantState[];
  readonly self: CallSelfState;
  readonly micError: MicCaptureErrorCode | null;
  readonly needsAudioUnlock: boolean;
  readonly isModerator: boolean;
  readonly kind: string | null;
  readonly allowSelfUnmute: boolean;
  readonly focusMode: boolean;
  readonly getLevel: (sessionId: string) => number;
  readonly onToggleMute: () => void;
  readonly onSendEmote: (emote: CallEmote) => void;
  readonly onLeave: () => void;
  readonly onEndCall: () => void;
  readonly onResumeAudio: () => void;
  readonly onModerate: (action: CallModerate) => void;
}

/**
 * Presentational call screen: banners, the avatar stage, the teacher panel
 * (class calls, moderators only) and the bottom controls bar.
 */
export function CallView(props: CallViewProps) {
  const showPanel = props.isModerator && props.kind === 'classroom';
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4">
      <h2 className="font-display text-xl font-semibold">{props.title}</h2>
      {props.micError && (
        <Alert variant="warning" role="alert">
          <AlertDescription>
            {callMessages.micErrors[props.micError]}
          </AlertDescription>
        </Alert>
      )}
      {props.needsAudioUnlock && (
        <Alert variant="info" role="status">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{callMessages.unlockAudioHint}</span>
            <Button type="button" size="sm" onClick={props.onResumeAudio}>
              {callMessages.unlockAudio}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="min-h-64 min-w-0 flex-1">
          <CallStage
            participants={props.participants}
            getLevel={props.getLevel}
          />
        </div>
        {showPanel && (
          <aside className="max-h-72 shrink-0 overflow-y-auto rounded-2xl border border-edge bg-card p-4 text-card-foreground lg:max-h-none lg:w-80">
            <TeacherPanel
              participants={props.participants}
              allowSelfUnmute={props.allowSelfUnmute}
              focusMode={props.focusMode}
              onModerate={props.onModerate}
            />
          </aside>
        )}
      </div>
      <CallControlsBar
        self={props.self}
        isModerator={props.isModerator}
        onToggleMute={props.onToggleMute}
        onSendEmote={props.onSendEmote}
        onLeave={props.onLeave}
        onEndCall={props.onEndCall}
      />
    </div>
  );
}
