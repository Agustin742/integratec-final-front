import {
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { pointsMessages } from './messages';
import { useOwnStreakAndBadges } from './use-streak-and-badges';

const copy = pointsMessages.streakAndBadges;

/**
 * One-line daily streak (`HU-GAM-002`). Medals are intentionally not shown
 * here; `StreakAndBadgesSection` keeps the full view.
 */
export function StreakSummary() {
  const { data, isPending, isFetching, isError, error, refetch } =
    useOwnStreakAndBadges();

  if (data === undefined) {
    if (isError) {
      return (
        <ErrorState
          headingLevel="h4"
          title={copy.streakErrorTitle}
          description={copy.errorDescription}
          error={error ?? undefined}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      );
    }
    return isPending ? (
      <LoadingState label={copy.streakLoading} skeletonLines={1} />
    ) : null;
  }

  const { streak } = copy;
  return (
    <div className="space-y-1">
      {isError && (
        <StaleDataNotice
          title={copy.streakStaleTitle}
          description={copy.staleDescription}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
        <span>
          {streak.currentLabel}:{' '}
          <strong className="text-foreground">
            {streak.daysCount(data.currentStreak)}
          </strong>
        </span>
        <span>
          {streak.bestLabel}:{' '}
          <strong className="text-foreground">
            {streak.daysCount(data.bestStreak)}
          </strong>
        </span>
        {data.lastQualifiedDate !== null && (
          <span>{streak.lastQualifiedLabel(data.lastQualifiedDate)}</span>
        )}
      </p>
      {data.currentStreak === 0 && <p>{streak.zeroHint}</p>}
    </div>
  );
}
