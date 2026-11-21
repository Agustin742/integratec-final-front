import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { apiErrorMessages } from '@/api/messages';
import {
  ownDailyReviewQueryKey,
  ownStreakAndBadgesQueryKey,
} from '@/api/query-keys';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type {
  AnswerDailyReviewQuestionInput,
  DailyQuestionAnswerResultDto,
} from './daily-review-schema';
import {
  DailyReviewServiceError,
  answerDailyReviewQuestion,
  fetchDailyReview,
} from './daily-review-service';

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
 * Queries the server-decided daily review state for the authenticated user
 * (`HU-BOT-003`). Scoped by `userId` so logout and account switches isolate
 * cached data. The client never decides eligibility.
 */
export function useOwnDailyReview() {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  const query = useQuery({
    queryKey: ownDailyReviewQueryKey(userId ?? 'signed-out'),
    queryFn: ({ signal }) => fetchDailyReview(client, { signal }),
    enabled: userId !== null,
    // The eligibility flag is consulted once per connection: the presentation
    // must not close mid-read because a background refetch answered `not_due`
    // (the server already recorded the delivery).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    data: query.data,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error !== null ? toApiError(query.error) : null,
  };
}

/**
 * Sends the student's daily review answer (`HU-BOT-003`). On success the
 * read-only streak-and-badges cache is invalidated so every streak indicator
 * refetches the server-confirmed value.
 */
export function useAnswerDailyReviewQuestion() {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: AnswerDailyReviewQuestionInput) =>
      answerDailyReviewQuestion(client, input),
    onSuccess: () => {
      if (userId !== null) {
        void queryClient.invalidateQueries({
          queryKey: ownStreakAndBadgesQueryKey(userId),
        });
      }
    },
  });

  return {
    answer: mutation.mutateAsync,
    isPending: mutation.isPending,
    data: (mutation.data as DailyQuestionAnswerResultDto | undefined) ?? null,
    error:
      mutation.error instanceof DailyReviewServiceError ? mutation.error : null,
  };
}
