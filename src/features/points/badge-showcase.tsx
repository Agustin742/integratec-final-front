import { EmptyState } from '@/components/feedback/states';
import { formatInstant } from '@/lib/dates';
import { pointsMessages } from './messages';
import type { BadgeItemDto } from './streak-badge-schema';

export interface BadgeShowcaseProps {
  readonly badges: readonly BadgeItemDto[];
}

function formatAwardedDate(iso: string): string | null {
  try {
    return formatInstant(iso);
  } catch {
    return null;
  }
}

export function BadgeShowcase({ badges }: BadgeShowcaseProps) {
  const copy = pointsMessages.streakAndBadges.badges;

  return (
    <section aria-label={copy.regionLabel} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          {copy.heading}
        </h4>
        {badges.length > 0 && (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {copy.summaryCount(badges.length)}
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
            const awardedLabel = formatAwardedDate(badge.awardedAt);

            return (
              <li
                key={badge.id}
                className="min-w-0 space-y-2 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
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
                      d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3 0-1 6 4-2 4 2-1-6"
                    />
                  </svg>
                  <p className="font-medium text-foreground wrap-anywhere">
                    {badge.name}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground wrap-anywhere">
                  {badge.description}
                </p>

                {awardedLabel !== null && (
                  <p className="text-xs text-muted-foreground">
                    {copy.awardedAtPrefix} {awardedLabel}
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
