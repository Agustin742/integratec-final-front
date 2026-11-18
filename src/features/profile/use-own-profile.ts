import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ownProfileQueryKey } from '@/api/query-keys';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { fetchOwnProfile } from './profile-service';
import type { OwnProfileDto } from './profile-schema';

/**
 * The signed-in user's confirmed profile (`GET /users/me`).
 *
 * - The cache entry is scoped by user id, so another account never reads it
 *   and the session cleanup evicts it on logout.
 * - `commit` is the only way a successful write reaches the cache; a draft or
 *   a rejected attempt never does (`rules/state-management.md`).
 * - A confirmed change is also handed to the session so the shell header
 *   shows the new name without a reload.
 */
export function useOwnProfile() {
  const { client, controller } = useSessionService();
  const snapshot = useSessionSnapshot();
  const queryClient = useQueryClient();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const queryKey = ownProfileQueryKey(userId ?? 'signed-out');

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchOwnProfile(client, { signal }),
    enabled: userId !== null,
    // Backend data wins: never reuse a saved profile without checking it.
    staleTime: 0,
    // A refetch while the user is editing must not move the ground under them.
    refetchOnWindowFocus: false,
  });

  const commit = useCallback(
    (patch: Partial<Pick<OwnProfileDto, 'displayName' | 'avatar'>>) => {
      if (userId === null) return;
      const current = queryClient.getQueryData<OwnProfileDto>(queryKey);
      if (current === undefined) return;
      const next: OwnProfileDto = { ...current, ...patch };
      queryClient.setQueryData(queryKey, next);
      controller.applyConfirmedProfile(next);
    },
    // The key is rebuilt from `userId` on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controller, queryClient, userId],
  );

  /** Reads the authoritative profile again, e.g. after an uncertain write. */
  const reconcile = useCallback(async (): Promise<OwnProfileDto | null> => {
    const result = await query.refetch();
    if (result.isError || result.data === undefined) {
      return null;
    }
    return result.data;
  }, [query]);

  return { query, userId, commit, reconcile };
}
