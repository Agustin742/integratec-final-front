export interface QueryScopeInput {
  readonly userId: string;
  readonly classroomId?: string | null;
  readonly linkedChildId?: string | null;
}

export interface NormalizedQueryScope {
  readonly userId: string;
  readonly classroomId: string | null;
  readonly linkedChildId: string | null;
}

export interface ScopedQueryKeySegment<TParams = undefined> {
  readonly scope: NormalizedQueryScope;
  readonly domain: string;
  readonly resource: string | null;
  readonly params: TParams;
}

export type ScopedQueryKey<TParams = undefined> = readonly [
  ScopedQueryKeySegment<TParams>,
];

const normalizeRequiredText = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(`Query key ${label} must be a non-empty string.`);
  }
  return trimmed;
};

const normalizeOptionalId = (
  value: string | null | undefined,
  label: string,
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(`Query key ${label} cannot be a blank string.`);
  }
  return trimmed;
};

/**
 * Normalizes and validates a `QueryScopeInput` (`userId`, `classroomId`, `linkedChildId`)
 * so every query key is explicitly scoped to the active user and resource context
 * (`rules/state-management.md`).
 */
export function normalizeQueryScope(
  scope: QueryScopeInput,
): NormalizedQueryScope {
  return Object.freeze({
    userId: normalizeRequiredText(scope.userId, 'userId'),
    classroomId: normalizeOptionalId(scope.classroomId, 'classroomId'),
    linkedChildId: normalizeOptionalId(scope.linkedChildId, 'linkedChildId'),
  });
}

/**
 * Builds a deterministic, user- and resource-scoped TanStack Query key.
 * Changing `userId`, `classroomId`, or `linkedChildId` produces an isolated cache entry.
 */
export function createScopedQueryKey<TParams = undefined>(
  scope: QueryScopeInput,
  domain: string,
  resource: string | null = null,
  params?: TParams,
): ScopedQueryKey<TParams> {
  const normalizedScope = normalizeQueryScope(scope);
  const normalizedDomain = normalizeRequiredText(domain, 'domain');
  const normalizedResource = normalizeOptionalId(resource, 'resource');

  return Object.freeze([
    Object.freeze({
      scope: normalizedScope,
      domain: normalizedDomain,
      resource: normalizedResource,
      params: params as TParams,
    }),
  ]);
}

/**
 * Predicate filter matching every TanStack Query cache entry owned by `userId`.
 * Used on logout or account switch to evict private user cache entries.
 */
export function createUserScopePredicate(
  userId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const candidate = (first as { scope?: { userId?: unknown } }).scope;
    return candidate?.userId === normalizedUserId;
  };
}

/**
 * Key of `GET /classrooms/{id}`: the caller's role and capabilities in one
 * classroom. Scoped by user and classroom, so switching either one reads an
 * isolated cache entry and `createUserScopePredicate` evicts it on logout.
 */
export function classroomDetailQueryKey(
  userId: string,
  classroomId: string,
): ScopedQueryKey {
  return createScopedQueryKey({ userId, classroomId }, 'classrooms', 'detail');
}
