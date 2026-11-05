import { useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { render } from '../test/render';
import { ApiError } from './errors';
import { apiErrorMessages } from './messages';
import {
  MAX_QUERY_RETRIES,
  createAppQueryClient,
  shouldRetryMutation,
  shouldRetryQuery,
} from './query-client';
import { createScopedQueryKey, createUserScopePredicate } from './query-keys';

describe('createScopedQueryKey and cache isolation', () => {
  test('always includes normalized userId, classroomId, and linkedChildId in the key', () => {
    const key = createScopedQueryKey(
      {
        userId: '  user-teacher-1  ',
        classroomId: '  classroom-101  ',
        linkedChildId: null,
      },
      'activities',
      'list',
      { page: 1 },
    );

    expect(key).toEqual([
      {
        scope: {
          userId: 'user-teacher-1',
          classroomId: 'classroom-101',
          linkedChildId: null,
        },
        domain: 'activities',
        resource: 'list',
        params: { page: 1 },
      },
    ]);
  });

  test('rejects blank userId, domain, classroomId, or linkedChildId', () => {
    expect(() =>
      createScopedQueryKey({ userId: '   ' }, 'classrooms'),
    ).toThrowError('Query key userId must be a non-empty string.');

    expect(() =>
      createScopedQueryKey({ userId: 'user-1' }, '   '),
    ).toThrowError('Query key domain must be a non-empty string.');

    expect(() =>
      createScopedQueryKey(
        { userId: 'user-1', classroomId: '   ' },
        'classrooms',
      ),
    ).toThrowError('Query key classroomId cannot be a blank string.');

    expect(() =>
      createScopedQueryKey(
        { userId: 'user-1', linkedChildId: '   ' },
        'grades',
      ),
    ).toThrowError('Query key linkedChildId cannot be a blank string.');
  });

  test('changing the scoped userId, classroomId, or linkedChildId never returns another scope cached data', () => {
    const queryClient = createAppQueryClient();

    const userAKey = createScopedQueryKey(
      { userId: 'student-a', classroomId: 'classroom-1' },
      'profile',
      'summary',
    );
    const userBKey = createScopedQueryKey(
      { userId: 'student-b', classroomId: 'classroom-1' },
      'profile',
      'summary',
    );
    const classroom2Key = createScopedQueryKey(
      { userId: 'student-a', classroomId: 'classroom-2' },
      'profile',
      'summary',
    );
    const parentChild1Key = createScopedQueryKey(
      {
        userId: 'parent-1',
        classroomId: 'classroom-1',
        linkedChildId: 'child-1',
      },
      'grades',
      'list',
    );
    const parentChild2Key = createScopedQueryKey(
      {
        userId: 'parent-1',
        classroomId: 'classroom-1',
        linkedChildId: 'child-2',
      },
      'grades',
      'list',
    );

    queryClient.setQueryData(userAKey, { displayName: 'Alumno A', points: 80 });
    queryClient.setQueryData(parentChild1Key, { average: 9 });

    expect(queryClient.getQueryData(userAKey)).toEqual({
      displayName: 'Alumno A',
      points: 80,
    });
    expect(queryClient.getQueryData(userBKey)).toBeUndefined();
    expect(queryClient.getQueryData(classroom2Key)).toBeUndefined();
    expect(queryClient.getQueryData(parentChild1Key)).toEqual({ average: 9 });
    expect(queryClient.getQueryData(parentChild2Key)).toBeUndefined();

    queryClient.removeQueries({
      predicate: createUserScopePredicate('student-a'),
    });

    expect(queryClient.getQueryData(userAKey)).toBeUndefined();
    expect(queryClient.getQueryData(parentChild1Key)).toEqual({ average: 9 });
  });
});

describe('retry policy', () => {
  test('retries transient network and 503 errors up to MAX_QUERY_RETRIES and never retries 4xx or 500', () => {
    const networkError = new ApiError({
      kind: 'network',
      status: null,
      code: null,
      userMessage: apiErrorMessages.network,
    });
    const serviceUnavailableError = new ApiError({
      kind: 'unexpected',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      userMessage: apiErrorMessages.unexpected,
    });
    const badGatewayError = new ApiError({
      kind: 'unexpected',
      status: 502,
      code: null,
      userMessage: apiErrorMessages.unexpected,
    });
    const gatewayTimeoutError = new ApiError({
      kind: 'unexpected',
      status: 504,
      code: null,
      userMessage: apiErrorMessages.unexpected,
    });
    const unauthenticatedError = new ApiError({
      kind: 'unauthenticated',
      status: 401,
      code: 'UNAUTHENTICATED',
      userMessage: apiErrorMessages.unauthenticated,
    });
    const forbiddenError = new ApiError({
      kind: 'forbidden',
      status: 403,
      code: 'FORBIDDEN',
      userMessage: apiErrorMessages.forbidden,
    });
    const notFoundError = new ApiError({
      kind: 'not-found',
      status: 404,
      code: 'NOT_FOUND',
      userMessage: apiErrorMessages.notFound,
    });
    const internalServerError = new ApiError({
      kind: 'unexpected',
      status: 500,
      code: 'INTERNAL_ERROR',
      userMessage: apiErrorMessages.unexpected,
    });

    expect(shouldRetryQuery(0, networkError)).toBe(true);
    expect(shouldRetryQuery(1, networkError)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, networkError)).toBe(false);

    expect(shouldRetryQuery(0, serviceUnavailableError)).toBe(true);
    expect(shouldRetryQuery(0, badGatewayError)).toBe(true);
    expect(shouldRetryQuery(0, gatewayTimeoutError)).toBe(true);
    expect(shouldRetryQuery(0, unauthenticatedError)).toBe(false);
    expect(shouldRetryQuery(0, forbiddenError)).toBe(false);
    expect(shouldRetryQuery(0, notFoundError)).toBe(false);
    expect(shouldRetryQuery(0, internalServerError)).toBe(false);
  });

  test('never retries non-idempotent mutations and bounds explicitly idempotent mutations', () => {
    const networkError = new ApiError({
      kind: 'network',
      status: null,
      code: null,
      userMessage: apiErrorMessages.network,
    });

    expect(shouldRetryMutation(0, networkError)).toBe(false);
    expect(shouldRetryMutation(0, networkError, { idempotent: false })).toBe(
      false,
    );
    expect(shouldRetryMutation(0, networkError, { idempotent: true })).toBe(
      true,
    );
    expect(
      shouldRetryMutation(MAX_QUERY_RETRIES, networkError, {
        idempotent: true,
      }),
    ).toBe(false);
  });

  test('renders a component consuming a scoped query via ApiQueryProvider', async () => {
    function ScopedProbe({ userId }: { readonly userId: string }) {
      const { data } = useQuery({
        queryKey: createScopedQueryKey({ userId }, 'probe', 'greeting'),
        queryFn: async () => `Usuario activo: ${userId}`,
      });
      return <p>{data ?? 'Cargando...'}</p>;
    }

    const queryClient = createAppQueryClient();
    const { rerender } = render(<ScopedProbe userId="user-1" />, {
      queryClient,
    });

    await waitFor(() => {
      expect(screen.getByText('Usuario activo: user-1')).toBeInTheDocument();
    });

    rerender(<ScopedProbe userId="user-2" />);
    await waitFor(() => {
      expect(screen.getByText('Usuario activo: user-2')).toBeInTheDocument();
    });
  });
});
