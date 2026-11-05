import type { components } from './schema.generated';
import { apiErrorMessages } from './messages';

export type BackendErrorCode = components['schemas']['ErrorCode'];
export type BackendErrorDetail = components['schemas']['ErrorDetail'];
export type BackendErrorBody = components['schemas']['ErrorBody'];
export type BackendErrorEnvelope = components['schemas']['ErrorEnvelope'];

export type ApiErrorKind =
  | 'validation'
  | 'bad-request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'network'
  | 'unexpected';

const KNOWN_ERROR_CODES: ReadonlySet<BackendErrorCode> = new Set([
  'VALIDATION_FAILED',
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export interface ApiErrorInit {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: BackendErrorCode | null;
  readonly userMessage: string;
  readonly details?: readonly BackendErrorDetail[];
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly correlationId?: string | null;
  readonly cause?: unknown;
}

/**
 * Typed frontend API error mapped from the backend `ErrorEnvelope`, HTTP status,
 * or network failure. Network failures never set `isInvalidCredentials: true`.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: BackendErrorCode | null;
  readonly userMessage: string;
  readonly details: readonly BackendErrorDetail[];
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly correlationId: string | null;
  readonly isInvalidCredentials: boolean;

  constructor(init: ApiErrorInit) {
    super(
      init.userMessage,
      init.cause !== undefined ? { cause: init.cause } : undefined,
    );
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.userMessage = init.userMessage;
    this.details = Object.freeze([...(init.details ?? [])]);
    this.fieldErrors = Object.freeze({ ...(init.fieldErrors ?? {}) });
    this.correlationId = init.correlationId ?? null;
    this.isInvalidCredentials = init.kind === 'unauthenticated';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isBackendErrorCode = (value: unknown): value is BackendErrorCode =>
  typeof value === 'string' && KNOWN_ERROR_CODES.has(value as BackendErrorCode);

const parseErrorDetails = (raw: unknown): BackendErrorDetail[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  const details: BackendErrorDetail[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.field !== 'string') {
      continue;
    }
    const field = item.field.trim();
    if (field === '' || !Array.isArray(item.messages)) {
      continue;
    }
    const messages = item.messages.filter(
      (msg): msg is string => typeof msg === 'string' && msg.trim() !== '',
    );
    if (messages.length > 0) {
      details.push({ field, messages });
    }
  }
  return details;
};

const buildFieldErrorMap = (
  details: readonly BackendErrorDetail[],
): Readonly<Record<string, readonly string[]>> => {
  const map: Record<string, string[]> = {};
  for (const detail of details) {
    const existing = map[detail.field] ?? [];
    map[detail.field] = [...existing, ...detail.messages];
  }
  const frozen: Record<string, readonly string[]> = {};
  for (const [field, messages] of Object.entries(map)) {
    frozen[field] = Object.freeze(messages);
  }
  return Object.freeze(frozen);
};

interface ParsedEnvelope {
  readonly code: BackendErrorCode | null;
  readonly details: readonly BackendErrorDetail[];
  readonly correlationId: string | null;
}

const parseErrorEnvelope = (payload: unknown): ParsedEnvelope => {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return { code: null, details: [], correlationId: null };
  }
  const errorObj = payload.error;
  const code = isBackendErrorCode(errorObj.code) ? errorObj.code : null;
  const details = parseErrorDetails(errorObj.details);
  const correlationId =
    typeof errorObj.correlationId === 'string' &&
    errorObj.correlationId.trim() !== ''
      ? errorObj.correlationId.trim()
      : null;

  return { code, details, correlationId };
};

const resolveKindAndMessage = (
  code: BackendErrorCode | null,
  status: number | null,
  hasFieldDetails: boolean,
): { kind: ApiErrorKind; userMessage: string } => {
  if (code === 'VALIDATION_FAILED' || (status === 400 && hasFieldDetails)) {
    return { kind: 'validation', userMessage: apiErrorMessages.validation };
  }
  if (code === 'BAD_REQUEST' || status === 400) {
    return { kind: 'bad-request', userMessage: apiErrorMessages.badRequest };
  }
  if (code === 'UNAUTHENTICATED' || status === 401) {
    return {
      kind: 'unauthenticated',
      userMessage: apiErrorMessages.unauthenticated,
    };
  }
  if (code === 'FORBIDDEN' || status === 403) {
    return { kind: 'forbidden', userMessage: apiErrorMessages.forbidden };
  }
  if (code === 'NOT_FOUND' || status === 404) {
    return { kind: 'not-found', userMessage: apiErrorMessages.notFound };
  }
  if (code === 'CONFLICT' || status === 409) {
    return { kind: 'conflict', userMessage: apiErrorMessages.conflict };
  }
  if (code === 'TOO_MANY_REQUESTS' || status === 429) {
    return { kind: 'rate-limited', userMessage: apiErrorMessages.rateLimited };
  }
  return { kind: 'unexpected', userMessage: apiErrorMessages.unexpected };
};

/**
 * Maps an HTTP error response and parsed body (matching `ErrorEnvelope` when present)
 * into a typed `ApiError`.
 *
 * Policy:
 * - `404` / `NOT_FOUND` -> `'not-found'` without revealing foreign resources.
 * - `403` / `FORBIDDEN` -> `'forbidden'` indicating insufficient role permissions.
 * - `400` / `VALIDATION_FAILED` -> `'validation'` with `fieldErrors` keyed by dotted field path.
 */
export function mapApiError(
  errorPayload: unknown,
  response?: Pick<Response, 'status' | 'headers'>,
): ApiError {
  if (errorPayload instanceof ApiError) {
    return errorPayload;
  }

  const status = response?.status ?? null;
  const headerCorrelationId =
    response?.headers?.get('x-request-id')?.trim() || null;
  const parsed = parseErrorEnvelope(errorPayload);
  const fieldErrors = buildFieldErrorMap(parsed.details);
  const { kind, userMessage } = resolveKindAndMessage(
    parsed.code,
    status,
    parsed.details.length > 0,
  );

  return new ApiError({
    kind,
    status,
    code: parsed.code,
    userMessage,
    details: parsed.details,
    fieldErrors,
    correlationId: parsed.correlationId ?? headerCorrelationId,
  });
}

/**
 * Maps a fetch/transport failure into a `'network'` `ApiError`.
 * Network errors are never treated as invalid credentials (`isInvalidCredentials === false`).
 */
export function mapNetworkError(cause: unknown): ApiError {
  if (cause instanceof ApiError) {
    return cause;
  }
  return new ApiError({
    kind: 'network',
    status: null,
    code: null,
    userMessage: apiErrorMessages.network,
    cause,
  });
}
