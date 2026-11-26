import {
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { BadgeShowcase } from './badge-showcase';
import { pointsMessages } from './messages';
import { StreakIndicator } from './streak-indicator';
import { useOwnStreakAndBadges } from './use-streak-and-badges';

export function StreakAndBadgesSection() {
  const copy = pointsMessages.streakAndBadges;
  const { data, isPending, isFetching, isError, error, refetch } =
    useOwnStreakAndBadges();

  return (
    <section
      aria-labelledby="profile-streak-badges-heading"
      className="space-y-4 rounded-2xl border border-edge bg-card/70 p-5"
    >
      <div className="space-y-1">
        <h3
          id="profile-streak-badges-heading"
          className="font-display text-lg font-bold text-foreground"
        >
          {copy.sectionTitle}
        </h3>
        <p className="text-xs text-muted-foreground">{copy.sectionSubtitle}</p>
      </div>

      {data === undefined && isError && (
        <ErrorState
          headingLevel="h4"
          title={copy.errorTitle}
          description={copy.errorDescription}
          error={error ?? undefined}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      )}

      {data === undefined && !isError && isPending && (
        <LoadingState label={copy.loading} skeletonLines={3} />
      )}

      {data !== undefined && (
        <div className="space-y-5">
          {isError && (
            <StaleDataNotice
              title={copy.staleTitle}
              description={copy.staleDescription}
              onRetry={() => void refetch()}
              isRetrying={isFetching}
            />
          )}
          <StreakIndicator
            currentStreak={data.streak.currentStreak}
            bestStreak={data.streak.bestStreak}
            lastQualifiedDate={data.streak.lastQualifyingDay}
          />
          <BadgeShowcase badges={data.badges} />
        </div>
      )}
    </section>
  );
}
