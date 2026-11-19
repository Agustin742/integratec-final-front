import { pointsMessages } from './messages';

export interface StreakIndicatorProps {
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly lastQualifiedDate: string | null;
}

export function StreakIndicator({
  currentStreak,
  bestStreak,
  lastQualifiedDate,
}: StreakIndicatorProps) {
  const copy = pointsMessages.streakAndBadges.streak;

  return (
    <section
      aria-label={copy.regionLabel}
      className="space-y-3 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-tray/50 p-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="size-5 shrink-0 text-primary"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3c.5 3.5 3.5 5 3.5 8.5a3.5 3.5 0 1 1-7 0c0-1.6.7-3.1 1.8-4.2C10.9 6.6 11.7 5 12 3Z"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {copy.currentLabel}
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {copy.daysCount(currentStreak)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-tray/50 p-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="size-5 shrink-0 text-primary"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {copy.bestLabel}
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {copy.daysCount(bestStreak)}
            </p>
          </div>
        </div>
      </div>

      {lastQualifiedDate !== null && (
        <p className="text-xs text-muted-foreground">
          {copy.lastQualifiedLabel(lastQualifiedDate)}
        </p>
      )}

      {currentStreak === 0 && (
        <p className="text-xs text-muted-foreground">{copy.zeroHint}</p>
      )}
    </section>
  );
}
