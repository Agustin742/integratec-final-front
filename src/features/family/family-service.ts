import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  familyLinksResponseSchema,
  familyReportCardResponseSchema,
  parentLinkMessageSchema,
  parentLinkMessagesResponseSchema,
  staffFamilyThreadsResponseSchema,
  type CreateParentLinkMessageDto,
  type FamilyLinksResponseDto,
  type FamilyReportCardResponseDto,
  type ParentLinkMessageDto,
  type ParentLinkMessagesResponseDto,
  type StaffFamilyThreadsResponseDto,
} from './family-schema';
import { familyMessages } from './messages';

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) &&
    error.name === 'AbortError'
  );
}

export type FamilyServiceErrorKind =
  | 'adult-mode'
  | 'not-found'
  | 'validation'
  | 'unauthorized'
  | 'network'
  | 'unexpected';

/**
 * Typed domain error for Family Area reads. Never forwards raw backend error
 * text into the user interface (`rules/security.md`).
 */
export class FamilyServiceError extends Error {
  readonly kind: FamilyServiceErrorKind;
  readonly status: number | null;
  readonly userMessage: string;

  constructor(options: {
    readonly kind: FamilyServiceErrorKind;
    readonly status: number | null;
    readonly userMessage: string;
    readonly cause?: unknown;
  }) {
    super(options.userMessage, { cause: options.cause });
    this.name = 'FamilyServiceError';
    this.kind = options.kind;
    this.status = options.status;
    this.userMessage = options.userMessage;
  }
}

export function isFamilyServiceError(
  error: unknown,
): error is FamilyServiceError {
  return error instanceof FamilyServiceError;
}

function toUnexpectedPayloadError(): FamilyServiceError {
  return new FamilyServiceError({
    kind: 'unexpected',
    status: 200,
    userMessage: familyMessages.errors.unexpected,
  });
}

function mapFamilyReadError(error: unknown): FamilyServiceError {
  if (error instanceof FamilyServiceError) {
    return error;
  }
  if (error instanceof ApiError) {
    if (error.status === 403 || error.kind === 'forbidden') {
      return new FamilyServiceError({
        kind: 'adult-mode',
        status: 403,
        userMessage: familyMessages.errors.adultModeDescription,
        cause: error,
      });
    }
    if (error.status === 404 || error.kind === 'not-found') {
      return new FamilyServiceError({
        kind: 'not-found',
        status: 404,
        userMessage: familyMessages.errors.notFoundDescription,
        cause: error,
      });
    }
    if (error.status === 401 || error.kind === 'unauthenticated') {
      return new FamilyServiceError({
        kind: 'unauthorized',
        status: 401,
        userMessage: familyMessages.errors.unauthorized,
        cause: error,
      });
    }
    if (error.kind === 'network') {
      return new FamilyServiceError({
        kind: 'network',
        status: null,
        userMessage: familyMessages.errors.network,
        cause: error,
      });
    }
    return new FamilyServiceError({
      kind: 'unexpected',
      status: error.status,
      userMessage: familyMessages.errors.unexpected,
      cause: error,
    });
  }
  return new FamilyServiceError({
    kind: 'unexpected',
    status: null,
    userMessage: familyMessages.errors.unexpected,
    cause: error,
  });
}

/**
 * `GET /me/parent-links`: lists active parent-child links for the
 * authenticated user, including links in adult-mode classrooms (`adultMode: true`).
 */
export async function listFamilyLinks(
  client: TypedApiClient,
  options: { readonly signal?: AbortSignal } = {},
): Promise<FamilyLinksResponseDto> {
  let payload: unknown;
  try {
    payload = await requestApi(() =>
      client.GET('/me/parent-links', {
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw mapFamilyReadError(error);
  }

  const parsed = familyLinksResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw toUnexpectedPayloadError();
  }
  return parsed.data;
}

/**
 * `GET /me/family-threads`: lists active parent-teacher messaging threads
 * across live, non-adult-mode classrooms where the authenticated user holds a
 * staff role. Returns `{ items: [] }` without error for students, parents, or
 * users without staff classrooms.
 */
export async function listStaffFamilyThreads(
  client: TypedApiClient,
  options: { readonly signal?: AbortSignal } = {},
): Promise<StaffFamilyThreadsResponseDto> {
  let payload: unknown;
  try {
    payload = await requestApi(() =>
      client.GET('/me/family-threads', {
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw mapFamilyReadError(error);
  }

  const parsed = staffFamilyThreadsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw toUnexpectedPayloadError();
  }
  return parsed.data;
}

export interface FamilyReportCardPageParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * `GET /me/parent-links/{linkId}/report-card`: reads the linked child's
 * paginated report card and participation metrics. Maps `403` (adult mode)
 * and `404` (removed link/student) to typed `FamilyServiceError` instances
 * without exposing raw backend messages.
 */
export async function getFamilyReportCard(
  client: TypedApiClient,
  linkId: string,
  params: FamilyReportCardPageParams,
  options: { readonly signal?: AbortSignal } = {},
): Promise<FamilyReportCardResponseDto> {
  let payload: unknown;
  try {
    payload = await requestApi(() =>
      client.GET('/me/parent-links/{linkId}/report-card', {
        params: {
          path: { linkId },
          query: {
            page: params.page,
            pageSize: params.pageSize,
          },
        },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw mapFamilyReadError(error);
  }

  const parsed = familyReportCardResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw toUnexpectedPayloadError();
  }
  return parsed.data;
}

export interface ParentLinkMessagesPageParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Returns `true` when a message send error leaves server persistence uncertain
 * (network drop, 5xx, or malformed 201 payload), signaling the caller to
 * preserve the user's draft and reconcile against the server.
 */
export function isUncertainFamilyWriteError(error: unknown): boolean {
  if (error instanceof FamilyServiceError) {
    return error.kind === 'network' || error.kind === 'unexpected';
  }
  if (error instanceof ApiError) {
    return (
      error.kind === 'network' ||
      error.kind === 'unexpected' ||
      error.status === null ||
      error.status >= 500
    );
  }
  return false;
}

function mapFamilyMessageWriteError(error: unknown): FamilyServiceError {
  if (error instanceof FamilyServiceError) {
    return error;
  }
  if (error instanceof ApiError) {
    if (error.status === 403 || error.kind === 'forbidden') {
      return new FamilyServiceError({
        kind: 'adult-mode',
        status: 403,
        userMessage: familyMessages.messaging.errors.sendAdultMode,
        cause: error,
      });
    }
    if (error.status === 404 || error.kind === 'not-found') {
      return new FamilyServiceError({
        kind: 'not-found',
        status: 404,
        userMessage: familyMessages.messaging.errors.sendNotFound,
        cause: error,
      });
    }
    if (
      error.status === 400 ||
      error.kind === 'validation' ||
      error.kind === 'bad-request'
    ) {
      return new FamilyServiceError({
        kind: 'validation',
        status: 400,
        userMessage: familyMessages.messaging.errors.sendValidation,
        cause: error,
      });
    }
    if (error.status === 401 || error.kind === 'unauthenticated') {
      return new FamilyServiceError({
        kind: 'unauthorized',
        status: 401,
        userMessage: familyMessages.errors.unauthorized,
        cause: error,
      });
    }
    if (error.kind === 'network') {
      return new FamilyServiceError({
        kind: 'network',
        status: null,
        userMessage: familyMessages.messaging.errors.sendUncertain,
        cause: error,
      });
    }
    const isServerFailure = error.status !== null && error.status >= 500;
    return new FamilyServiceError({
      kind: 'unexpected',
      status: error.status,
      userMessage: isServerFailure
        ? familyMessages.messaging.errors.sendUncertain
        : familyMessages.messaging.errors.sendUnexpected,
      cause: error,
    });
  }
  return new FamilyServiceError({
    kind: 'unexpected',
    status: null,
    userMessage: familyMessages.messaging.errors.sendUncertain,
    cause: error,
  });
}

/**
 * `GET /parent-links/{linkId}/messages`: lists paginated chronological private
 * messages for one active parent-child link.
 */
export async function listParentLinkMessages(
  client: TypedApiClient,
  linkId: string,
  params: ParentLinkMessagesPageParams,
  options: { readonly signal?: AbortSignal } = {},
): Promise<ParentLinkMessagesResponseDto> {
  let payload: unknown;
  try {
    payload = await requestApi(() =>
      client.GET('/parent-links/{linkId}/messages', {
        params: {
          path: { linkId },
          query: {
            page: params.page,
            pageSize: params.pageSize,
          },
        },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw mapFamilyReadError(error);
  }

  const parsed = parentLinkMessagesResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw toUnexpectedPayloadError();
  }
  return parsed.data;
}

/**
 * `POST /parent-links/{linkId}/messages`: sends a plain-text private message
 * in a parent-teacher thread. Maps `400`, `403`, `404`, and uncertain network/
 * `5xx` errors to typed `FamilyServiceError` without exposing raw backend text.
 */
export async function sendParentLinkMessage(
  client: TypedApiClient,
  linkId: string,
  body: CreateParentLinkMessageDto,
  options: { readonly signal?: AbortSignal } = {},
): Promise<ParentLinkMessageDto> {
  let payload: unknown;
  try {
    payload = await requestApi(() =>
      client.POST('/parent-links/{linkId}/messages', {
        params: {
          path: { linkId },
        },
        body,
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw mapFamilyMessageWriteError(error);
  }

  const parsed = parentLinkMessageSchema.safeParse(payload);
  if (!parsed.success) {
    throw new FamilyServiceError({
      kind: 'unexpected',
      status: 201,
      userMessage: familyMessages.messaging.errors.sendUncertain,
    });
  }
  return parsed.data;
}
