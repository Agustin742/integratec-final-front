import { useEffect, useRef, useState } from 'react';
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { apiErrorMessages } from '@/api/messages';
import {
  classroomDetailQueryKey,
  createStudentWalletPredicate,
  normalizeStudentWalletQueryParams,
  studentWalletQueryKey,
  type NormalizedStudentWalletQueryParams,
  type StudentWalletQueryParams,
} from '@/api/query-keys';
import {
  getPaginationMeta,
  type PaginationMeta,
} from '@/components/pagination/pagination';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { pointsMessages } from './messages';
import { studentWalletSchema, type StudentWalletDto } from './wallet-schema';

export type StudentWallet = StudentWalletDto;

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

function isRevokedAccessError(error: ApiError): boolean {
  return (
    error.kind === 'forbidden' ||
    error.status === 403 ||
    error.kind === 'not-found' ||
    error.status === 404
  );
}

async function fetchStudentWallet(
  client: TypedApiClient,
  classroomId: string,
  query: NormalizedStudentWalletQueryParams,
  signal?: AbortSignal,
): Promise<StudentWallet> {
  const payload: unknown = await requestApi(() =>
    client.GET('/classrooms/{id}/points', {
      params: { path: { id: classroomId }, query },
      signal,
    }),
  );

  const parsed = studentWalletSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: pointsMessages.error.unexpected,
    });
  }

  return parsed.data;
}

export type StudentWalletState =
  | { readonly status: 'pending' }
  | {
      readonly status: 'error';
      readonly error: ApiError;
      readonly retry: () => void;
      readonly isFetching: boolean;
      readonly isRefetching: boolean;
    }
  | {
      readonly status: 'ready';
      readonly wallet: StudentWallet;
      readonly meta: PaginationMeta;
      /** True when a background refresh failed and the data shown is stale. */
      readonly stale: boolean;
      readonly retry: () => void;
      readonly isFetching: boolean;
      readonly isRefetching: boolean;
    };

const PENDING = Object.freeze({ status: 'pending' as const });

/**
 * Removes cached wallet pages of one user and classroom that no mounted hook
 * observes. Entries with active observers are kept: their hooks hide
 * pre-revocation data through the revocation latch, and removing an active
 * entry would make the next render rebuild a fresh query and refetch
 * forever.
 */
function dropUnobservedWalletEntries(
  queryClient: QueryClient,
  userId: string,
  classroomId: string,
): void {
  const walletCache = queryClient.getQueryCache();
  const isScopeWallet = createStudentWalletPredicate(userId, classroomId);
  for (const entry of walletCache.getAll()) {
    if (!isScopeWallet({ queryKey: entry.queryKey })) continue;
    if (entry.getObserversCount() > 0) continue;
    walletCache.remove(entry);
  }
}

/**
 * The signed-in student's server-computed points wallet and one page of
 * movements, as decided by `GET /classrooms/{id}/points`
 * (`PointsController_getOwnWallet`).
 *
 * - The balance is read-only server data: the client never computes or edits
 *   it (`rules/points-and-shop.md`).
 * - Without a signed-in user or non-blank `classroomId` the query stays disabled
 *   and the state is `pending`; nothing is fetched or filled.
 * - Responses are validated with jitless `studentWalletSchema` so malformed 2xx
 *   payloads surface as an error rather than `undefined puntos`.
 * - `403` (non-student / revoked role) and `404` (out-of-scope classroom)
 *   clear any cached balance/ledger immediately, surface `status: 'error'`,
 *   drop every cached wallet page of that scope from the query cache, and
 *   invalidate `classroomDetailQueryKey` so the workspace reconciles access.
 * - Other failed background refreshes (`5xx`, network) keep the last confirmed
 *   data with `stale: true`, matching the roster precedent.
 */
export function useStudentWallet(
  classroomId: string,
  params: StudentWalletQueryParams = {},
): StudentWalletState {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const queryClient = useQueryClient();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const trimmedClassroomId = classroomId.trim();
  const enabled = userId !== null && trimmedClassroomId !== '';

  // The key and the request share the same normalized page values, so every
  // page and page size combination is one cache entry.
  const normalized = normalizeStudentWalletQueryParams(params);
  const reconciledContextErrorRef = useRef<unknown>(null);
  // Latched when revoked access (403/404) is observed: wallet data fetched
  // before the latch is private data of a context the caller can no longer
  // read, so it must never render again until a newer successful fetch proves
  // the server restored access.
  const [revokedAccess, setRevokedAccess] = useState<{
    at: number;
    error: ApiError;
  } | null>(null);

  const query = useQuery({
    // Without a signed-in user or valid classroomId the query stays disabled;
    // the fallback segments keep the key non-blank without fetching.
    queryKey: studentWalletQueryKey(
      userId ?? 'signed-out',
      trimmedClassroomId !== '' ? trimmedClassroomId : 'missing',
      params,
    ),
    queryFn: ({ signal }) =>
      fetchStudentWallet(client, trimmedClassroomId, normalized, signal),
    enabled,
  });

  const mappedError = query.isError ? toApiError(query.error) : null;
  const isRevokedAccess =
    mappedError !== null && isRevokedAccessError(mappedError);

  useEffect(() => {
    if (!query.isError) {
      reconciledContextErrorRef.current = null;
      return;
    }
    if (
      !enabled ||
      userId === null ||
      !isRevokedAccess ||
      reconciledContextErrorRef.current === query.error
    ) {
      return;
    }
    reconciledContextErrorRef.current = query.error;
    setRevokedAccess({ at: Date.now(), error: toApiError(query.error) });
    // Cached wallet pages of the revoked scope are private data the caller
    // can no longer read: drop the entries nobody observes so no later failed
    // refresh or remount can resurface them as stale data
    // (`rules/points-and-shop.md`, `rules/state-management.md`).
    dropUnobservedWalletEntries(queryClient, userId, trimmedClassroomId);
    void queryClient.invalidateQueries({
      queryKey: classroomDetailQueryKey(userId, trimmedClassroomId),
      exact: true,
    });
  }, [
    enabled,
    isRevokedAccess,
    query.error,
    query.isError,
    queryClient,
    trimmedClassroomId,
    userId,
  ]);

  // When a hook that latched a revocation unmounts, its query entry becomes
  // unobserved pre-revocation cache: drop it so a remount can never render it.
  useEffect(() => {
    if (revokedAccess === null || userId === null) return;
    const scopeUserId = userId;
    const scopeClassroomId = trimmedClassroomId;
    return () => {
      dropUnobservedWalletEntries(queryClient, scopeUserId, scopeClassroomId);
    };
  }, [queryClient, revokedAccess, trimmedClassroomId, userId]);

  if (!enabled) {
    return PENDING;
  }

  // Data older than a revocation latch is pre-revocation cache; only a fetch
  // newer than the latch may render again.
  const cachedDataPredatesRevocation =
    revokedAccess !== null && query.dataUpdatedAt <= revokedAccess.at;

  // Revoked access (403/404) must hide cached balance and private ledger
  // immediately rather than serving stale data.
  if (mappedError !== null && isRevokedAccess) {
    return {
      status: 'error',
      error: mappedError,
      retry: () => void query.refetch(),
      isFetching: query.isFetching,
      isRefetching: query.isRefetching,
    };
  }

  if (query.data !== undefined && !cachedDataPredatesRevocation) {
    return {
      status: 'ready',
      wallet: query.data,
      meta: getPaginationMeta(query.data),
      stale: query.isError,
      retry: () => void query.refetch(),
      isFetching: query.isFetching,
      isRefetching: query.isRefetching,
    };
  }

  if (mappedError !== null) {
    return {
      status: 'error',
      error: mappedError,
      retry: () => void query.refetch(),
      isFetching: query.isFetching,
      isRefetching: query.isRefetching,
    };
  }

  if (query.data !== undefined && revokedAccess !== null) {
    // Cached pre-revocation data without a current error (an observer still
    // holding a removed query): stay unavailable instead of resurfacing it.
    return {
      status: 'error',
      error: revokedAccess.error,
      retry: () => void query.refetch(),
      isFetching: query.isFetching,
      isRefetching: query.isRefetching,
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
