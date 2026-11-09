/**
 * Date and time display helpers (`rules/data-and-time.md`, FD10, FD11).
 *
 * Policy:
 * - Default locale is Spanish (Argentina, `es-AR`) per FD10.
 * - Default school time zone is `America/Argentina/Buenos_Aires` per FD11.
 * - Instants must carry an explicit UTC (`Z`/`z`) or numeric offset (`±HH:MM` or `±HHMM`)
 *   so display never guesses a browser-local interpretation.
 * - Deadlines arrive as ISO 8601 UTC instants and are displayed in the school's
 *   IANA time zone with the time zone indicated. Client clocks are never used
 *   as an authority for deadline expiration.
 * - Calendar date-only values (`YYYY-MM-DD`) are formatted in `UTC` so browser
 *   time zone offsets never shift the displayed calendar day.
 */
export const DEFAULT_LOCALE = 'es-AR';
export const DEFAULT_SCHOOL_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const ISO_INSTANT_OFFSET_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)(Z|z|([+-]\d{2}):?(\d{2}))$/;

const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface FormatInstantOptions {
  readonly locale?: string;
  readonly timeZone?: string;
  readonly includeSeconds?: boolean;
}

export interface FormatDeadlineOptions {
  readonly locale?: string;
  readonly timeZone?: string;
}

export interface FormatDateOnlyOptions {
  readonly locale?: string;
  readonly dateStyle?: 'short' | 'medium' | 'long';
}

function parseValidatedInstant(isoInstant: string): Date {
  const trimmed = isoInstant.trim();
  const match = ISO_INSTANT_OFFSET_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid ISO 8601 instant "${isoInstant}": an explicit time zone offset (Z or ±HH:MM) is required.`,
    );
  }
  const normalizedOffset =
    match[2].toUpperCase() === 'Z' ? 'Z' : `${match[3]}:${match[4]}`;
  const normalizedIso = `${match[1]}${normalizedOffset}`;

  const parsed = new Date(normalizedIso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Invalid ISO 8601 instant "${isoInstant}": calendar timestamp is out of range.`,
    );
  }
  return parsed;
}

/**
 * Formats an unambiguous timezone-aware ISO 8601 instant in an explicit locale
 * and IANA time zone without mutating the represented instant.
 */
export function formatInstant(
  isoInstant: string,
  options: FormatInstantOptions = {},
): string {
  const date = parseValidatedInstant(isoInstant);
  const locale = options.locale ?? DEFAULT_LOCALE;
  const timeZone = options.timeZone ?? DEFAULT_SCHOOL_TIME_ZONE;

  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: options.includeSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  });

  return formatter.format(date);
}

/**
 * Formats a deadline stored in UTC into the school's persisted IANA time zone
 * (default `America/Argentina/Buenos_Aires`) and indicates the time zone (FD11).
 *
 * Never uses the browser clock to decide whether a deadline has passed.
 */
export function formatDeadline(
  isoUtcInstant: string,
  options: FormatDeadlineOptions = {},
): string {
  const timeZone = options.timeZone ?? DEFAULT_SCHOOL_TIME_ZONE;
  const formattedInstant = formatInstant(isoUtcInstant, {
    locale: options.locale,
    timeZone,
  });
  return `${formattedInstant} (${timeZone})`;
}

/**
 * Formats a calendar date-only string (`YYYY-MM-DD`) in `UTC` so incidental
 * browser time zone conversions never shift the displayed day (`rules/data-and-time.md`).
 */
export function formatDateOnly(
  isoDate: string,
  options: FormatDateOnlyOptions = {},
): string {
  const trimmed = isoDate.trim();
  const match = ISO_DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid date-only value "${isoDate}": expected YYYY-MM-DD format.`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    Number.isNaN(utcDate.getTime()) ||
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    throw new Error(
      `Invalid date-only value "${isoDate}": calendar date does not exist.`,
    );
  }

  const locale = options.locale ?? DEFAULT_LOCALE;
  if (options.dateStyle && options.dateStyle !== 'short') {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      dateStyle: options.dateStyle,
    }).format(utcDate);
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(utcDate);
}
