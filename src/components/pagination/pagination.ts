import {
  createScopedQueryKey,
  type QueryScopeInput,
  type ScopedQueryKey,
} from '@/api/query-keys';

/**
 * Pagination constants and types matching the backend REST contract
 * (`apps/api/src/http/pagination/` in `Agustin742/integratec-final-back`).
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE = 10_000;

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface PaginationQueryInput {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: string;
}

export interface NormalizedPaginationQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: string;
}

export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
  readonly rangeStart: number;
  readonly rangeEnd: number;
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  const truncated = Math.trunc(value);
  return Math.max(min, Math.min(max, truncated));
}

/**
 * Normalizes pagination query parameters (`page`, `pageSize`, optional `sort`)
 * to match the backend `PaginationQueryDto` limits.
 */
export function normalizePaginationQuery(
  input: PaginationQueryInput = {},
): NormalizedPaginationQuery {
  const page = clampInteger(input.page, DEFAULT_PAGE, 1, MAX_PAGE);
  const pageSize = clampInteger(
    input.pageSize,
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );
  const trimmedSort = input.sort?.trim();

  if (trimmedSort && trimmedSort.length > 0) {
    return Object.freeze({ page, pageSize, sort: trimmedSort });
  }
  return Object.freeze({ page, pageSize });
}

/**
 * Builds a user-, classroom-, and child-scoped TanStack Query key with normalized
 * pagination parameters (`rules/state-management.md`, `rules/api-contracts.md`).
 */
export function createPaginatedQueryKey<
  TExtra extends Record<string, unknown> = Record<string, never>,
>(
  scope: QueryScopeInput,
  domain: string,
  resource: string | null,
  query: PaginationQueryInput & TExtra = {} as PaginationQueryInput & TExtra,
): ScopedQueryKey<
  NormalizedPaginationQuery & Omit<TExtra, keyof PaginationQueryInput>
> {
  const { page, pageSize, sort, ...rest } = query;
  const normalizedPagination = normalizePaginationQuery({
    page,
    pageSize,
    sort,
  });

  const mergedParams = Object.freeze({
    ...rest,
    ...normalizedPagination,
  }) as NormalizedPaginationQuery & Omit<TExtra, keyof PaginationQueryInput>;

  return createScopedQueryKey(scope, domain, resource, mergedParams);
}

/**
 * Computes derived pagination metadata (`totalPages`, `rangeStart`, `rangeEnd`,
 * `hasPreviousPage`, `hasNextPage`) from `{ page, pageSize, total }`.
 */
export function getPaginationMeta(params: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}): PaginationMeta {
  const safePageSize = Math.max(1, Math.trunc(params.pageSize));
  const safeTotal = Math.max(0, Math.trunc(params.total));
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.max(1, Math.min(Math.trunc(params.page), totalPages));

  const hasPreviousPage = safePage > 1;
  const hasNextPage = safePage < totalPages && safeTotal > 0;
  const rangeStart = safeTotal === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const rangeEnd =
    safeTotal === 0 ? 0 : Math.min(safeTotal, safePage * safePageSize);

  return Object.freeze({
    page: safePage,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    rangeStart,
    rangeEnd,
  });
}
