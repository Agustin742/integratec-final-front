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

/**
 * Key of `GET /classrooms/{id}/desks`: server-authoritative physical desk map
 * for one classroom, scoped by `userId` and `classroomId`
 * (`rules/state-management.md`).
 */
export function classroomDesksQueryKey(
  userId: string,
  classroomId: string,
): ScopedQueryKey {
  return createScopedQueryKey({ userId, classroomId }, 'classrooms', 'desks');
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

/**
 * Key of `GET /users/me/avatar/styles`: which hair and top styles the user
 * can pick. Ownership is global to the user, so it is scoped by user only;
 * a purchase in any classroom shop invalidates it.
 */
export function ownAvatarStylesQueryKey(userId: string): ScopedQueryKey {
  return createScopedQueryKey({ userId }, 'profile', 'avatar-styles');
}

/**
 * Key of `GET /users/me/streak-and-badges`: server-confirmed study streak and
 * earned/locked badges for the authenticated user (`HU-GAM-002`).
 */
export function ownStreakAndBadgesQueryKey(userId: string): ScopedQueryKey {
  return createScopedQueryKey({ userId }, 'gamification', 'streak-and-badges');
}

/**
 * Key of `GET /users/me/daily-review`: server-decided daily review eligibility
 * and content for the authenticated user (`HU-BOT-003`).
 */
export function ownDailyReviewQueryKey(userId: string): ScopedQueryKey {
  return createScopedQueryKey({ userId }, 'bot', 'daily-review');
}

/**
 * Key of `GET /classrooms/{id}/bot/status`: Study Guide Bot availability and
 * server-decided exam lockout state scoped by `userId` and `classroomId`
 * (`rules/ai-bot-and-daily-briefing.md`, `HU-BOT-002`).
 */
export function classroomBotStatusQueryKey(
  userId: string,
  classroomId: string,
): ScopedQueryKey<undefined> {
  return createScopedQueryKey(
    { userId, classroomId },
    'bot',
    'status',
    undefined,
  );
}

export type MaterialSortOrder = 'createdAt' | '-createdAt';

export interface MaterialListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: MaterialSortOrder;
  /** A module UUID of the classroom, or `unassigned`; omitted lists every file. */
  readonly moduleId?: string;
}

export interface NormalizedMaterialListQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: MaterialSortOrder;
  readonly moduleId: string | null;
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
    moduleId: params.moduleId ?? null,
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'materials',
    'list',
    normalizedParams,
  );
}

/**
 * Key of `GET /classrooms/{id}/material-modules`: the ordered module list with
 * per-module file counts, scoped by both `userId` and `classroomId`.
 */
export function classroomMaterialModulesQueryKey(
  userId: string,
  classroomId: string,
): ScopedQueryKey<undefined> {
  return createScopedQueryKey(
    { userId, classroomId },
    'materials',
    'modules',
    undefined,
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

/**
 * Key of `GET /classrooms/{id}/bot/materials`: Study Guide Bot allowed-material
 * configuration and indexing state scoped by `userId` and `classroomId`
 * (`rules/state-management.md`, `HU-BOT-001`).
 */
export function classroomBotMaterialsQueryKey(
  userId: string,
  classroomId: string,
): ScopedQueryKey<undefined> {
  return createScopedQueryKey(
    { userId, classroomId },
    'materials',
    'bot-config',
    undefined,
  );
}

/**
 * Predicate matching every Study Guide Bot material-config query entry owned by
 * `userId` and `classroomId`.
 */
export function createClassroomBotMaterialsPredicate(
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
      segment.resource === 'bot-config'
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

/**
 * Key of `GET /classrooms/{id}/parent-links`: active parent-child guardian
 * links for one classroom, scoped by `userId` and `classroomId`
 * (`rules/state-management.md`).
 */
export function classroomParentLinksQueryKey(
  userId: string,
  classroomId: string,
): ScopedQueryKey {
  return createScopedQueryKey(
    { userId, classroomId },
    'classrooms',
    'parent-links',
  );
}

/**
 * Predicate matching every classroom parent-links query entry owned by
 * `userId` and `classroomId`.
 */
export function createClassroomParentLinksPredicate(
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
      segment.resource === 'parent-links'
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

/**
 * Key of `GET /activities/{activityId}/submissions/me`: the calling student's
 * own submission to one activity. The contract marks the response as not
 * cacheable, so consumers keep it fresh rather than relying on cached reads.
 */
export function classroomActivitySubmissionQueryKey(
  userId: string,
  classroomId: string,
  activityId: string,
): ScopedQueryKey<{ readonly activityId: string }> {
  return createScopedQueryKey(
    { userId, classroomId },
    'activities',
    'submission',
    Object.freeze({
      activityId: normalizeRequiredText(activityId, 'activityId'),
    }),
  );
}

/**
 * Key of `GET /activities/{activityId}/submissions/me` read for a
 * multiple-choice exam (`HU-ACT-003` part 2/2, see `docs/exam-answering.md`):
 * the calling student's own exam submission, where a missing submission reads
 * as `null`. Kept apart from `classroomActivitySubmissionQueryKey` because
 * that entry caches the file read, which throws on `404`. The response is not
 * cacheable per the contract, so consumers keep it fresh rather than relying
 * on cached reads.
 */
export function classroomExamAttemptQueryKey(
  userId: string,
  classroomId: string,
  activityId: string,
): ScopedQueryKey<{ readonly activityId: string }> {
  return createScopedQueryKey(
    { userId, classroomId },
    'activities',
    'exam-attempt',
    Object.freeze({
      activityId: normalizeRequiredText(activityId, 'activityId'),
    }),
  );
}

export interface AnnouncementListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedAnnouncementListQueryParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Key of `GET /classrooms/{id}/announcements`: paginated chronological list
 * of announcements for one classroom, scoped by both `userId` and
 * `classroomId` (`rules/state-management.md`).
 */
export function classroomAnnouncementsQueryKey(
  userId: string,
  classroomId: string,
  params: AnnouncementListQueryParams = {},
): ScopedQueryKey<NormalizedAnnouncementListQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'announcements',
    'list',
    normalizedParams,
  );
}

/**
 * Predicate matching every announcement list query entry owned by `userId` and
 * `classroomId`.
 */
export function createClassroomAnnouncementsPredicate(
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
      segment.domain === 'announcements' &&
      segment.resource === 'list'
    );
  };
}

/**
 * Key of `GET /classrooms/{id}/points`: the signed-in student's server-computed
 * points wallet and one page of movements, scoped by `userId` and `classroomId`
 * (`rules/state-management.md`).
 */
export interface StudentWalletQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedStudentWalletQueryParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Clamps wallet pagination the same way the roster and materials keys do, so
 * the query key and the outgoing request always agree on the page values.
 */
export function normalizeStudentWalletQueryParams(
  params: StudentWalletQueryParams,
): NormalizedStudentWalletQueryParams {
  return Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
  });
}

/**
 * Key of `GET /classrooms/{id}/points`: the caller's own wallet, scoped by
 * `userId` and `classroomId`, so other pages and classrooms read isolated
 * cache entries (`rules/state-management.md`).
 */
export function studentWalletQueryKey(
  userId: string,
  classroomId: string,
  params: StudentWalletQueryParams = {},
): ScopedQueryKey<NormalizedStudentWalletQueryParams> {
  return createScopedQueryKey(
    { userId, classroomId },
    'points',
    'wallet',
    normalizeStudentWalletQueryParams(params),
  );
}

/**
 * Predicate matching every student wallet query entry owned by `userId` in
 * `classroomId`; used by mutations to refresh the balance through query
 * invalidation.
 */
export function createStudentWalletPredicate(
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
      segment.domain === 'points' &&
      segment.resource === 'wallet'
    );
  };
}

export interface NotificationListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedNotificationListQueryParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Key of `GET /notifications`: paginated list of in-app notifications for one
 * authenticated user (`rules/state-management.md`).
 */
export function notificationsListQueryKey(
  userId: string,
  params: NotificationListQueryParams = {},
): ScopedQueryKey<NormalizedNotificationListQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
  });
  return createScopedQueryKey(
    { userId },
    'notifications',
    'list',
    normalizedParams,
  );
}

/**
 * Predicate matching every notification list query entry owned by `userId`.
 */
export function createNotificationsPredicate(
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
      segment.domain === 'notifications' &&
      segment.resource === 'list'
    );
  };
}

export type GradingQueueStateFilter = 'submitted' | 'graded';
export type GradingQueueSortOrder =
  'submittedAt' | 'gradedAt' | '-submittedAt' | '-gradedAt';

export interface GradingQueueQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly activityId?: string;
  readonly state?: GradingQueueStateFilter;
  readonly sort?: GradingQueueSortOrder;
}

export interface NormalizedGradingQueueQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly activityId: string;
  readonly state: GradingQueueStateFilter | '';
  readonly sort: GradingQueueSortOrder;
}

function normalizeGradingQueueState(
  value: GradingQueueStateFilter | undefined,
): GradingQueueStateFilter | '' {
  return value === 'submitted' || value === 'graded' ? value : '';
}

function normalizeGradingQueueSort(
  value: GradingQueueSortOrder | undefined,
): GradingQueueSortOrder {
  if (
    value === 'submittedAt' ||
    value === 'gradedAt' ||
    value === '-submittedAt' ||
    value === '-gradedAt'
  ) {
    return value;
  }
  return 'submittedAt';
}

/**
 * Key of `GET /classrooms/{id}/submissions`: paginated teacher grading queue
 * scoped by `userId` and `classroomId` (`rules/state-management.md`).
 */
export function classroomSubmissionsQueueQueryKey(
  userId: string,
  classroomId: string,
  params: GradingQueueQueryParams = {},
): ScopedQueryKey<NormalizedGradingQueueQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
    activityId: (params.activityId ?? '').trim(),
    state: normalizeGradingQueueState(params.state),
    sort: normalizeGradingQueueSort(params.sort),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'submissions',
    'queue',
    normalizedParams,
  );
}

/**
 * Key of `GET /submissions/{submissionId}` (short-lived signed file URLs)
 * scoped by `userId` and `classroomId`.
 */
export function submissionDetailQueryKey(
  userId: string,
  classroomId: string,
  submissionId: string,
): ScopedQueryKey<{ readonly submissionId: string }> {
  return createScopedQueryKey(
    { userId, classroomId },
    'submissions',
    'detail',
    Object.freeze({
      submissionId: normalizeRequiredText(submissionId, 'submissionId'),
    }),
  );
}

/**
 * Key of `GET /submissions/{submissionId}/grade` scoped by `userId` and
 * `classroomId`.
 */
export function submissionGradeQueryKey(
  userId: string,
  classroomId: string,
  submissionId: string,
): ScopedQueryKey<{ readonly submissionId: string }> {
  return createScopedQueryKey(
    { userId, classroomId },
    'grades',
    'detail',
    Object.freeze({
      submissionId: normalizeRequiredText(submissionId, 'submissionId'),
    }),
  );
}

/**
 * Predicate matching every teacher grading queue query entry owned by `userId`
 * and `classroomId`.
 */
export function createClassroomSubmissionsQueuePredicate(
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
      segment.domain === 'submissions' &&
      segment.resource === 'queue'
    );
  };
}

/**
 * Predicate matching every classroom grading/submission query entry owned by
 * `userId` and `classroomId`, for write reconciliation and access revocation.
 */
export function createClassroomGradesPredicate(
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
    if (
      segment.scope?.userId !== normalizedUserId ||
      segment.scope?.classroomId !== normalizedClassroomId
    ) {
      return false;
    }
    return (
      (segment.domain === 'submissions' &&
        (segment.resource === 'queue' || segment.resource === 'detail')) ||
      (segment.domain === 'grades' && segment.resource === 'detail')
    );
  };
}

/**
 * Pagination of the HU-ACT-005 read endpoints: every key and outgoing request
 * agrees on the clamped values (`#46`, `rules/state-management.md`).
 */
export interface GradesMetricsQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedGradesMetricsQueryParams {
  readonly page: number;
  readonly pageSize: number;
}

export function normalizeGradesMetricsQueryParams(
  params: GradesMetricsQueryParams,
): NormalizedGradesMetricsQueryParams {
  return Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
  });
}

function createGradesPredicate(
  userId: string,
  classroomId: string,
  resource: 'report-card' | 'own-metrics' | 'classroom-metrics',
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
      segment.domain === 'grades' &&
      segment.resource === resource
    );
  };
}

/**
 * Key of `GET /classrooms/{id}/me/report-card`: the signed-in student's graded
 * activities, scoped by `userId` and `classroomId` so other users and
 * classrooms read isolated cache entries (`rules/state-management.md`).
 */
export function studentReportCardQueryKey(
  userId: string,
  classroomId: string,
  params: GradesMetricsQueryParams = {},
): ScopedQueryKey<NormalizedGradesMetricsQueryParams> {
  return createScopedQueryKey(
    { userId, classroomId },
    'grades',
    'report-card',
    normalizeGradesMetricsQueryParams(params),
  );
}

/**
 * Predicate matching every student report card entry owned by `userId` in
 * `classroomId`.
 */
export function createStudentReportCardPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  return createGradesPredicate(userId, classroomId, 'report-card');
}

/**
 * Key of `GET /classrooms/{id}/me/activity-metrics`: the caller's own daily
 * activity signals, scoped by `userId` and `classroomId`.
 */
export function ownActivityMetricsQueryKey(
  userId: string,
  classroomId: string,
  params: GradesMetricsQueryParams = {},
): ScopedQueryKey<NormalizedGradesMetricsQueryParams> {
  return createScopedQueryKey(
    { userId, classroomId },
    'grades',
    'own-metrics',
    normalizeGradesMetricsQueryParams(params),
  );
}

/**
 * Predicate matching every own-metrics entry owned by `userId` in
 * `classroomId`.
 */
export function createOwnActivityMetricsPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  return createGradesPredicate(userId, classroomId, 'own-metrics');
}

/**
 * Key of `GET /classrooms/{id}/activity-metrics`: the per-student raw totals
 * for teaching staff, scoped by `userId` and `classroomId`.
 */
export function classroomActivityMetricsQueryKey(
  userId: string,
  classroomId: string,
  params: GradesMetricsQueryParams = {},
): ScopedQueryKey<NormalizedGradesMetricsQueryParams> {
  return createScopedQueryKey(
    { userId, classroomId },
    'grades',
    'classroom-metrics',
    normalizeGradesMetricsQueryParams(params),
  );
}

/**
 * Predicate matching every classroom metrics entry owned by `userId` in
 * `classroomId`.
 */
export function createClassroomActivityMetricsPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  return createGradesPredicate(userId, classroomId, 'classroom-metrics');
}

export type ShopItemKindFilter =
  | 'CLASSROOM_ITEM'
  | 'AVATAR_ACCESSORY'
  | 'AVATAR_STYLE'
  | 'DESK_UPGRADE'
  | 'PET_ACCESSORY';

export type ShopItemsSortOrder =
  | 'createdAt'
  | '-createdAt'
  | 'defaultPrice'
  | '-defaultPrice'
  | 'name'
  | '-name';

export type ShopPurchasesSortOrder =
  '-createdAt' | 'createdAt' | 'pricePaid' | '-pricePaid';

export interface ShopItemsQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: ShopItemsSortOrder;
  readonly kind?: ShopItemKindFilter;
}

export interface NormalizedShopItemsQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ShopItemsSortOrder;
  readonly kind: ShopItemKindFilter | '';
}

export interface ShopPurchasesQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: ShopPurchasesSortOrder;
}

export interface NormalizedShopPurchasesQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ShopPurchasesSortOrder;
}

function normalizeShopItemKind(
  value: ShopItemKindFilter | undefined,
): ShopItemKindFilter | '' {
  if (
    value === 'CLASSROOM_ITEM' ||
    value === 'AVATAR_ACCESSORY' ||
    value === 'AVATAR_STYLE' ||
    value === 'DESK_UPGRADE' ||
    value === 'PET_ACCESSORY'
  ) {
    return value;
  }
  return '';
}

function normalizeShopItemsSort(
  value: ShopItemsSortOrder | undefined,
): ShopItemsSortOrder {
  if (
    value === 'createdAt' ||
    value === '-createdAt' ||
    value === 'defaultPrice' ||
    value === '-defaultPrice' ||
    value === 'name' ||
    value === '-name'
  ) {
    return value;
  }
  return 'createdAt';
}

function normalizeShopPurchasesSort(
  value: ShopPurchasesSortOrder | undefined,
): ShopPurchasesSortOrder {
  if (
    value === '-createdAt' ||
    value === 'createdAt' ||
    value === 'pricePaid' ||
    value === '-pricePaid'
  ) {
    return value;
  }
  return '-createdAt';
}

/**
 * Key of `GET /classrooms/{id}/shop/items`: paginated classroom shop catalog
 * scoped by `userId` and `classroomId` (`rules/state-management.md`).
 */
export function shopItemsQueryKey(
  userId: string,
  classroomId: string,
  params: ShopItemsQueryParams = {},
): ScopedQueryKey<NormalizedShopItemsQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 12, 1, 100),
    sort: normalizeShopItemsSort(params.sort),
    kind: normalizeShopItemKind(params.kind),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'shop',
    'items',
    normalizedParams,
  );
}

/**
 * Key of `GET /classrooms/{id}/shop/purchases`: paginated student purchase
 * history scoped by `userId` and `classroomId` (`rules/state-management.md`).
 */
export function shopPurchasesQueryKey(
  userId: string,
  classroomId: string,
  params: ShopPurchasesQueryParams = {},
): ScopedQueryKey<NormalizedShopPurchasesQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 10, 1, 100),
    sort: normalizeShopPurchasesSort(params.sort),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'shop',
    'purchases',
    normalizedParams,
  );
}

/**
 * Predicate matching every classroom shop query entry (catalog and purchases)
 * owned by `userId` and `classroomId`, for post-purchase reconciliation and
 * access-revocation cleanup.
 */
export function createClassroomShopPredicate(
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
      segment.domain === 'shop' &&
      (segment.resource === 'items' || segment.resource === 'purchases')
    );
  };
}

export type ForumSortOrder = 'createdAt' | '-createdAt';

export interface ForumListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: ForumSortOrder;
}

export interface NormalizedForumThreadsQueryParams {
  readonly activityId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ForumSortOrder;
}

export interface NormalizedForumPostsQueryParams {
  readonly activityId: string;
  readonly threadId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ForumSortOrder;
}

export interface ClassroomDirectoryQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedClassroomDirectoryQueryParams {
  readonly page: number;
  readonly pageSize: number;
}

function normalizeForumSort(
  value: ForumSortOrder | undefined,
  fallback: ForumSortOrder,
): ForumSortOrder {
  if (value === 'createdAt' || value === '-createdAt') {
    return value;
  }
  return fallback;
}

/**
 * Key of `GET /classrooms/{id}/activities/{activityId}/forum/threads` scoped
 * by `userId` and `classroomId` (`rules/state-management.md`).
 */
export function activityForumThreadsQueryKey(
  userId: string,
  classroomId: string,
  activityId: string,
  params: ForumListQueryParams = {},
): ScopedQueryKey<NormalizedForumThreadsQueryParams> {
  const normalizedParams = Object.freeze({
    activityId: normalizeRequiredText(activityId, 'activityId'),
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 10, 1, 100),
    sort: normalizeForumSort(params.sort, '-createdAt'),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'activities',
    'forum-threads',
    normalizedParams,
  );
}

/**
 * Key of `GET /classrooms/{id}/activities/{activityId}/forum/threads/{threadId}/posts`
 * scoped by `userId` and `classroomId`.
 */
export function activityForumPostsQueryKey(
  userId: string,
  classroomId: string,
  activityId: string,
  threadId: string,
  params: ForumListQueryParams = {},
): ScopedQueryKey<NormalizedForumPostsQueryParams> {
  const normalizedParams = Object.freeze({
    activityId: normalizeRequiredText(activityId, 'activityId'),
    threadId: normalizeRequiredText(threadId, 'threadId'),
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
    sort: normalizeForumSort(params.sort, 'createdAt'),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'activities',
    'forum-posts',
    normalizedParams,
  );
}

/**
 * Predicate matching all forum thread/post query entries for one activity owned
 * by `userId` and `classroomId`.
 */
export function createActivityForumPredicate(
  userId: string,
  classroomId: string,
  activityId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  const normalizedClassroomId = normalizeRequiredText(
    classroomId,
    'classroomId',
  );
  const normalizedActivityId = normalizeRequiredText(activityId, 'activityId');
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown; classroomId?: unknown };
      domain?: unknown;
      resource?: unknown;
      params?: { activityId?: unknown };
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.classroomId === normalizedClassroomId &&
      segment.domain === 'activities' &&
      (segment.resource === 'forum-threads' ||
        segment.resource === 'forum-posts') &&
      segment.params?.activityId === normalizedActivityId
    );
  };
}

/**
 * Key of `GET /classrooms/{id}/members` directory lookup scoped by `userId`
 * and `classroomId`.
 */
export function classroomDirectoryMembersQueryKey(
  userId: string,
  classroomId: string,
  params: ClassroomDirectoryQueryParams = {},
): ScopedQueryKey<NormalizedClassroomDirectoryQueryParams> {
  const normalizedParams = Object.freeze({
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 100, 1, 100),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'classrooms',
    'members-directory',
    normalizedParams,
  );
}

export interface ChatHistoryQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * The chat history is one infinite query: the page is the query's page param
 * (older messages = higher page numbers), so only `pageSize` identifies it.
 */
export interface ChatHistoryInfiniteQueryParams {
  readonly pageSize?: number;
}

export interface NormalizedChatHistoryQueryParams {
  readonly pageSize: number;
}

/**
 * Key of the `useInfiniteQuery` over `GET /classrooms/{id}/messages`
 * (`ChatController_list`) scoped by `userId` and `classroomId`, so switching
 * either one reads an isolated cache entry (`rules/state-management.md`).
 * Its cached data is `InfiniteData<PaginatedChatHistoryDto>`.
 */
export function classroomChatHistoryQueryKey(
  userId: string,
  classroomId: string,
  params: ChatHistoryInfiniteQueryParams = {},
): ScopedQueryKey<NormalizedChatHistoryQueryParams> {
  const normalizedParams = Object.freeze({
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
  });
  return createScopedQueryKey(
    { userId, classroomId },
    'chat',
    'history',
    normalizedParams,
  );
}

/**
 * Key of the chat mention-directory lookup (`GET /classrooms/{id}/members`
 * with the `q` case-insensitive display-name prefix filter, backend decision
 * D12) scoped by `userId` and `classroomId`.
 *
 * It deliberately lives OUTSIDE the `chat` query domain of the history keys:
 * the `createClassroomChatPredicate` revalidations (confirmed sends, hides,
 * live reconnects, SSE context hints) must reconcile the conversation, not
 * refetch the member directory the mention picker reads on demand.
 */
export interface ChatMentionDirectoryQueryParams {
  readonly q: string;
  readonly page: number;
  readonly pageSize: number;
}

export function chatMentionDirectoryQueryKey(
  userId: string,
  classroomId: string,
  params: ChatMentionDirectoryQueryParams,
): ScopedQueryKey<ChatMentionDirectoryQueryParams> {
  return createScopedQueryKey(
    { userId, classroomId },
    'chat-mentions',
    'directory',
    Object.freeze({
      q: params.q.trim().slice(0, 100),
      page: params.page,
      pageSize: params.pageSize,
    }),
  );
}

/**
 * Key of the chat inbox (`GET /chats`, `ChatInboxController_list`): the chats
 * of ALL the user's classrooms with their last message and unread count,
 * scoped by user only. It lives in its own `chat-inbox` domain so the
 * per-classroom `createClassroomChatPredicate` sweeps never refetch it.
 */
export function chatInboxQueryKey(userId: string): ScopedQueryKey {
  return createScopedQueryKey({ userId }, 'chat-inbox', 'list');
}

/**
 * Predicate matching every classroom chat query entry owned by `userId` and
 * `classroomId`, so confirmed sends, moderation hides and the classroom
 * context revalidation seam reconcile all affected chat views at once.
 */
export function createClassroomChatPredicate(
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
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.classroomId === normalizedClassroomId &&
      segment.domain === 'chat'
    );
  };
}

/**
 * Predicate matching only the infinite history entries (any page size) of one
 * user + classroom, the cache the live delivery and the composer read.
 */
export function createClassroomChatHistoryPredicate(
  userId: string,
  classroomId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const isClassroomChat = createClassroomChatPredicate(userId, classroomId);
  return (query) =>
    isClassroomChat(query) &&
    (query.queryKey[0] as { resource?: unknown }).resource === 'history';
}

/**
 * Key of `GET /classrooms/{id}/me/equipment`: the authenticated student's
 * classroom-scoped equipment state. Scoped by `userId` and `classroomId` so
 * switching either one reads an isolated cache entry
 * (`rules/state-management.md`).
 */
export function classroomEquipmentQueryKey(
  userId: string,
  classroomId: string,
): ScopedQueryKey {
  return createScopedQueryKey({ userId, classroomId }, 'equipment', 'state');
}

/**
 * Predicate matching the classroom equipment state query entry owned by
 * `userId` and `classroomId`. Used on logout or account switch to evict the
 * private cache entry (`rules/state-management.md`).
 */
export function createClassroomEquipmentPredicate(
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
      segment.domain === 'equipment' &&
      segment.resource === 'state'
    );
  };
}

export interface FamilyReportCardQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedFamilyReportCardQueryParams {
  readonly linkId: string;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Key of `GET /me/parent-links`: active parent-child links for the
 * authenticated user, scoped by `userId` (`rules/state-management.md`).
 */
export function familyLinksQueryKey(userId: string): ScopedQueryKey {
  return createScopedQueryKey({ userId }, 'family', 'links');
}

/**
 * Key of `GET /me/family-threads`: active parent-teacher messaging threads
 * across staff classrooms for the authenticated user, scoped by `userId`
 * (`rules/state-management.md`).
 */
export function staffFamilyThreadsQueryKey(userId: string): ScopedQueryKey {
  return createScopedQueryKey({ userId }, 'family', 'staff-threads');
}

/**
 * Key of `GET /me/parent-links/{linkId}/report-card`: a linked child's
 * paginated report card and participation summary, scoped by `userId` and
 * `linkedChildId` (`linkId`) so switching children or accounts reads an
 * isolated cache entry (`rules/state-management.md`, `rules/classrooms-and-roles.md`).
 */
export function familyReportCardQueryKey(
  userId: string,
  linkId: string,
  params: FamilyReportCardQueryParams = {},
): ScopedQueryKey<NormalizedFamilyReportCardQueryParams> {
  const normalizedLinkId = normalizeRequiredText(linkId, 'linkId');
  const normalizedParams = Object.freeze({
    linkId: normalizedLinkId,
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 20, 1, 100),
  });
  return createScopedQueryKey(
    { userId, linkedChildId: normalizedLinkId },
    'family',
    'report-card',
    normalizedParams,
  );
}

/**
 * Predicate matching every family report card query entry owned by `userId`
 * and `linkId`. Used to clear stale pages on terminal `403`/`404` responses.
 */
export function createFamilyReportCardPredicate(
  userId: string,
  linkId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  const normalizedLinkId = normalizeRequiredText(linkId, 'linkId');
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown; linkedChildId?: unknown };
      domain?: unknown;
      resource?: unknown;
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.linkedChildId === normalizedLinkId &&
      segment.domain === 'family' &&
      segment.resource === 'report-card'
    );
  };
}

export interface ParentLinkMessagesQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedParentLinkMessagesQueryParams {
  readonly linkId: string;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Key of `GET /parent-links/{linkId}/messages`: paginated chronological
 * private messages for one parent-teacher thread, scoped by `userId` and
 * `linkedChildId` (`linkId`) so switching children, dialogs, or accounts reads
 * an isolated cache entry (`rules/state-management.md`).
 */
export function parentLinkMessagesQueryKey(
  userId: string,
  linkId: string,
  params: ParentLinkMessagesQueryParams = {},
): ScopedQueryKey<NormalizedParentLinkMessagesQueryParams> {
  const normalizedLinkId = normalizeRequiredText(linkId, 'linkId');
  const normalizedParams = Object.freeze({
    linkId: normalizedLinkId,
    page: clampListParam(params.page, 1, 1, 10_000),
    pageSize: clampListParam(params.pageSize, 30, 1, 50),
  });
  return createScopedQueryKey(
    { userId, linkedChildId: normalizedLinkId },
    'family',
    'messages',
    normalizedParams,
  );
}

/**
 * Predicate matching every parent-link messages query entry owned by `userId`
 * and `linkId`. Used on message creation, uncertain-write reconciliation, and
 * terminal `403`/`404` cleanup.
 */
export function createParentLinkMessagesPredicate(
  userId: string,
  linkId: string,
): (query: { readonly queryKey: readonly unknown[] }) => boolean {
  const normalizedUserId = normalizeRequiredText(userId, 'userId');
  const normalizedLinkId = normalizeRequiredText(linkId, 'linkId');
  return (query) => {
    const first = query.queryKey[0];
    if (typeof first !== 'object' || first === null) {
      return false;
    }
    const segment = first as {
      scope?: { userId?: unknown; linkedChildId?: unknown };
      domain?: unknown;
      resource?: unknown;
    };
    return (
      segment.scope?.userId === normalizedUserId &&
      segment.scope?.linkedChildId === normalizedLinkId &&
      segment.domain === 'family' &&
      segment.resource === 'messages'
    );
  };
}
