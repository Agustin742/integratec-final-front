import { useQuery } from '@tanstack/react-query';
import { requestApi } from '@/api/client';
import { ApiError } from '@/api/errors';
import { apiErrorMessages } from '@/api/messages';
import { classroomDetailQueryKey } from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import { useSessionService, useSessionSnapshot } from '@/session/provider';

type ClassroomDetail = components['schemas']['ClassroomContextResponseDto'];

/** Role the server resolved for the caller in one classroom. */
export type ClassroomRole = ClassroomDetail['myRole'];

/**
 * A capability the server can grant. Derived from the generated contract, so a
 * capability the backend adds or removes shows up here as a type error instead
 * of a silent mismatch. The client never lists capabilities by hand.
 */
export type Capability = ClassroomDetail['capabilities'][number];

export type ClassroomCapabilities =
  | { readonly status: 'pending' }
  | { readonly status: 'error'; readonly error: ApiError }
  | {
      readonly status: 'ready';
      readonly myRole: ClassroomRole;
      readonly capabilities: readonly Capability[];
      /** True only when the server granted `capability` in this classroom. */
      readonly can: (capability: Capability) => boolean;
    };

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

export type ClassroomContext =
  | { readonly status: 'pending' }
  | {
      readonly status: 'error';
      readonly error: ApiError;
      readonly retry: () => void;
    }
  | {
      readonly status: 'ready';
      readonly classroom: ClassroomDetail;
      readonly userId: string;
    };

const PENDING = Object.freeze({ status: 'pending' as const });

/**
 * What the current user may do in one classroom, as decided by the server
 * (`GET /classrooms/{id}`).
 *
 * - Nothing is persisted: the answer lives only in the Query cache, keyed by
 *   user and classroom, and the session cleanup clears that cache on logout.
 * - No role name is interpreted here. `can()` only looks at the capability
 *   list the server returned for this classroom (`rules/classrooms-and-roles.md`).
 * - A failed refetch turns `ready` into `error`: stale capabilities are never
 *   kept once the server stops confirming them.
 * - A 404 means the classroom is not visible to the user and a 403 means the
 *   role is insufficient; both arrive as `ApiError` in `error`. Callers decide
 *   how to present them (see `RequireCapability`).
 */
export interface UseClassroomContextOptions {
  readonly enabled?: boolean;
}

export function useClassroomContext(
  classroomId: string,
  options?: UseClassroomContextOptions,
): ClassroomContext {
  const enabled = options?.enabled ?? true;
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  const query = useQuery({
    // Without a signed-in user or while explicitly disabled, the query stays
    // idle; the key only needs to be valid and is never fetched or filled.
    queryKey: classroomDetailQueryKey(userId ?? 'signed-out', classroomId),
    queryFn: ({ signal }) =>
      requestApi(() =>
        client.GET('/classrooms/{id}', {
          params: { path: { id: classroomId } },
          signal,
        }),
      ),
    enabled: userId !== null && enabled,
  });

  if (userId === null || !enabled) return PENDING;
  // Even a retryable failed refresh stops exposing private confirmed content.
  if (query.isError || query.failureCount > 0) {
    return {
      status: 'error',
      error: toApiError(query.error ?? query.failureReason),
      retry: () => void query.refetch(),
    };
  }
  if (query.data === undefined) return PENDING;
  return { status: 'ready', classroom: query.data, userId };
}

/** Public capability-only view of the same authoritative context query. */
export function useClassroomCapabilities(
  classroomId: string,
): ClassroomCapabilities {
  const context = useClassroomContext(classroomId);
  if (context.status === 'pending') return PENDING;
  if (context.status === 'error') {
    return { status: 'error', error: context.error };
  }
  const { myRole, capabilities } = context.classroom;
  const granted = new Set<Capability>(capabilities);
  return {
    status: 'ready',
    myRole,
    capabilities,
    can: (capability) => granted.has(capability),
  };
}
