import type { OpenApiFetchResult, TypedApiClient } from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import { authMessages } from './messages';
import {
  registerResponseSchema,
  type RegisterRequestDto,
  type RegisterResponseDto,
} from './register-schema';

export interface RegisterAccountOptions {
  readonly signal?: AbortSignal;
}

const isAbortError = (cause: unknown): boolean =>
  (cause instanceof Error || cause instanceof DOMException) &&
  cause.name === 'AbortError';

const extractRawErrorMessage = (errorPayload: unknown): string => {
  if (typeof errorPayload !== 'object' || errorPayload === null) {
    return '';
  }
  const innerError = (errorPayload as { error?: unknown }).error;
  if (typeof innerError !== 'object' || innerError === null) {
    return '';
  }
  const message = (innerError as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
};

const translateRegistrationError = (
  baseError: ApiError,
  rawPayload: unknown,
): ApiError => {
  if (baseError.kind === 'conflict' || baseError.status === 409) {
    const rawMessage = extractRawErrorMessage(rawPayload).toLowerCase();

    if (rawMessage.includes('slug')) {
      return new ApiError({
        kind: 'conflict',
        status: baseError.status,
        code: baseError.code,
        userMessage: authMessages.errors.slugConflict,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      });
    }

    if (
      rawMessage.includes('email') ||
      Boolean(baseError.fieldErrors.email?.length)
    ) {
      return new ApiError({
        kind: 'conflict',
        status: baseError.status,
        code: baseError.code,
        userMessage: authMessages.errors.emailConflict,
        details: baseError.details,
        fieldErrors: {
          email: [authMessages.errors.emailConflict],
        },
        correlationId: baseError.correlationId,
      });
    }

    return new ApiError({
      kind: 'conflict',
      status: baseError.status,
      code: baseError.code,
      userMessage: authMessages.errors.genericConflict,
      details: baseError.details,
      fieldErrors: baseError.fieldErrors,
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.kind === 'validation') {
    return new ApiError({
      kind: baseError.kind,
      status: baseError.status,
      code: baseError.code,
      userMessage: authMessages.errors.validationFailed,
      details: baseError.details,
      fieldErrors: baseError.fieldErrors,
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.kind === 'unexpected') {
    return new ApiError({
      kind: baseError.kind,
      status: baseError.status,
      code: baseError.code,
      userMessage: authMessages.errors.unexpected,
      details: baseError.details,
      fieldErrors: baseError.fieldErrors,
      correlationId: baseError.correlationId,
    });
  }

  return baseError;
};

/**
 * Registers a new user account via `POST /auth/register`, translating
 * conflicts/validation errors into centralized Spanish messages and verifying
 * the returned structure with `registerResponseSchema` before confirming success.
 */
export async function registerAccount(
  client: TypedApiClient,
  payload: RegisterRequestDto,
  options: RegisterAccountOptions = {},
): Promise<RegisterResponseDto> {
  let result: OpenApiFetchResult<RegisterResponseDto>;

  try {
    result = await client.POST('/auth/register', {
      body: payload,
      signal: options.signal,
      credentials: 'omit',
      redirect: 'error',
    });
  } catch (cause) {
    if (isAbortError(cause)) {
      throw cause;
    }
    throw mapNetworkError(cause);
  }

  if (result.error !== undefined || !result.response.ok) {
    const baseError = mapApiError(result.error, result.response);
    throw translateRegistrationError(baseError, result.error);
  }

  const parsed = registerResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw new ApiError({
      kind: 'unexpected',
      status: result.response.status,
      code: null,
      userMessage: authMessages.errors.invalidResponse,
      correlationId: headerCorrelationId,
    });
  }

  return parsed.data;
}
