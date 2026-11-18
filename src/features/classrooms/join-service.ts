import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { joinMessages } from './join-messages';
import {
  acceptInvitationSchema,
  joinClassroomByCodeSchema,
  joinClassroomResponseSchema,
  type AcceptInvitationInput,
  type JoinClassroomByCodeInput,
  type JoinClassroomResponse,
} from './join-schema';

export interface JoinServiceOptions {
  readonly signal?: AbortSignal;
}

export const isJoinCancellation = (cause: unknown): boolean =>
  (cause instanceof Error || cause instanceof DOMException) &&
  cause.name === 'AbortError';

function buildPrivacySafeError(
  baseError: ApiError | null,
  overrides: {
    readonly kind: ApiError['kind'];
    readonly userMessage: string;
    readonly status?: number | null;
  },
): ApiError {
  return new ApiError({
    kind: overrides.kind,
    status: overrides.status ?? baseError?.status ?? null,
    code: baseError?.code ?? null,
    userMessage: overrides.userMessage,
    fieldErrors: {},
    correlationId: baseError?.correlationId ?? null,
    cause: baseError ?? undefined,
  });
}

/**
 * Maps invitation acceptance failures to privacy-safe `es-AR` messages without
 * disclosing school, classroom, or account existence (`rules/classrooms-and-roles.md`).
 */
export function resolveInvitationAcceptError(error: unknown): ApiError {
  if (!(error instanceof ApiError)) {
    return buildPrivacySafeError(null, {
      kind: 'unexpected',
      userMessage: joinMessages.errors.unexpected,
    });
  }
  if (error.kind === 'unauthenticated' || error.status === 401) {
    return buildPrivacySafeError(error, {
      kind: 'unauthenticated',
      userMessage: joinMessages.errors.unauthenticated,
    });
  }
  if (error.kind === 'rate-limited' || error.status === 429) {
    return buildPrivacySafeError(error, {
      kind: 'rate-limited',
      userMessage: joinMessages.errors.rateLimited,
    });
  }
  if (error.kind === 'conflict' || error.status === 409) {
    return buildPrivacySafeError(error, {
      kind: 'conflict',
      userMessage: joinMessages.errors.invitationConflict,
    });
  }
  if (
    error.kind === 'validation' ||
    error.kind === 'bad-request' ||
    error.kind === 'not-found' ||
    error.status === 400 ||
    error.status === 404
  ) {
    return buildPrivacySafeError(error, {
      kind: error.kind,
      userMessage: joinMessages.errors.invitationInvalidOrExpired,
    });
  }
  if (error.kind === 'network') {
    return buildPrivacySafeError(error, {
      kind: 'network',
      userMessage: joinMessages.errors.network,
    });
  }
  return buildPrivacySafeError(error, {
    kind: 'unexpected',
    userMessage: joinMessages.errors.unexpected,
  });
}

/**
 * Maps join-by-code failures to privacy-safe `es-AR` messages, preserving distinct
 * feedback for `429` rate limits, `409` exhausted/conflicting codes, and `network` failures.
 */
export function resolveJoinByCodeError(error: unknown): ApiError {
  if (!(error instanceof ApiError)) {
    return buildPrivacySafeError(null, {
      kind: 'unexpected',
      userMessage: joinMessages.errors.unexpected,
    });
  }
  if (error.kind === 'unauthenticated' || error.status === 401) {
    return buildPrivacySafeError(error, {
      kind: 'unauthenticated',
      userMessage: joinMessages.errors.unauthenticated,
    });
  }
  if (error.kind === 'rate-limited' || error.status === 429) {
    return buildPrivacySafeError(error, {
      kind: 'rate-limited',
      userMessage: joinMessages.errors.rateLimited,
    });
  }
  if (error.kind === 'conflict' || error.status === 409) {
    return buildPrivacySafeError(error, {
      kind: 'conflict',
      userMessage: joinMessages.errors.codeExhaustedOrConflict,
    });
  }
  if (
    error.kind === 'validation' ||
    error.kind === 'bad-request' ||
    error.kind === 'not-found' ||
    error.status === 400 ||
    error.status === 404
  ) {
    return buildPrivacySafeError(error, {
      kind: error.kind,
      userMessage: joinMessages.errors.codeInvalidOrExpired,
    });
  }
  if (error.kind === 'network') {
    return buildPrivacySafeError(error, {
      kind: 'network',
      userMessage: joinMessages.errors.network,
    });
  }
  return buildPrivacySafeError(error, {
    kind: 'unexpected',
    userMessage: joinMessages.errors.unexpected,
  });
}

function parseJoinResponse(payload: unknown): JoinClassroomResponse {
  const parsed = joinClassroomResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: joinMessages.errors.unexpected,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/**
 * Accepts a classroom invitation (`POST /invitations/accept`) for the
 * currently authenticated account and validates the returned enrollment payload.
 */
export async function acceptClassroomInvitation(
  client: TypedApiClient,
  input: AcceptInvitationInput,
  options: JoinServiceOptions = {},
): Promise<JoinClassroomResponse> {
  const parsedInput = acceptInvitationSchema.parse(input);
  let data: unknown;
  try {
    data = await requestApi(() =>
      client.POST('/invitations/accept', {
        body: { token: parsedInput.token },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isJoinCancellation(error)) {
      throw error;
    }
    throw resolveInvitationAcceptError(error);
  }
  return parseJoinResponse(data);
}

/**
 * Joins a classroom using an access code (`POST /classrooms/join`) as an
 * authenticated student and validates the returned enrollment payload.
 */
export async function joinClassroomWithCode(
  client: TypedApiClient,
  input: JoinClassroomByCodeInput,
  options: JoinServiceOptions = {},
): Promise<JoinClassroomResponse> {
  const parsedInput = joinClassroomByCodeSchema.parse(input);
  let data: unknown;
  try {
    data = await requestApi(() =>
      client.POST('/classrooms/join', {
        body: { code: parsedInput.code },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isJoinCancellation(error)) {
      throw error;
    }
    throw resolveJoinByCodeError(error);
  }
  return parseJoinResponse(data);
}
