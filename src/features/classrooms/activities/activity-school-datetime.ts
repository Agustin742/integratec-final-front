import { DEFAULT_SCHOOL_TIME_ZONE } from '@/lib/dates';

/**
 * datetime-local <-> ISO 8601 UTC conversions pinned to the school time zone
 * (`rules/data-and-time.md`, FD11).
 *
 * datetime-local values (`YYYY-MM-DDTHH:mm`, optionally seconds) are wall-clock
 * text with no zone of their own. Teachers enter them in the school's IANA time
 * zone (the activity's server-reported `timeZone`, or
 * `DEFAULT_SCHOOL_TIME_ZONE` when none is known yet), never the browser zone,
 * and submit converts them into unambiguous UTC instants with an explicit `Z`
 * offset. Display converts server UTC instants back into school-zone
 * datetime-local strings, so the value shown in the input is exactly the value
 * a re-submit would send.
 *
 * Seconds are truncated to whole minutes on display (datetime-local inputs are
 * minute-precision), which keeps the shown value identical to the saved one
 * instead of hiding a seconds shift the teacher never saw.
 */

const DATETIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export interface SchoolTimeZoneOptions {
  readonly timeZone?: string;
}

/**
 * Resolves a valid IANA school time zone, safely falling back to
 * `DEFAULT_SCHOOL_TIME_ZONE` whenever the input is empty or invalid so
 * `Intl.DateTimeFormat` never throws `RangeError`.
 */
export function resolveSchoolTimeZone(timeZone?: string): string {
  const candidate = timeZone?.trim();
  if (!candidate) {
    return DEFAULT_SCHOOL_TIME_ZONE;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_SCHOOL_TIME_ZONE;
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Offset (ms) that `timeZone` is ahead of UTC at the given instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour') % 24,
    value('minute'),
    value('second'),
  );
  return asUtc - instant.getTime();
}

/**
 * Converts a school-zone datetime-local string into an ISO 8601 UTC instant
 * (`...Z`). Throws for malformed strings, impossible calendar dates (e.g.,
 * `2026-02-30`), and wall-clock times that do not exist in the zone (DST gap),
 * because silently shifting a nonexistent local time would produce a misleading
 * deadline.
 */
export function datetimeLocalToInstantUtc(
  datetimeLocal: string,
  options: SchoolTimeZoneOptions = {},
): string {
  const timeZone = resolveSchoolTimeZone(options.timeZone);
  const match = DATETIME_LOCAL_PATTERN.exec(datetimeLocal.trim());
  if (!match) {
    throw new Error(
      `Invalid datetime-local value "${datetimeLocal}": expected YYYY-MM-DDTHH:mm.`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);

  if (second !== 0 && !Number.isInteger(second)) {
    throw new Error(
      `Invalid datetime-local value "${datetimeLocal}": seconds must be whole.`,
    );
  }

  // Reject impossible calendar dates or times (such as 2026-02-30 or 25:00)
  // before applying time-zone offsets.
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const calendarCheck = new Date(wallAsUtc);
  if (
    Number.isNaN(calendarCheck.getTime()) ||
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() + 1 !== month ||
    calendarCheck.getUTCDate() !== day ||
    calendarCheck.getUTCHours() !== hour ||
    calendarCheck.getUTCMinutes() !== minute ||
    calendarCheck.getUTCSeconds() !== second
  ) {
    throw new Error(
      `Invalid datetime-local value "${datetimeLocal}": calendar date or time is out of range.`,
    );
  }

  // Treat the wall clock as UTC first, then remove the zone's real offset.
  // The second pass corrects for DST transitions around the target instant.
  const firstOffset = zoneOffsetMs(calendarCheck, timeZone);
  let utcMs = wallAsUtc - firstOffset;
  const secondOffset = zoneOffsetMs(new Date(utcMs), timeZone);
  if (secondOffset !== firstOffset) {
    utcMs = wallAsUtc - secondOffset;
  }

  const instant = new Date(utcMs);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(
      `Invalid datetime-local value "${datetimeLocal}": calendar date is out of range.`,
    );
  }

  // Round-trip check (minute precision) rejects DST-gap wall times: converting
  // the resulting instant back must reproduce the entered wall clock.
  const minuteWall = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
  if (
    instantToDatetimeLocal(instant.toISOString(), { timeZone }) !== minuteWall
  ) {
    throw new Error(
      `Invalid datetime-local value "${datetimeLocal}": that time does not exist in ${timeZone} (daylight-saving gap).`,
    );
  }

  return instant.toISOString();
}

/**
 * Converts an ISO 8601 UTC instant into a school-zone datetime-local string
 * (minute precision). The returned string is exactly what a datetime-local
 * input displays and what a re-submit would convert back.
 */
export function instantToDatetimeLocal(
  isoInstant: string,
  options: SchoolTimeZoneOptions = {},
): string {
  const timeZone = resolveSchoolTimeZone(options.timeZone);
  const instant = new Date(isoInstant);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid ISO 8601 instant "${isoInstant}".`);
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = formatter.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';

  const hour = Number(value('hour')) % 24;
  return `${value('year')}-${pad(Number(value('month')))}-${pad(
    Number(value('day')),
  )}T${pad(hour)}:${pad(Number(value('minute')))}`;
}

/**
 * Returns `true` when `datetimeLocal` is a valid school-zone wall-clock value
 * that converts into a real instant (rejects impossible dates and DST gaps).
 */
export function isValidSchoolDatetimeLocal(
  datetimeLocal: string,
  options: SchoolTimeZoneOptions = {},
): boolean {
  try {
    datetimeLocalToInstantUtc(datetimeLocal, options);
    return true;
  } catch {
    return false;
  }
}
