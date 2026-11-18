import { DEFAULT_SCHOOL_TIME_ZONE, formatDeadline } from '@/lib/dates';

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
