import type { OpenApiFetchResult, TypedApiClient } from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import { authMessages } from './messages';
import {
  passwordResetRequestedResponseSchema,
  type PasswordResetConfirmRequestDto,
  type PasswordResetRequestDto,
  type PasswordResetRequestedResponseDto,
} from './password-reset-schema';

export interface PasswordResetServiceOptions {
  readonly signal?: AbortSignal;
}

export const isPasswordResetCancellation = (cause: unknown): boolean =>
  (cause instanceof Error || cause instanceof DOMException) &&
  cause.name === 'AbortError';

function buildMappedError(
  baseError: ApiError,
  overrides: {
    readonly kind?: ApiError['kind'];
    readonly userMessage: string;
    readonly fieldErrors?: ApiError['fieldErrors'];
  },
): ApiError {
  return new ApiError({
    kind: overrides.kind ?? baseError.kind,
    status: baseError.status,
    code: baseError.code,
    userMessage: overrides.userMessage,
    details: baseError.details,
    fieldErrors: overrides.fieldErrors ?? baseError.fieldErrors,
    correlationId: baseError.correlationId,
  });
}

function buildNetworkError(cause: unknown, userMessage: string): ApiError {
  const networkError = mapNetworkError(cause);
  return new ApiError({
    kind: 'network',
    status: networkError.status,
    code: networkError.code,
    userMessage,
    details: networkError.details,
    fieldErrors: networkError.fieldErrors,
    correlationId: networkError.correlationId,
    cause,
  });
}

/**
 * Requests a password reset email via `POST /auth/password-reset/request`.
 * Always maps transport errors into centralized Spanish messages without revealing
 * whether the submitted email corresponds to an account.
 */
export async function requestPasswordReset(
  client: TypedApiClient,
  payload: PasswordResetRequestDto,
  options: PasswordResetServiceOptions = {},
): Promise<PasswordResetRequestedResponseDto> {
  let result: OpenApiFetchResult<PasswordResetRequestedResponseDto>;

  try {
    result = await client.POST('/auth/password-reset/request', {
      body: payload,
      signal: options.signal,
      credentials: 'omit',
      redirect: 'error',
    });
  } catch (cause) {
    if (
      isPasswordResetCancellation(cause) ||
      !(
        cause instanceof TypeError ||
        (cause instanceof ApiError && cause.kind === 'network')
      )
    ) {
      throw cause;
    }
    throw buildNetworkError(
      cause,
      authMessages.passwordReset.request.errors.network,
    );
  }

  const copy = authMessages.passwordReset.request.errors;
  if (result.error !== undefined || !result.response.ok) {
    const baseError = mapApiError(result.error, result.response);
    if (baseError.kind === 'rate-limited' || baseError.status === 429) {
      throw buildMappedError(baseError, {
        kind: 'rate-limited',
        userMessage: copy.rateLimited,
        fieldErrors: {},
      });
    }
    if (baseError.kind === 'validation') {
      throw buildMappedError(baseError, {
        userMessage: copy.validationFailed,
      });
    }
    throw buildMappedError(baseError, {
      userMessage: copy.unexpected,
      fieldErrors: {},
    });
  }

  const parsed = passwordResetRequestedResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw new ApiError({
      kind: 'unexpected',
      status: result.response.status,
      code: null,
      userMessage: copy.unexpected,
      correlationId: headerCorrelationId,
    });
  }

  return parsed.data;
}

/**
 * Confirms a password reset token and sets a new password via `POST /auth/password-reset/confirm`.
 * Requires HTTP 204 No Content and separates invalid/expired tokens (`400` without
 * `newPassword` field errors) from policy validation, rate-limits, and network uncertainty.
 */
export async function confirmPasswordReset(
  client: TypedApiClient,
  payload: PasswordResetConfirmRequestDto,
  options: PasswordResetServiceOptions = {},
): Promise<void> {
  let result: OpenApiFetchResult<unknown>;
  const copy = authMessages.passwordReset.confirm.errors;

  try {
    result = await client.POST('/auth/password-reset/confirm', {
      body: payload,
      signal: options.signal,
      credentials: 'omit',
      redirect: 'error',
    });
  } catch (cause) {
    if (
      isPasswordResetCancellation(cause) ||
      !(
        cause instanceof TypeError ||
        (cause instanceof ApiError && cause.kind === 'network')
      )
    ) {
      throw cause;
    }
    throw buildNetworkError(cause, copy.network);
  }

  if (result.error !== undefined || !result.response.ok) {
    const baseError = mapApiError(result.error, result.response);
    if (baseError.kind === 'rate-limited' || baseError.status === 429) {
      throw buildMappedError(baseError, {
        kind: 'rate-limited',
        userMessage: copy.rateLimited,
        fieldErrors: {},
      });
    }
    if (
      baseError.kind === 'validation' &&
      Boolean(baseError.fieldErrors.newPassword?.length)
    ) {
      throw buildMappedError(baseError, {
        userMessage: copy.validationFailed,
        fieldErrors: {
          newPassword: baseError.fieldErrors.newPassword,
        },
      });
    }
    if (
      baseError.status === 400 ||
      baseError.kind === 'bad-request' ||
      baseError.kind === 'validation'
    ) {
      throw buildMappedError(baseError, {
        kind: 'bad-request',
        userMessage: copy.invalidOrExpiredToken,
        fieldErrors: {},
      });
    }
    throw buildMappedError(baseError, {
      userMessage: copy.unexpected,
      fieldErrors: {},
    });
  }

  if (result.response.status !== 204) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw new ApiError({
      kind: 'unexpected',
      status: result.response.status,
      code: null,
      userMessage: copy.unexpected,
      correlationId: headerCorrelationId,
    });
  }
}
