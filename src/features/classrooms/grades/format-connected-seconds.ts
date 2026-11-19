import { gradesMessages } from './messages';

/**
 * Formats connected seconds as a signed-text es-AR duration so no value is
 * signaled by color or motion alone (`rules/ui-and-accessibility.md`).
 * Zero renders as "0 min", never as an empty cell.
 */
export function formatConnectedSeconds(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const hourUnit = gradesMessages.format.durationHourUnit;
  const minuteUnit = gradesMessages.format.durationMinuteUnit;
  if (hours > 0) {
    return `${hours} ${hourUnit} ${minutes} ${minuteUnit}`;
  }
  return `${minutes} ${minuteUnit}`;
}
