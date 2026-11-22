import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  classroomDesksQueryKey,
  classroomDetailQueryKey,
} from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { classroomMessages } from '../messages';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export type ClassroomDeskDto = components['schemas']['ClassroomDeskDto'];
export type ClassroomDeskMapDto = components['schemas']['ClassroomDeskMapDto'];

const classroomDeskSchema: z.ZodType<ClassroomDeskDto> = z.object({
  id: z.string().min(1),
  deskIndex: z.number().int().min(1),
  membershipId: z.string().min(1).nullable(),
  userId: z.string().min(1).nullable(),
});

export const classroomDeskMapSchema: z.ZodType<ClassroomDeskMapDto> = z.object({
  items: z.array(classroomDeskSchema),
});

export async function fetchClassroomDesks(
  client: TypedApiClient,
  classroomId: string,
  signal?: AbortSignal,
): Promise<ClassroomDeskMapDto> {
  const raw = await requestApi(() =>
    client.GET('/classrooms/{id}/desks', {
      params: { path: { id: classroomId } },
      signal,
    }),
  );

  const parsed = classroomDeskMapSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: classroomMessages.desks.loadError,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export interface ClassroomDesksState {
  readonly status: 'idle' | 'pending' | 'ready' | 'error';
  readonly items: readonly ClassroomDeskDto[];
  readonly myDeskIndex: number | null;
  readonly error: ApiError | null;
  readonly retry: () => void;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError({
    kind: 'unexpected',
    status: null,
    code: null,
    userMessage: classroomMessages.desks.loadError,
    cause: error,
  });
}

const IDLE_STATE: ClassroomDesksState = Object.freeze({
  status: 'idle',
  items: [],
  myDeskIndex: null,
  error: null,
  retry: () => {},
});

/**
 * Reads the server-authoritative desk map (`GET /classrooms/{id}/desks`)
 * under a user- and classroom-scoped query key, deriving `myDeskIndex`
 * strictly from `item.userId === session.user.id`.
 */
export function useClassroomDesks(
  classroomId: string,
  enabled = true,
): ClassroomDesksState {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const queryClient = useQueryClient();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const trimmedClassroomId = classroomId.trim();
  const queryEnabled =
    enabled && userId !== null && trimmedClassroomId.length > 0;

  const query = useQuery({
    queryKey: classroomDesksQueryKey(
      userId ?? 'signed-out',
      trimmedClassroomId || 'unknown',
    ),
    queryFn: ({ signal }) =>
      fetchClassroomDesks(client, trimmedClassroomId, signal),
    enabled: queryEnabled,
  });

  const activeError =
    queryEnabled && query.isError ? toApiError(query.error) : null;

  const reconciledErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (
      !queryEnabled ||
      userId === null ||
      activeError === null ||
      activeError.kind !== 'not-found'
    ) {
      return;
    }
    if (reconciledErrorRef.current === activeError) {
      return;
    }
    reconciledErrorRef.current = activeError;
    void queryClient.invalidateQueries({
      queryKey: classroomDetailQueryKey(userId, trimmedClassroomId),
      exact: true,
    });
  }, [activeError, queryClient, queryEnabled, trimmedClassroomId, userId]);

  if (!queryEnabled || userId === null) {
    return IDLE_STATE;
  }

  if (query.data !== undefined) {
    if (
      activeError !== null &&
      (activeError.kind === 'not-found' || activeError.kind === 'forbidden')
    ) {
      return {
        status: 'error',
        items: [],
        myDeskIndex: null,
        error: activeError,
        retry: () => void query.refetch(),
      };
    }
    const assigned = query.data.items.find((item) => item.userId === userId);
    return {
      status: 'ready',
      items: query.data.items,
      myDeskIndex: assigned ? assigned.deskIndex : null,
      error: activeError,
      retry: () => void query.refetch(),
    };
  }

  if (activeError !== null) {
    return {
      status: 'error',
      items: [],
      myDeskIndex: null,
      error: activeError,
      retry: () => void query.refetch(),
    };
  }

  return {
    status: 'pending',
    items: [],
    myDeskIndex: null,
    error: null,
    retry: () => void query.refetch(),
  };
}
