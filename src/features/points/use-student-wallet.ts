import { useQuery, type QueryClient } from '@tanstack/react-query';
import { requestApi } from '@/api/client';
import { ApiError } from '@/api/errors';
import { apiErrorMessages } from '@/api/messages';
import {
  createStudentWalletPredicate,
  normalizeStudentWalletQueryParams,
  studentWalletQueryKey,
  type StudentWalletQueryParams,
} from '@/api/query-keys';
import {
  getPaginationMeta,
  type PaginationMeta,
} from '@/components/pagination/pagination';
import type { components } from '@/api/schema.generated';
import { useSessionService, useSessionSnapshot } from '@/session/provider';

export type StudentWallet = components['schemas']['StudentWalletDto'];

/**
 * `requestApi` maps every failure to an `ApiError` except an abort, which it
 * rethrows untouched. Anything else that reaches the query is wrapped so
 * callers can rely on `status: 'error'` always carrying an `ApiError`.
 */
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

export type StudentWalletState =
  | { readonly status: 'pending' }
  | {
      readonly status: 'error';
      readonly error: ApiError;
      readonly retry: () => void;
    }
  | {
      readonly status: 'ready';
      readonly wallet: StudentWallet;
      readonly meta: PaginationMeta;
      /** True when a background refresh failed and the data shown is stale. */
      readonly stale: boolean;
      readonly retry: () => void;
    };

const PENDING = Object.freeze({ status: 'pending' as const });

/**
 * The signed-in student's server-computed points wallet and one page of
 * movements, as decided by `GET /classrooms/{id}/points`
 * (`PointsController_getOwnWallet`).
 *
 * - The balance is read-only server data: the client never computes or edits
 *   it (`rules/points-and-shop.md`).
 * - Without a signed-in user the query stays disabled and the state is
 *   `pending`; nothing is fetched or filled.
 * - A failed first load surfaces `status: 'error'` with the mapped `ApiError`
 *   (`403` for a non-student, `404` for an out-of-scope classroom), never a
 *   zero balance. A failed background refresh keeps the confirmed data with
 *   `stale: true`, the roster precedent.
 */
export function useStudentWallet(
  classroomId: string,
  params: StudentWalletQueryParams = {},
): StudentWalletState {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  // The key and the request share the same normalized page values, so every
  // page and page size combination is one cache entry.
  const normalized = normalizeStudentWalletQueryParams(params);

  const query = useQuery({
    // Without a signed-in user the query stays disabled; the key only needs
    // to be valid and is never fetched or filled.
    queryKey: studentWalletQueryKey(
      userId ?? 'signed-out',
      classroomId,
      params,
    ),
    queryFn: ({ signal }) =>
      requestApi(() =>
        client.GET('/classrooms/{id}/points', {
          params: { path: { id: classroomId }, query: normalized },
          signal,
        }),
      ),
    enabled: userId !== null,
  });

  if (query.data !== undefined) {
    return {
      status: 'ready',
      wallet: query.data,
      meta: getPaginationMeta(query.data),
      stale: query.isError,
      retry: () => void query.refetch(),
    };
  }
  if (query.isError) {
    return {
      status: 'error',
      error: toApiError(query.error),
      retry: () => void query.refetch(),
    };
  }
  return PENDING;
}

/**
 * Refreshes every cached wallet of one student in one classroom through query
 * invalidation. Grading and purchase features call this after their mutations
 * so the balance shown everywhere reflects the server again (`S2.3`).
 */
export function invalidateStudentWallet(
  queryClient: QueryClient,
  scope: { readonly userId: string; readonly classroomId: string },
): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: createStudentWalletPredicate(scope.userId, scope.classroomId),
  });
}
