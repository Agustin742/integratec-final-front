import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import {
  classroomDesksQueryKey,
  classroomDetailQueryKey,
} from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  classroomDeskMapSchema,
  fetchClassroomDesks,
  useClassroomDesks,
} from './classroom-desks-api';

function makeDesksPayload(assignedUserId: string | null = profile.id) {
  return {
    items: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        deskIndex: 1,
        membershipId: assignedUserId
          ? '00000000-0000-4000-8000-000000000201'
          : null,
        userId: assignedUserId,
      },
      {
        id: '00000000-0000-4000-8000-000000000102',
        deskIndex: 2,
        membershipId: '00000000-0000-4000-8000-000000000202',
        userId: '00000000-0000-4000-8000-000000000099',
      },
      {
        id: '00000000-0000-4000-8000-000000000103',
        deskIndex: 3,
        membershipId: null,
        userId: null,
      },
    ],
  };
}

describe('classroomDeskMapSchema and fetchClassroomDesks', () => {
  test('validates contract-faithful desk items and rejects malformed payloads', async () => {
    const valid = classroomDeskMapSchema.safeParse(makeDesksPayload());
    expect(valid.success).toBe(true);

    const invalid = classroomDeskMapSchema.safeParse({
      items: [{ id: 'd1', deskIndex: 0, membershipId: null, userId: null }],
    });
    expect(invalid.success).toBe(false);

    const client = createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async () => Response.json({ items: [{ bad: true }] }),
    });
    await expect(fetchClassroomDesks(client, 'room-1')).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  test('forwards AbortSignal cleanly without swallowing AbortError', async () => {
    const controller = new AbortController();
    const client = createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const request = input as Request;
        return new Promise((_resolve, reject) => {
          request.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      },
    });
    const pending = fetchClassroomDesks(client, 'room-1', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('useClassroomDesks', () => {
  function setup(
    fetchImpl: typeof globalThis.fetch,
    options: { classroomId?: string; enabled?: boolean } = {},
  ) {
    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const session = fakeSession(
      { status: 'authenticated', user: profile },
      createApiClient({
        baseUrl: 'https://api.example.invalid',
        fetch: fetchImpl,
      }),
    );

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ApiQueryProvider, {
        client: queryClient,
        children: createElement(SessionProvider, {
          service: session.service,
          children,
        }),
      });

    const hook = renderHook(
      ({ classroomId, enabled }: { classroomId: string; enabled: boolean }) =>
        useClassroomDesks(classroomId, enabled),
      {
        initialProps: {
          classroomId: options.classroomId ?? 'room-1',
          enabled: options.enabled ?? true,
        },
        wrapper,
      },
    );

    return { ...hook, queryClient, session };
  }

  test('derives myDeskIndex under user- and classroom-scoped query key', async () => {
    const { result, queryClient } = setup(async () =>
      Response.json(makeDesksPayload(profile.id)),
    );

    expect(result.current.status).toBe('pending');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.myDeskIndex).toBe(1);
    expect(result.current.items).toHaveLength(3);
    expect(
      queryClient.getQueryData(classroomDesksQueryKey(profile.id, 'room-1')),
    ).toBeDefined();
  });

  test('stays idle without fetching when disabled or classroomId is blank', async () => {
    const fetchSpy = vi.fn(async () => Response.json(makeDesksPayload()));
    const { result, rerender } = setup(fetchSpy, {
      classroomId: 'room-1',
      enabled: false,
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.myDeskIndex).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    rerender({ classroomId: '   ', enabled: true });
    expect(result.current.status).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('returns null myDeskIndex when caller has no assigned desk', async () => {
    const { result } = setup(async () =>
      Response.json(makeDesksPayload('other-user-id')),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.myDeskIndex).toBeNull();
  });

  test('handles 403 cleanly and reconciles classroomDetailQueryKey once on 404', async () => {
    const forbidden = setup(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Forbidden',
              correlationId: 'c1',
            },
          }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        ),
    );
    await waitFor(() => expect(forbidden.result.current.status).toBe('error'));
    expect(forbidden.result.current.myDeskIndex).toBeNull();
    expect(forbidden.result.current.error?.kind).toBe('forbidden');

    const notFound = setup(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: 'Not found',
              correlationId: 'c2',
            },
          }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        ),
    );
    const invalidateSpy = vi.spyOn(notFound.queryClient, 'invalidateQueries');
    await waitFor(() => expect(notFound.result.current.status).toBe('error'));
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: classroomDetailQueryKey(profile.id, 'room-1'),
      exact: true,
    });
  });

  test('isolates desk assignments when switching accounts', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000101',
            deskIndex: 1,
            membershipId: 'm1',
            userId: profile.id,
          },
          {
            id: '00000000-0000-4000-8000-000000000104',
            deskIndex: 4,
            membershipId: 'm4',
            userId: 'user-2',
          },
        ],
      }),
    );

    const { result, session } = setup(fetchMock);
    await waitFor(() => expect(result.current.myDeskIndex).toBe(1));

    act(() => {
      session.set({
        status: 'authenticated',
        user: { ...profile, id: 'user-2' },
      });
    });

    await waitFor(() => expect(result.current.myDeskIndex).toBe(4));
  });

  test('preserves confirmed desk assignment on transient refresh failure and clears on 403/404', async () => {
    let mode: 'ok' | 'server-error' | 'forbidden' = 'ok';
    const { result } = setup(async () => {
      if (mode === 'server-error') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'INTERNAL',
              message: 'Server error',
              correlationId: 'c-500',
            },
          }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        );
      }
      if (mode === 'forbidden') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Forbidden',
              correlationId: 'c-403',
            },
          }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        );
      }
      return Response.json(makeDesksPayload(profile.id));
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.myDeskIndex).toBe(1);

    mode = 'server-error';
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.status).toBe('ready');
    expect(result.current.myDeskIndex).toBe(1);
    expect(result.current.items).toHaveLength(3);

    mode = 'forbidden';
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.myDeskIndex).toBeNull();
    expect(result.current.items).toEqual([]);
  });

  test('stays pending across transient retry failures until settled', async () => {
    let attempts = 0;
    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { retry: 1, retryDelay: 0 } },
    });
    const session = fakeSession(
      { status: 'authenticated', user: profile },
      createApiClient({
        baseUrl: 'https://api.example.invalid',
        fetch: async () => {
          attempts += 1;
          if (attempts === 1) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'UNAVAILABLE',
                  message: 'Retry',
                  correlationId: 'c-retry',
                },
              }),
              { status: 503, headers: { 'content-type': 'application/json' } },
            );
          }
          return Response.json(makeDesksPayload(profile.id));
        },
      }),
    );

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ApiQueryProvider, {
        client: queryClient,
        children: createElement(SessionProvider, {
          service: session.service,
          children,
        }),
      });

    const { result } = renderHook(() => useClassroomDesks('room-1'), {
      wrapper,
    });
    expect(result.current.status).toBe('pending');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(attempts).toBe(2);
    expect(result.current.myDeskIndex).toBe(1);
  });
});
