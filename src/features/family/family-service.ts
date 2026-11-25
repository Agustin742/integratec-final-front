import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  familyLinksResponseSchema,
  familyReportCardResponseSchema,
  type FamilyLinksResponseDto,
  type FamilyReportCardResponseDto,
} from './family-schema';
import { familyMessages } from './messages';

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) &&
    error.name === 'AbortError'
  );
}

export type FamilyServiceErrorKind =
  'adult-mode' | 'not-found' | 'unauthorized' | 'network' | 'unexpected';

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
