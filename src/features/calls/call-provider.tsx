import {
  createContext,
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
import { CallView } from './call-view';
import { useCallSession } from './use-call-session';

export interface CallsController {
  /** Call it synchronously from a click: the engine primes audio in the user gesture. */
  readonly start: (options: CallJoinOptions, label: string) => void;
  /** A call is joining, running or reconnecting. */
  readonly inCall: boolean;
}

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
  const [label, setLabel] = useState('');
  const { join, status, endReason } = call;
  const inCall =
    status === 'joining' || status === 'connected' || status === 'reconnecting';

  const controller = useMemo<CallsController>(
    () => ({
      inCall,
      start: (options, nextLabel) => {
        setLabel(nextLabel);
        void join(options);
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
            onToggleMute={call.toggleMute}
            onSendEmote={call.sendEmote}
            onLeave={() => void call.leave()}
            onEndCall={call.endCall}
            onResumeAudio={() => void call.resumeAudio()}
            onModerate={call.moderate}
          />
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
      className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground outline-none"
    >
      {children}
    </div>
  );
}
