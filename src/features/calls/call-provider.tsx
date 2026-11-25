import {
  Suspense,
  createContext,
  lazy,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from '@/components/ui/toast';
import type { CallJoinOptions } from '@/realtime/call-contracts.generated';
import { callMessages, endReasonMessage } from './call-messages';
import { useCallSession } from './use-call-session';

export interface CallsController {
  /** Call it synchronously from a click: the engine primes audio in the user gesture. */
  readonly start: (options: CallJoinOptions, label: string) => void;
  /** A call is joining, running or reconnecting. */
  readonly inCall: boolean;
}

// The call screen pulls in three.js and the chat; load it only when a call
// starts so the app shell stays light.
const CallView = lazy(() =>
  import('./call-view').then((m) => ({ default: m.CallView })),
);
const ChatConversationWithComposer = lazy(() =>
  import('@/features/classrooms/chat/chat-conversation').then((m) => ({
    default: m.ChatConversationWithComposer,
  })),
);

const CallsContext = createContext<CallsController | null>(null);

/** `null` outside the provider so call entry points simply do not render. */
export function useCalls(): CallsController | null {
  return useContext(CallsContext);
}

/**
 * App-wide owner of the single voice call. The call is a full-screen overlay
 * (not a route) so it survives navigation, and the chat dock, chat page and
 * classroom can all start it from their own buttons.
 */
export function CallProvider({ children }: { readonly children: ReactNode }) {
  const call = useCallSession();
  const [target, setTarget] = useState({ label: '', classroomId: '' });
  const label = target.label;
  const { join, status, endReason } = call;
  const inCall =
    status === 'joining' || status === 'connected' || status === 'reconnecting';

  const controller = useMemo<CallsController>(
    () => ({
      inCall,
      start: (options, nextLabel) => {
        setTarget({ label: nextLabel, classroomId: options.classroomId });
        void join(options).catch(() => {
          toast(callMessages.ended.unexpected, { id: 'call-ended' });
        });
      },
    }),
    [inCall, join],
  );

  useEffect(() => {
    if (status !== 'ended') return;
    const message = endReasonMessage(endReason);
    if (message) toast(message, { id: 'call-ended' });
  }, [status, endReason]);

  const title =
    call.kind === 'direct'
      ? callMessages.directTitle(label)
      : callMessages.classTitle(label);

  return (
    <CallsContext.Provider value={controller}>
      {children}
      {inCall && (
        <CallOverlay title={title}>
          <Suspense fallback={null}>
            <CallView
              title={title}
              participants={call.participants}
              self={call.self}
              micError={call.micError}
              needsAudioUnlock={call.needsAudioUnlock}
              isModerator={call.isModerator}
              kind={call.kind}
              allowSelfUnmute={call.allowSelfUnmute}
              focusMode={call.focusMode}
              getLevel={call.getLevel}
              chatPanel={
                call.kind === 'classroom' && target.classroomId !== '' ? (
                  <ChatConversationWithComposer
                    classroomId={target.classroomId}
                    variant="dock"
                  />
                ) : undefined
              }
              onToggleMute={call.toggleMute}
              onSendEmote={call.sendEmote}
              onLeave={() => void call.leave()}
              onEndCall={call.endCall}
              onResumeAudio={() => void call.resumeAudio()}
              onModerate={call.moderate}
            />
          </Suspense>
        </CallOverlay>
      )}
    </CallsContext.Provider>
  );
}

/** Full-screen layer: takes focus on open and gives it back to the opener on close. */
function CallOverlay({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground text-background outline-none"
    >
      {children}
    </div>
  );
}
