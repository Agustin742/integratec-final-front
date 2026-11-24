import {
  DEFAULT_LOCALE,
  DEFAULT_SCHOOL_TIME_ZONE,
  formatDeadline,
} from '@/lib/dates';

/**
 * Formats an activity ISO instant in the server-provided school IANA time zone,
 * falling back to the default school time zone when an unknown zone arrives.
 */
export function formatActivityDeadline(iso: string, timeZone: string): string {
  const safeZone = timeZone.trim() || DEFAULT_SCHOOL_TIME_ZONE;
  try {
    return formatDeadline(iso, { timeZone: safeZone });
  } catch {
    try {
      return formatDeadline(iso, { timeZone: DEFAULT_SCHOOL_TIME_ZONE });
    } catch {
      return `${iso} (${safeZone})`;
    }
  }
}

const relativeFormatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, {
  numeric: 'auto',
});

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Human relative phrase for a deadline ("dentro de 3 días", "hace 4 horas").
 * Presentation only: the client clock never decides whether work is still open.
 */
export function formatActivityRelativeDue(
  iso: string,
  now: number = Date.now(),
): string {
  const target = Date.parse(iso);
  if (Number.isNaN(target)) {
    return '';
  }
  const diff = target - now;
  const abs = Math.abs(diff);
  if (abs < HOUR_MS) {
    return relativeFormatter.format(Math.round(diff / MINUTE_MS), 'minute');
  }
  if (abs < DAY_MS) {
    return relativeFormatter.format(Math.round(diff / HOUR_MS), 'hour');
  }
  return relativeFormatter.format(Math.round(diff / DAY_MS), 'day');
}
