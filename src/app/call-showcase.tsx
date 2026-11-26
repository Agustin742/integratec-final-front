import { useState } from 'react';
import { CallView } from '@/features/calls/call-view';
import type { CallParticipantState } from '@/features/calls/call-session';
import type {
  CallEmote,
  CallModerate,
} from '@/realtime/call-contracts.generated';
import { useDocumentTitle } from './router/document-title';

const copy = {
  title: 'Muestra local · Ciencias',
  boundary:
    'Muestra visual con participantes ficticios. Sin conexión ni audio real.',
  request: 'Última solicitud simulada',
  emote: 'Última reacción simulada',
} as const;

const participants: readonly CallParticipantState[] = [
  {
    sessionId: 'showcase-teacher',
    userId: '00000000-0000-4000-8000-000000000001',
    displayName: 'Profe de muestra',
    role: 'TEACHER',
    isSelf: true,
    selfMuted: false,
    forcedMuted: false,
    muted: false,
    speaking: false,
    emote: '',
    emoteSeq: 0,
    appearance: {
      bodyId: 'female',
      hairId: 'bun',
      topId: 'school-smock',
      hairColor: '#6C4D48',
      clothingColor: '#5B4F96',
      items: {},
    },
  },
  {
    sessionId: 'showcase-student',
    userId: '00000000-0000-4000-8000-000000000002',
    displayName: 'Estudiante de muestra',
    role: 'STUDENT',
    isSelf: false,
    selfMuted: false,
    forcedMuted: false,
    muted: false,
    speaking: true,
    emote: '',
    emoteSeq: 0,
    appearance: {
      bodyId: 'male',
      hairId: 'afro',
      topId: 'basic-tshirt',
      hairColor: '#49364B',
      clothingColor: '#62CFC7',
      items: {},
    },
  },
];

const noAction = () => undefined;
const getLevel = (sessionId: string) =>
  sessionId === 'showcase-student' ? 0.35 : 0;

/** Local visual props only: never joins a room or captures a device. */
export function CallShowcase() {
  useDocumentTitle(copy.title);
  const [muted, setMuted] = useState(false);
  const [request, setRequest] = useState<CallModerate | null>(null);
  const [emoteState, setEmoteState] = useState<{
    readonly emote: CallEmote | '';
    readonly emoteSeq: number;
  }>({ emote: '', emoteSeq: 0 });
  const snapshot = participants.map((participant) =>
    participant.isSelf
      ? {
          ...participant,
          muted,
          selfMuted: muted,
          emote: emoteState.emote,
          emoteSeq: emoteState.emoteSeq,
        }
      : participant,
  );

  return (
    <main aria-label={copy.boundary}>
      <p className="sr-only">{copy.boundary}</p>
      <output className="sr-only" aria-label={copy.request}>
        {request ? JSON.stringify(request) : ''}
      </output>
      <output className="sr-only" aria-label={copy.emote}>
        {emoteState.emote ? `${emoteState.emote}:${emoteState.emoteSeq}` : ''}
      </output>
      <CallView
        title={copy.title}
        participants={snapshot}
        self={{
          muted,
          forcedMuted: false,
          canUnmute: true,
          hasMicrophone: true,
        }}
        micError={null}
        needsAudioUnlock={false}
        isModerator
        kind="classroom"
        allowSelfUnmute
        focusMode={false}
        getLevel={getLevel}
        onToggleMute={() => setMuted((value) => !value)}
        onModerate={setRequest}
        onSendEmote={(emote) =>
          setEmoteState((current) => ({
            emote,
            emoteSeq: current.emoteSeq + 1,
          }))
        }
        onLeave={noAction}
        onEndCall={noAction}
        onResumeAudio={noAction}
      />
    </main>
  );
}
