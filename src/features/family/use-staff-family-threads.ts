import { useCallback, useContext } from 'react';
import {
  QueryClient,
  QueryClientContext,
  useQuery,
} from '@tanstack/react-query';
import { staffFamilyThreadsQueryKey } from '@/api/query-keys';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type { StaffFamilyThreadDto } from './family-schema';
import { listStaffFamilyThreads } from './family-service';

export const STAFF_FAMILY_THREADS_POLL_INTERVAL_MS = 30_000;

const EMPTY_THREADS: readonly StaffFamilyThreadDto[] = [];
// Inactive fallback client used only when no `QueryClientProvider` is mounted
// (with `enabled: false`, so no queries or caches are ever populated).
const FALLBACK_QUERY_CLIENT = new QueryClient();

export interface UseStaffFamilyThreadsResult {
  readonly isAuthenticated: boolean;
  readonly threads: readonly StaffFamilyThreadDto[];
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

/**
 * Staff-facing family messaging threads (`GET /me/family-threads`): active
 * parent-child links across non-adult-mode staff classrooms, ordered by most
 * recent message first. Scoped by `userId`, disabled while signed out or when
 * no `QueryClient` is mounted, and refreshed on window focus so teachers see
 * new parent messages promptly.
 */
export function useStaffFamilyThreads(): UseStaffFamilyThreadsResult {
  const queryClient = useContext(QueryClientContext);
  const { client } = useSessionService();
  const session = useSessionSnapshot();
  const userId = session.status === 'authenticated' ? session.user.id : null;
  const enabled = queryClient !== null && userId !== null;

  const query = useQuery(
    {
      queryKey: staffFamilyThreadsQueryKey(userId ?? 'signed-out'),
      queryFn: ({ signal }) => listStaffFamilyThreads(client, { signal }),
      enabled,
      refetchInterval: STAFF_FAMILY_THREADS_POLL_INTERVAL_MS,
      refetchOnWindowFocus: true,
      retry: false,
    },
    queryClient ?? FALLBACK_QUERY_CLIENT,
  );

  const { refetch } = query;
  const refetchThreads = useCallback(() => {
    if (!enabled) {
      return;
    }
    void refetch();
  }, [enabled, refetch]);

  return {
    isAuthenticated: userId !== null,
    threads: enabled ? (query.data?.items ?? EMPTY_THREADS) : EMPTY_THREADS,
    isPending: enabled && query.isPending,
    isError: enabled && query.isError,
    refetch: refetchThreads,
  };
}
