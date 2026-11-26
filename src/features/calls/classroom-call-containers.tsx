import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useCalls } from './call-provider';
import { PhoneIcon } from './call-icons';
import { callMessages } from './call-messages';
import { ClassCallButtonView, IncomingCallPrompt } from './class-call-entry';
import { isWorldLocked } from './focus-mode';
import {
  useClassroomCallSignals,
  type IncomingCall,
} from './use-classroom-call-signals';

/**
 * Rings for direct calls and caller-side decline feedback. Mount it once per
 * classroom: rings travel over the classroom connection.
 */
export function IncomingCallListener({
  classroomId,
}: {
  readonly classroomId: string;
}) {
  const calls = useCalls();
  const signals = useClassroomCallSignals(classroomId);
  const { incomingCalls, declinedByUserId, dismissDeclined, declineCall } =
    signals;
  // Accepted callers stay in `incomingCalls` until the server cancels the ring.
  const [accepted, setAccepted] = useState<readonly string[]>([]);

  const stillRinging = accepted.filter((id) =>
    incomingCalls.some((call) => call.callerUserId === id),
  );
  if (stillRinging.length !== accepted.length) setAccepted(stillRinging);

  useEffect(() => {
    if (declinedByUserId === null) return;
    toast(callMessages.ended.declined, { id: 'call-ended' });
    dismissDeclined();
  }, [declinedByUserId, dismissDeclined]);

  if (calls === null || calls.inCall) return null;
  const ringing = incomingCalls.filter(
    (call) => !accepted.includes(call.callerUserId),
  );
  const accept = (call: IncomingCall) => {
    setAccepted((current) => [...current, call.callerUserId]);
    calls.start(
      {
        kind: 'direct',
        classroomId,
        peerUserId: call.callerUserId,
      },
      call.callerDisplayName,
    );
  };
  return (
    <IncomingCallPrompt
      calls={ringing}
      onAccept={accept}
      onDecline={(call) => void declineCall(call.callerUserId)}
    />
  );
}

/** Call action for the classroom feature rail; moderators start, others join while it runs. */
export function ClassCallButton(props: {
  readonly classroomId: string;
  readonly classroomName: string;
  /** Derived from the workspace's confirmed classroom capabilities. */
  readonly canStart: boolean;
  readonly appearance?: 'rail' | 'tile';
  readonly className?: string;
}) {
  const calls = useCalls();
  if (calls === null) return null;
  return <ClassCallButtonContent calls={calls} {...props} />;
}

function ClassCallButtonContent({
  calls,
  classroomId,
  classroomName,
  canStart,
  appearance,
  className,
}: {
  readonly calls: NonNullable<ReturnType<typeof useCalls>>;
  readonly classroomId: string;
  readonly classroomName: string;
  readonly canStart: boolean;
  readonly appearance?: 'rail' | 'tile';
  readonly className?: string;
}) {
  const { classCallActive } = useClassroomCallSignals(classroomId);
  return (
    <ClassCallButtonView
      canStart={canStart}
      active={classCallActive}
      inCall={calls.inCall}
      appearance={appearance}
      className={className}
      onClick={() =>
        calls.start({ kind: 'classroom', classroomId }, classroomName)
      }
    />
  );
}

/** True while a teacher's focus mode hides the 3D world from this student. */
export function useWorldLocked(
  classroomId: string | null,
  myRole: string,
): boolean {
  const { focusMode } = useClassroomCallSignals(classroomId);
  return isWorldLocked(myRole, focusMode);
}

/** "Llamar" action for a classroom member row (direct 1:1 call). */
export function DirectCallButton({
  classroomId,
  peerUserId,
  peerName,
}: {
  readonly classroomId: string;
  readonly peerUserId: string;
  readonly peerName: string;
}) {
  const calls = useCalls();
  if (calls === null || calls.inCall) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={callMessages.entry.callMember(peerName)}
      title={callMessages.entry.callMember(peerName)}
      onClick={() =>
        calls.start({ kind: 'direct', classroomId, peerUserId }, peerName)
      }
    >
      <PhoneIcon />
      {callMessages.entry.callAction}
    </Button>
  );
}
