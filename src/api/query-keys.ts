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

export type ClassroomSortOrder = 'createdAt' | '-createdAt' | 'name' | '-name';

export interface ClassroomListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: ClassroomSortOrder;
}

export interface NormalizedClassroomListQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ClassroomSortOrder;
}

function clampListParam(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

/**
 * Key of `GET /me/classrooms`: paginated list of accessible classrooms for one
 * authenticated user, isolated per `userId` (`rules/state-management.md`).
 */
export function classroomListQueryKey(
  userId: string,
  params: ClassroomListQueryParams = {},
): ScopedQueryKey<NormalizedClassroomListQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
    sort: params.sort ?? '-createdAt',
  });
  return createScopedQueryKey(
    { userId },
    'classrooms',
    'list',
    normalizedParams,
  );
}

/**
 * Predicate matching every classroom list query entry owned by `userId`.
 */
export function createClassroomListPredicate(
  userId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown };
      domain?: unknown;
      resource?: unknown;
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.domain === 'classrooms' &&
      segment.resource === 'list'
    );
  };
}

export type ClassroomRosterStateFilter = 'ACTIVE' | 'INACTIVE';

export interface ClassroomRosterQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly state?: ClassroomRosterStateFilter;
  readonly q?: string;
}

export interface NormalizedClassroomRosterQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly state: ClassroomRosterStateFilter | null;
  readonly q: string;
}

/**
 * Key of `GET /classrooms/{id}/roster`: paginated student roster scoped by
 * `userId` and `classroomId` (`rules/state-management.md`).
 */
export function classroomRosterQueryKey(
  userId: string,
  classroomId: string,
  params: ClassroomRosterQueryParams = {},
): ScopedQueryKey<NormalizedClassroomRosterQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
    state:
      params.state === 'ACTIVE' || params.state === 'INACTIVE'
        ? params.state
        : null,
    q: (params.q ?? '').trim().slice(0, 100),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'classrooms',
    'roster',
    normalizedParams,
  );
}

/**
 * Predicate matching every classroom roster query entry owned by `userId` and
 * `classroomId`.
 */
export function createClassroomRosterPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  const normalizedClassroomId = normalizeRequiredText(
    classroomId,
    'classroomId',
  );
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown; classroomId?: unknown };
      domain?: unknown;
      resource?: unknown;
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.classroomId === normalizedClassroomId &&
      segment.domain === 'classrooms' &&
      segment.resource === 'roster'
    );
  };
}

/**
 * Key of `GET /users/me`: the caller's own profile and base avatar. Scoped by
 * user, so another account never reads it and `createUserScopePredicate`
 * evicts it on logout.
 */
export function ownProfileQueryKey(userId: string): ScopedQueryKey {
  return createScopedQueryKey({ userId }, 'profile', 'own');
}

export type MaterialSortOrder = 'createdAt' | '-createdAt';

export interface MaterialListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: MaterialSortOrder;
}

export interface NormalizedMaterialListQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: MaterialSortOrder;
}

/**
 * Key of `GET /classrooms/{id}/materials`: paginated list of active study
 * materials for one classroom, scoped by both `userId` and `classroomId`
 * (`rules/state-management.md`).
 */
export function classroomMaterialsQueryKey(
  userId: string,
  classroomId: string,
  params: MaterialListQueryParams = {},
): ScopedQueryKey<NormalizedMaterialListQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
    sort: params.sort ?? '-createdAt',
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'materials',
    'list',
    normalizedParams,
  );
}

/**
 * Predicate matching every material list query entry owned by `userId` and
 * `classroomId`.
 */
export function createClassroomMaterialsPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  const normalizedClassroomId = normalizeRequiredText(
    classroomId,
    'classroomId',
  );
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown; classroomId?: unknown };
      domain?: unknown;
      resource?: unknown;
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.classroomId === normalizedClassroomId &&
      segment.domain === 'materials' &&
      segment.resource === 'list'
    );
  };
}
export type InvitationStateFilter =
  'PENDING' | 'USED' | 'REVOKED' | 'EXPIRED' | 'ALL';

export interface ClassroomInvitationsQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: InvitationStateFilter;
}

export interface NormalizedClassroomInvitationsQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly status: InvitationStateFilter;
}

const VALID_INVITATION_STATE_FILTERS: ReadonlySet<InvitationStateFilter> =
  new Set(['PENDING', 'USED', 'REVOKED', 'EXPIRED', 'ALL']);

/**
 * Key of `GET /classrooms/{id}/invitations`: paginated classroom invitations
 * scoped by `userId` and `classroomId` (`rules/state-management.md`).
 */
export function classroomInvitationsQueryKey(
  userId: string,
  classroomId: string,
  params: ClassroomInvitationsQueryParams = {},
): ScopedQueryKey<NormalizedClassroomInvitationsQueryParams> {
  const normalizedStatus: InvitationStateFilter =
    params.status !== undefined &&
    VALID_INVITATION_STATE_FILTERS.has(params.status)
      ? params.status
      : 'PENDING';
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
    status: normalizedStatus,
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'classrooms',
    'invitations',
    normalizedParams,
  );
}

/**
 * Predicate matching every classroom invitations query entry owned by `userId`
 * and `classroomId`.
 */
export function createClassroomInvitationsPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  const normalizedClassroomId = normalizeRequiredText(
    classroomId,
    'classroomId',
  );
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown; classroomId?: unknown };
      domain?: unknown;
      resource?: unknown;
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.classroomId === normalizedClassroomId &&
      segment.domain === 'classrooms' &&
      segment.resource === 'invitations'
    );
  };
}

export type ActivitySortOrder = 'dueAt' | 'createdAt' | '-dueAt' | '-createdAt';
export type ActivityStateFilter = 'DRAFT' | 'PUBLISHED';

export interface ActivityListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: ActivitySortOrder;
  readonly state?: ActivityStateFilter;
}

export type ClassroomActivitiesQueryParams = ActivityListQueryParams;

export interface NormalizedActivityListQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ActivitySortOrder;
  readonly state: ActivityStateFilter | null;
}

/**
 * Key of `GET /classrooms/{id}/activities`: paginated list of classroom
 * activities scoped by `userId` and `classroomId` (`rules/state-management.md`).
 */
export function classroomActivitiesQueryKey(
  userId: string,
  classroomId: string,
  params: ActivityListQueryParams = {},
): ScopedQueryKey<NormalizedActivityListQueryParams> {
  const sort: ActivitySortOrder =
    params.sort === 'createdAt' ||
    params.sort === '-dueAt' ||
    params.sort === '-createdAt'
      ? params.sort
      : 'dueAt';
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
    sort,
    state:
      params.state === 'DRAFT' || params.state === 'PUBLISHED'
        ? params.state
        : null,
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'activities',
    'list',
    normalizedParams,
  );
}

/**
 * Predicate matching every classroom activity list query entry owned by
 * `userId` and `classroomId` (excluding detail queries).
 */
export function createClassroomActivitiesListPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  const normalizedClassroomId = normalizeRequiredText(
    classroomId,
    'classroomId',
  );
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown; classroomId?: unknown };
      domain?: unknown;
      resource?: unknown;
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.classroomId === normalizedClassroomId &&
      segment.domain === 'activities' &&
      segment.resource === 'list'
    );
  };
}

/**
 * Predicate matching every classroom activity query entry (list and detail)
 * owned by `userId` and `classroomId`, so confirmed writes and access-revocation
 * cleanups reconcile all affected activity views at once.
 */
export function createClassroomActivitiesPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  const normalizedClassroomId = normalizeRequiredText(
    classroomId,
    'classroomId',
  );
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown; classroomId?: unknown };
      domain?: unknown;
      resource?: unknown;
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.classroomId === normalizedClassroomId &&
      segment.domain === 'activities' &&
      (segment.resource === 'list' || segment.resource === 'detail')
    );
  };
}

/**
 * Key of `GET /classrooms/{id}/activities/{activityId}` scoped by `userId` and
 * `classroomId` (`rules/state-management.md`).
 */
export function classroomActivityDetailQueryKey(
  userId: string,
  classroomId: string,
  activityId: string,
): ScopedQueryKey<{ readonly activityId: string }> {
  return createScopedQueryKey(
    { userId, classroomId },
    'activities',
    'detail',
    Object.freeze({
      activityId: normalizeRequiredText(activityId, 'activityId'),
    }),
  );
}
