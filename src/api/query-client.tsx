import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from './errors';

export const MAX_QUERY_RETRIES = 2;

const TRANSIENT_GATEWAY_STATUSES = new Set([502, 503, 504]);

export interface MutationRetryMeta {
  readonly idempotent?: boolean;
}

/**
 * Bounded query retry policy (`rules/error-handling-and-feedback.md`):
 * - Retries at most `MAX_QUERY_RETRIES` (2) times.
 * - Retries only transient `'network'` errors or HTTP `502`/`503`/`504` (`'unexpected'`).
 * - Never retries `400`, `401`, `403`, `404`, `409`, `429`, or `500`.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) {
    return false;
  }
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return true;
    }
    if (
      error.kind === 'unexpected' &&
      error.status !== null &&
      TRANSIENT_GATEWAY_STATUSES.has(error.status)
    ) {
      return true;
    }
    return false;
  }
  return false;
}

/**
 * Non-idempotent writes must never be retried automatically (`rules/error-handling-and-feedback.md`).
 * Only mutations explicitly marked `{ idempotent: true }` in their `meta` (accompanied by
 * a stable `Idempotency-Key` header) may retry on transient errors up to `MAX_QUERY_RETRIES`.
 */
export function shouldRetryMutation(
  failureCount: number,
  error: unknown,
  meta?: MutationRetryMeta,
): boolean {
  if (!meta?.idempotent) {
    return false;
  }
  return shouldRetryQuery(failureCount, error);
}

/**
 * Creates a configured TanStack `QueryClient` with bounded query retries and
 * automatic mutation retries disabled by default.
 */
export function createAppQueryClient(
  config: QueryClientConfig = {},
): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        ...config.defaultOptions?.queries,
      },
      mutations: {
        retry: false,
        ...config.defaultOptions?.mutations,
      },
    },
  });
}

export interface ApiQueryProviderProps {
  readonly client?: QueryClient;
  readonly children: ReactNode;
}

/**
 * Provides a TanStack `QueryClient` to the React component tree.
 */
export function ApiQueryProvider({ client, children }: ApiQueryProviderProps) {
  const [defaultClient] = useState(() => createAppQueryClient());
  const resolvedClient = client ?? defaultClient;
  return (
    <QueryClientProvider client={resolvedClient}>
      {children}
    </QueryClientProvider>
  );
}
