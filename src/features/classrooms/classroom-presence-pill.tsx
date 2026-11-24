import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { components } from '@/api/schema.generated';
import { ClassroomPresenceBar } from './classroom-presence-bar';
import { classroomMessages as messages } from './messages';
import type { ClassroomPresence } from './use-classroom-presence';

const MAX_AVATARS = 3;

type ClassroomControlsSource = Pick<
  components['schemas']['ClassroomContextResponseDto'],
  'chatMuted' | 'collaborationLocked' | 'gamesDisabled'
>;

export interface ClassroomPresencePillProps {
  readonly presence: ClassroomPresence;
  readonly currentUserId: string;
  readonly classroom: ClassroomControlsSource;
}

function initialOf(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || '?';
}

/**
 * Compact floating presence for the 3D stage (`#128`): up to three stacked
 * member initials plus a "+N" counter. Activating it expands the existing
 * `ClassroomPresenceBar` (same data, status and controls as 2D mode) above the
 * pill; Escape or a second activation collapses it and returns focus to the
 * pill. A rejected connection keeps its full alert visible instead.
 */
export function ClassroomPresencePill({
  presence,
  currentUserId,
  classroom,
}: ClassroomPresencePillProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const pillRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setExpanded(false);
      pillRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  if (presence.isIdle) {
    return null;
  }
  if (presence.status === 'rejected') {
    return (
      <div className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))]">
        <ClassroomPresenceBar
          presence={presence}
          currentUserId={currentUserId}
          classroom={classroom}
        />
      </div>
    );
  }

  const copy = messages.presence.pill;
  const online = presence.participants.filter(
    (participant) => participant.status === 'online',
  );
  const shown = presence.participants.slice(0, MAX_AVATARS);
  const hidden = presence.participants.length - shown.length;

  return (
    <div className="pointer-events-none flex flex-col items-start gap-2">
      {expanded && (
        <div
          id={panelId}
          className="pointer-events-auto max-h-[50dvh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl shadow-panel"
        >
          <ClassroomPresenceBar
            presence={presence}
            currentUserId={currentUserId}
            classroom={classroom}
          />
        </div>
      )}
      <button
        ref={pillRef}
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        aria-label={copy.label(online.length)}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          'motion-press pointer-events-auto flex min-h-11 min-w-11 items-center gap-1 rounded-full border border-edge bg-card/85 py-1 pr-3 pl-1.5 text-card-foreground shadow-panel backdrop-blur-md hover:bg-card focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring',
        )}
      >
        <span aria-hidden="true" className="flex items-center">
          {shown.map((participant, index) => (
            <span
              key={participant.userId}
              data-presence-avatar
              className={cn(
                'flex size-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-bold text-secondary-foreground',
                index > 0 && '-ml-2',
                participant.status !== 'online' && 'opacity-60',
              )}
            >
              {initialOf(participant.displayName)}
            </span>
          ))}
        </span>
        {hidden > 0 && (
          <span
            aria-hidden="true"
            className="px-1 text-xs font-semibold text-foreground"
          >
            {copy.overflow(hidden)}
          </span>
        )}
      </button>
    </div>
  );
}
