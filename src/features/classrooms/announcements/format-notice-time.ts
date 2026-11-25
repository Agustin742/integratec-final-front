import { DEFAULT_LOCALE, DEFAULT_SCHOOL_TIME_ZONE } from '@/lib/dates';
import { announcementMessages } from './messages';

const relativeFormatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, {
  numeric: 'auto',
});

const dateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  timeZone: DEFAULT_SCHOOL_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_WINDOW_DAYS = 7;

/**
 * Short, human age of a notice ("hace 3 horas", "ayer"). After a week it falls
 * back to a plain date. Presentation only; the absolute instant stays available
 * through `formatInstant` next to it.
 */
export function formatNoticeAge(iso: string, now: number = Date.now()): string {
  const published = Date.parse(iso);
  if (Number.isNaN(published)) {
    return '';
  }
  const age = now - published;
  if (age < MINUTE_MS) {
    return announcementMessages.list.justNow;
  }
  if (age < HOUR_MS) {
    return relativeFormatter.format(-Math.round(age / MINUTE_MS), 'minute');
  }
  if (age < DAY_MS) {
    return relativeFormatter.format(-Math.round(age / HOUR_MS), 'hour');
  }
  if (age < RELATIVE_WINDOW_DAYS * DAY_MS) {
    return relativeFormatter.format(-Math.round(age / DAY_MS), 'day');
  }
  return dateFormatter.format(published);
}
