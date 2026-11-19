import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { apiErrorMessages } from '@/api/messages';
import { ownStreakAndBadgesQueryKey } from '@/api/query-keys';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { fetchOwnStreakAndBadges } from './streak-badge-service';

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError({
    kind: 'unexpected',
    status: null,
    code: null,
    userMessage: apiErrorMessages.unexpected,
    cause: error,
  });
}

/**
 * Queries the authenticated user's server-computed daily study streak and
 * badges (`HU-GAM-002`). Scoped by `userId` so logout and account switches
 * isolate cached data.
 */
export function useOwnStreakAndBadges() {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  const query = useQuery({
    queryKey: ownStreakAndBadgesQueryKey(userId ?? 'signed-out'),
    queryFn: ({ signal }) => fetchOwnStreakAndBadges(client, { signal }),
    enabled: userId !== null,
  });

  return {
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error !== null ? toApiError(query.error) : null,
    refetch: () => query.refetch(),
  };
}
