import { EmptyState } from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { formatInstant } from '@/lib/dates';
import { pointsMessages } from './messages';
import type { BadgeItemDto } from './streak-badge-schema';

export interface BadgeShowcaseProps {
  readonly badges: readonly BadgeItemDto[];
}

function formatUnlockedDate(iso: string): string | null {
  try {
    return formatInstant(iso);
  } catch {
    return null;
  }
}

export function BadgeShowcase({ badges }: BadgeShowcaseProps) {
  const copy = pointsMessages.streakAndBadges.badges;
  const unlockedCount = badges.filter((badge) => badge.unlocked).length;

  return (
    <section aria-label={copy.regionLabel} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          {copy.heading}
        </h4>
        {badges.length > 0 && (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {copy.summaryCount(unlockedCount, badges.length)}
          </span>
        )}
      </div>

      {badges.length === 0 ? (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {badges.map((badge) => {
            const unlockedLabel =
              badge.unlocked && badge.unlockedAt !== null
                ? formatUnlockedDate(badge.unlockedAt)
                : null;

            return (
              <li
                key={badge.id}
                className={`min-w-0 space-y-2 rounded-2xl border p-4 shadow-sm ${
                  badge.unlocked
                    ? 'border-edge bg-card text-card-foreground'
                    : 'border-border/70 bg-muted/40 text-foreground/85'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      className={`size-5 shrink-0 ${
                        badge.unlocked
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}
                      aria-hidden="true"
                    >
                      {badge.unlocked ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3 0-1 6 4-2 4 2-1-6"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7 11V8a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
                        />
                      )}
                    </svg>
                    <p className="font-medium text-foreground wrap-anywhere">
                      {badge.name}
                    </p>
                  </div>

                  <Badge variant={badge.unlocked ? 'default' : 'outline'}>
                    {badge.unlocked ? copy.unlockedLabel : copy.lockedLabel}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground wrap-anywhere">
                  {badge.description}
                </p>

                {unlockedLabel !== null && (
                  <p className="text-xs text-muted-foreground">
                    {copy.unlockedAtPrefix} {unlockedLabel}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
