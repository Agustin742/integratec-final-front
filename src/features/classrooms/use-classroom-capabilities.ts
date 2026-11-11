import { useQuery } from '@tanstack/react-query';
import { requestApi } from '@/api/client';
import type { ApiError } from '@/api/errors';
import { classroomDetailQueryKey } from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import { useSessionService, useSessionSnapshot } from '@/session/provider';

type ClassroomDetail = components['schemas']['ClassroomDetailResponseDto'];

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

const PENDING: ClassroomCapabilities = Object.freeze({ status: 'pending' });

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
export function useClassroomCapabilities(
  classroomId: string,
): ClassroomCapabilities {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  const query = useQuery({
    // Without a signed-in user the query stays disabled; the key only needs
    // to be valid and is never fetched or filled.
    queryKey: classroomDetailQueryKey(userId ?? 'signed-out', classroomId),
    queryFn: () =>
      requestApi(() =>
        client.GET('/classrooms/{id}', {
          params: { path: { id: classroomId } },
        }),
      ),
    enabled: userId !== null,
  });

  if (query.isError) {
    return { status: 'error', error: query.error as ApiError };
  }
  if (query.data === undefined) {
    return PENDING;
  }
  const { myRole, capabilities } = query.data;
  const granted = new Set<Capability>(capabilities);
  return {
    status: 'ready',
    myRole,
    capabilities,
    can: (capability) => granted.has(capability),
  };
}
