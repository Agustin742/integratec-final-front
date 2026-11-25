import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CallModerate } from '@/realtime/call-contracts.generated';
import { CALL_MODERATOR_ROLES } from './call-config';
import { callMessages } from './call-messages';
import type { CallParticipantState } from './call-session';

const copy = callMessages.panel;

export interface TeacherPanelProps {
  readonly participants: readonly CallParticipantState[];
  readonly allowSelfUnmute: boolean;
  readonly focusMode: boolean;
  readonly onModerate: (action: CallModerate) => void;
}

function isStudent(p: CallParticipantState): boolean {
  return !p.isSelf && !CALL_MODERATOR_ROLES.includes(p.role.toUpperCase());
}

function Switch({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 accent-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      {label}
    </label>
  );
}

/** Moderator controls for a class call. Presentational: actions go out through `onModerate`. */
export function TeacherPanel({
  participants,
  allowSelfUnmute,
  focusMode,
  onModerate,
}: TeacherPanelProps) {
  const headingId = useId();
  const [announcement, setAnnouncement] = useState('');
  const students = participants.filter(isStudent);

  const act = (action: CallModerate, message: string) => {
    onModerate(action);
    setAnnouncement(message);
  };

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="font-display text-lg font-semibold">
        {copy.title}
      </h2>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          onModerate({ action: 'mute-all' });
          onModerate({ action: 'allow-self-unmute', value: false });
          setAnnouncement(copy.mutedAllAnnouncement);
        }}
      >
        {copy.muteAll}
      </Button>
      <div className="space-y-1">
        <Switch
          label={copy.allowSelfUnmute}
          checked={allowSelfUnmute}
          onChange={(value) =>
            act(
              { action: 'allow-self-unmute', value },
              value ? copy.allowOnAnnouncement : copy.allowOffAnnouncement,
            )
          }
        />
        <Switch
          label={copy.focusMode}
          checked={focusMode}
          onChange={(value) =>
            act(
              { action: 'focus-mode', value },
              value ? copy.focusOnAnnouncement : copy.focusOffAnnouncement,
            )
          }
        />
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-base font-semibold">
          {copy.studentsHeading}
        </h3>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.noStudents}</p>
        ) : (
          <ul className="space-y-2">
            {students.map((p) => (
              <li key={p.sessionId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {p.displayName}
                  {p.muted && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({copy.mutedBadge})
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={
                    p.muted
                      ? copy.unmuteOne(p.displayName)
                      : copy.muteOne(p.displayName)
                  }
                  onClick={() =>
                    p.muted
                      ? act(
                          { action: 'unmute', targetUserId: p.userId },
                          copy.unmutedOneAnnouncement(p.displayName),
                        )
                      : act(
                          { action: 'mute', targetUserId: p.userId },
                          copy.mutedOneAnnouncement(p.displayName),
                        )
                  }
                >
                  {p.muted ? 'Activar' : 'Silenciar'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
