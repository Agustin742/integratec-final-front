import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { ownAvatarStylesQueryKey } from '@/api/query-keys';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { type StyleAvailability } from './avatar-options';
import { fetchAvatarStyles } from './profile-service';

export type AvatarStylesStatus = 'loading' | 'ready' | 'error';

export interface AvatarStylesState {
  readonly status: AvatarStylesStatus;
  /** Server availability, or `null` until it is known (loading or failed). */
  readonly availability: StyleAvailability | null;
  /** Marks the availability stale, e.g. after the server rejected a style. */
  readonly refresh: () => void;
}

/**
 * Which hair and top styles the signed-in user can pick
 * (`GET /users/me/avatar/styles`). Ownership is global to the user and can
 * change in another tab (a shop purchase), so it is re-read on focus. While
 * it is unknown, callers treat every paid style as locked.
 */
export function useAvatarStyles(): AvatarStylesState {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const queryClient = useQueryClient();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const queryKey = ownAvatarStylesQueryKey(userId ?? 'signed-out');

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAvatarStyles(client, { signal }),
    enabled: userId !== null,
    staleTime: 0,
  });

  const availability = useMemo<StyleAvailability | null>(() => {
    if (query.data === undefined) return null;
    return new Map(
      query.data.items.map((item) => [
        `${item.styleType}:${item.styleId}`,
        item.owned,
      ]),
    );
  }, [query.data]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey, exact: true });
    // The key is rebuilt from `userId` on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, userId]);

  let status: AvatarStylesStatus = 'loading';
  if (availability !== null) status = 'ready';
  else if (query.isError) status = 'error';

  return { status, availability, refresh };
}
