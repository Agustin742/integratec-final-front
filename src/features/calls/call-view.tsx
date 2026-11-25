import { useState, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  CallEmote,
  CallModerate,
} from '@/realtime/call-contracts.generated';
import { CallControlsBar } from './call-controls-bar';
import { ChatIcon, ShieldIcon } from './call-icons';
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
  /** Classroom chat shown in a toggleable side panel (drawer on small screens). */
  readonly chatPanel?: ReactNode;
  readonly onToggleMute: () => void;
  readonly onSendEmote: (emote: CallEmote) => void;
  readonly onLeave: () => void;
  readonly onEndCall: () => void;
  readonly onResumeAudio: () => void;
  readonly onModerate: (action: CallModerate) => void;
}

/**
 * Presentational call screen on a dark, elevated stage: top bar (title,
 * participant count, chat toggle), banners, the avatar stage, side panels
 * (teacher controls, chat) and the floating bottom controls bar.
 */
export function CallView(props: CallViewProps) {
  const showPanelToggle = props.isModerator && props.kind === 'classroom';
  const hasChat = props.chatPanel !== undefined;
  // One side panel at a time. Teacher controls start open on wide screens and
  // collapsed on small ones; the chat always starts closed.
  const [side, setSide] = useState<'teacher' | 'chat' | null>(() =>
    showPanelToggle &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(min-width: 1024px)').matches
      ? 'teacher'
      : null,
  );
  const teacherOpen = showPanelToggle && side === 'teacher';
  const chatOpen = hasChat && side === 'chat';
  const chatLabel = chatOpen ? callMessages.closeChat : callMessages.openChat;
  const teacherLabel = teacherOpen
    ? callMessages.closeTeacherPanel
    : callMessages.openTeacherPanel;

  return (
    <div className="flex h-dvh min-h-0 flex-col gap-3 bg-foreground p-3 text-background sm:p-4">
      <header className="flex min-w-0 items-center gap-3">
        <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold sm:text-xl">
          {props.title}
        </h2>
        <Badge variant="secondary">
          {callMessages.participantCount(props.participants.length)}
        </Badge>
        {showPanelToggle && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={teacherLabel}
            title={teacherLabel}
            aria-expanded={teacherOpen}
            onClick={() => setSide(teacherOpen ? null : 'teacher')}
          >
            <ShieldIcon />
          </Button>
        )}
        {hasChat && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={chatLabel}
            title={chatLabel}
            aria-expanded={chatOpen}
            onClick={() => setSide(chatOpen ? null : 'chat')}
          >
            <ChatIcon />
          </Button>
        )}
      </header>
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
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="min-h-48 min-w-0 flex-1 overflow-hidden rounded-3xl bg-foreground/60 p-2 shadow-inset ring-1 ring-background/10">
          <CallStage
            participants={props.participants}
            getLevel={props.getLevel}
          />
        </div>
        {teacherOpen && (
          <aside className="absolute inset-y-0 right-0 z-10 w-[min(22rem,100%)] overflow-y-auto rounded-3xl border border-edge bg-card p-3 text-card-foreground shadow-float lg:static lg:z-auto lg:w-80 lg:shrink-0">
            <TeacherPanel
              participants={props.participants}
              allowSelfUnmute={props.allowSelfUnmute}
              focusMode={props.focusMode}
              onModerate={props.onModerate}
            />
          </aside>
        )}
        {chatOpen && (
          <aside
            aria-label={callMessages.chatTitle}
            className="absolute inset-y-0 right-0 z-10 flex w-[min(22rem,100%)] flex-col overflow-hidden rounded-3xl border border-edge bg-card text-card-foreground shadow-float lg:static lg:z-auto lg:w-80 lg:shrink-0"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-edge px-3 py-1">
              <h3 className="min-w-0 flex-1 truncate font-display text-base font-semibold">
                {callMessages.chatTitle}
              </h3>
            </div>
            <div className="min-h-0 flex-1 p-2">{props.chatPanel}</div>
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
