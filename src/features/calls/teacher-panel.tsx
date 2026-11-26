import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import type { CallModerate } from '@/realtime/call-contracts.generated';
import { CALL_MODERATOR_ROLES } from './call-config';
import { MicIcon, MicOffIcon } from './call-icons';
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

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-tray-hover">
      <span className="min-w-0 text-sm font-medium text-pretty">{label}</span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="h-6 w-11 rounded-full border border-edge bg-tray transition-colors peer-checked:bg-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        />
        <span
          aria-hidden="true"
          className="absolute top-0.5 left-0.5 size-5 rounded-full bg-card shadow-raised transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3
        id={id}
        className="px-3 font-display text-sm font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function micState(p: CallParticipantState): string {
  if (p.forcedMuted) return copy.forcedMutedBadge;
  if (p.selfMuted) return copy.selfMutedBadge;
  return copy.micActive;
}

/**
 * Moderator controls for a class call: class-wide settings and one row per
 * student. Presentational: actions go out through `onModerate`.
 */
export function TeacherPanel({
  participants,
  allowSelfUnmute,
  focusMode,
  onModerate,
}: TeacherPanelProps) {
  const headingId = useId();
  const [announcement, setAnnouncement] = useState('');
  const students = participants.filter(isStudent);

  const act = (action: CallModerate) => {
    onModerate(action);
    setAnnouncement(copy.moderationRequestedAnnouncement);
  };

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <h2 id={headingId} className="font-display text-lg font-semibold">
        {copy.title}
      </h2>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Section title={copy.classSection}>
        <div className="space-y-1">
          <SwitchRow
            label={copy.focusMode}
            checked={focusMode}
            onChange={(value) => act({ action: 'focus-mode', value })}
          />
          <SwitchRow
            label={copy.allowSelfUnmute}
            checked={allowSelfUnmute}
            onChange={(value) => act({ action: 'allow-self-unmute', value })}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            onModerate({ action: 'mute-all' });
            onModerate({ action: 'allow-self-unmute', value: false });
            setAnnouncement(copy.moderationRequestedAnnouncement);
          }}
        >
          <MicOffIcon />
          {copy.muteAll}
        </Button>
      </Section>
      <Section title={copy.participantsSection}>
        {students.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">
            {copy.noStudents}
          </p>
        ) : (
          <ul className="space-y-1">
            {students.map((p) => {
              const muted = p.muted;
              return (
                <li
                  key={p.sessionId}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                >
                  <InitialsAvatar name={p.displayName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {p.displayName}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {muted ? <MicOffIcon /> : <MicIcon />}
                      <span>{micState(p)}</span>
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={p.forcedMuted ? 'default' : 'outline'}
                    aria-label={
                      p.forcedMuted
                        ? copy.unmuteOne(p.displayName)
                        : copy.muteOne(p.displayName)
                    }
                    onClick={() =>
                      p.forcedMuted
                        ? act({ action: 'unmute', targetUserId: p.userId })
                        : act({ action: 'mute', targetUserId: p.userId })
                    }
                  >
                    {p.forcedMuted ? copy.unmuteAction : copy.muteAction}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </section>
  );
}
