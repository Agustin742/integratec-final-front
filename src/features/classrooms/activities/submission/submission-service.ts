import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import { getPublicConfig } from '@/config/public-config';
import { submissionMessages } from './submission-messages';
import {
  submissionDownloadDtoSchema,
  submissionResponseDtoSchema,
  type SubmissionDownloadResponseDto,
  type SubmissionResponseDto,
} from './submission-schema';

/** Maximum number of files per submission (`CreateSubmissionBodyDto`). */
export const MAX_SUBMISSION_FILES = 5;
/** Maximum size of a single file per the contract (10 MB). */
export const MAX_SUBMISSION_FILE_BYTES = 10 * 1024 * 1024;
/**
 * Extensions the client pre-checks for usability; the server verifies the bytes.
 * Exported so the submission panel's pre-checks reuse the exact same set.
 */
export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'docx',
]);

/**
 * Bearer access the upload needs. Structurally satisfied by the session
 * controller; kept minimal so the upload does not depend on the whole session.
 */
export interface SubmissionSessionPort {
  /** Returns the current access token, or `undefined` while unavailable. */
  readonly getAccessToken: () => string | undefined;
  /** Refreshes the access token; resolves with the new token or `undefined`. */
  readonly refreshAccessToken: () => Promise<string | undefined>;
}

export interface ReadOwnSubmissionOptions {
  readonly signal?: AbortSignal;
}

export interface SubmitFilesOptions {
  /** Overrides the API base URL; defaults to the validated public config. */
  readonly baseUrl?: string;
  /**
   * Client-generated key (1-255 characters, a UUID is recommended). Reused
   * across retries of the same attempt so the server reconciles instead of
   * duplicating the submission.
   */
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal;
  readonly onProgress?: (loaded: number, total: number) => void;
}

const uncertainSubmissionErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when a submission attempt failed with an outcome-uncertain
 * result (transport/network failure or `5xx`), meaning the UI must reconcile
 * the outcome with the server before offering a resubmission.
 */
export function isUncertainSubmissionError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainSubmissionErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainSubmissionErrors.add(error);
  return error;
}

function validationFailure(userMessage: string): ApiError {
  return new ApiError({
    kind: 'validation',
    status: null,
    code: null,
    userMessage,
    fieldErrors: {},
  });
}

function validateSubmissionInput(
  files: readonly File[],
  idempotencyKey: string,
): void {
  const key = idempotencyKey.trim();
  if (key.length < 1 || key.length > 255) {
    throw validationFailure(submissionMessages.validation.idempotencyKey);
  }
  if (files.length < 1 || files.length > MAX_SUBMISSION_FILES) {
    throw validationFailure(submissionMessages.validation.count);
  }
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw validationFailure(submissionMessages.validation.type);
    }
    if (file.size > MAX_SUBMISSION_FILE_BYTES) {
      throw validationFailure(submissionMessages.validation.size);
    }
  }
}

/**
 * Reads the calling student's own submission with short-lived signed download
 * URLs (`GET /activities/{activityId}/submissions/me`). The response is not
 * cacheable per the contract.
 */
export async function readOwnSubmission(
  client: TypedApiClient,
  activityId: string,
  options: ReadOwnSubmissionOptions = {},
): Promise<SubmissionDownloadResponseDto> {
  const raw = await requestApi(() =>
    client.GET('/activities/{activityId}/submissions/me', {
      params: { path: { activityId } },
      signal: options.signal,
    }),
  );

  const parsed = submissionDownloadDtoSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: submissionMessages.serverErrors.unexpected,
    });
  }
  return parsed.data;
}

function parseJsonBody(text: string): unknown {
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function parseXhrHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      headers.append(
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim(),
      );
    }
  }
  return headers;
}

function mapXhrError(xhr: XMLHttpRequest): ApiError {
  return mapApiError(parseJsonBody(xhr.responseText), {
    status: xhr.status,
    headers: parseXhrHeaders(xhr.getAllResponseHeaders()),
  });
}

function withUserMessage(base: ApiError, userMessage: string): ApiError {
  return new ApiError({
    kind: base.kind,
    status: base.status,
    code: base.code,
    userMessage,
    details: base.details,
    fieldErrors: {},
    correlationId: base.correlationId,
  });
}

/**
 * Translates contract `409`/`400`/`403`/`413` submissions failures into
 * feature copy. Branches on the machine-readable code and the detail field,
 * never on the server message text.
 */
function translateSubmissionError(base: ApiError): ApiError {
  const fields = base.details.map((detail) => detail.field);

  if (base.status === 413) {
    return withUserMessage(base, submissionMessages.validation.size);
  }
  if (base.status === 403) {
    return withUserMessage(base, submissionMessages.serverErrors.forbidden);
  }
  if (base.status === 409) {
    if (fields.includes('idempotencyKey')) {
      return withUserMessage(base, submissionMessages.serverErrors.duplicate);
    }
    if (fields.includes('opensAt')) {
      return withUserMessage(
        base,
        submissionMessages.serverErrors.windowNotOpen,
      );
    }
    if (fields.includes('format')) {
      return withUserMessage(
        base,
        submissionMessages.serverErrors.notFileActivity,
      );
    }
    return withUserMessage(base, submissionMessages.serverErrors.windowClosed);
  }
  if (base.code === 'VALIDATION_FAILED') {
    return withUserMessage(base, submissionMessages.validation.type);
  }
  if (base.status === 400 || base.code === 'BAD_REQUEST') {
    if (fields.includes('idempotencyKey')) {
      return withUserMessage(
        base,
        submissionMessages.validation.idempotencyKey,
      );
    }
    return withUserMessage(base, submissionMessages.validation.count);
  }
  return base;
}

/**
 * Uploads the student's files (`POST /activities/{activityId}/submissions`)
 * through `XMLHttpRequest` so the caller can observe real upload progress and
 * cancel in flight. Uses one bearer token; a `401` refreshes the token once
 * and replays the same idempotency key, which the server reconciles instead
 * of storing a duplicate.
 */
export async function submitActivityFiles(
  session: SubmissionSessionPort,
  activityId: string,
  files: readonly File[],
  options: SubmitFilesOptions,
): Promise<SubmissionResponseDto> {
  validateSubmissionInput(files, options.idempotencyKey);
  if (options.signal?.aborted) {
    throw new DOMException('Submission aborted', 'AbortError');
  }
  const baseUrl = (options.baseUrl ?? getPublicConfig().apiBaseUrl).replace(
    /\/+$/,
    '',
  );
  const url = `${baseUrl}/activities/${encodeURIComponent(activityId)}/submissions`;
  return submitWithSession(session, url, files, options, 0);
}

function submitWithSession(
  session: SubmissionSessionPort,
  url: string,
  files: readonly File[],
  options: SubmitFilesOptions,
  attempt: number,
): Promise<SubmissionResponseDto> {
  const accessToken = session.getAccessToken();
  return new Promise<SubmissionResponseDto>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => {
      xhr.abort();
    };
    const signal = options.signal;
    signal?.addEventListener('abort', abort, { once: true });
    const detach = () => signal?.removeEventListener('abort', abort);

    xhr.open('POST', url);
    if (accessToken !== undefined) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    }
    xhr.setRequestHeader('Idempotency-Key', options.idempotencyKey.trim());
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      detach();
      if (xhr.status === 200 || xhr.status === 201) {
        const parsed = submissionResponseDtoSchema.safeParse(
          parseJsonBody(xhr.responseText),
        );
        if (!parsed.success) {
          reject(
            new ApiError({
              kind: 'unexpected',
              status: xhr.status,
              code: null,
              userMessage: submissionMessages.serverErrors.unexpected,
              fieldErrors: {},
            }),
          );
          return;
        }
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        options.onProgress?.(totalBytes, totalBytes);
        resolve(parsed.data);
        return;
      }
      if (xhr.status === 401 && attempt === 0) {
        void session
          .refreshAccessToken()
          .then((refreshed) => {
            if (refreshed === undefined) {
              reject(mapXhrError(xhr));
              return;
            }
            submitWithSession(session, url, files, options, 1).then(
              resolve,
              reject,
            );
          })
          .catch(() => {
            reject(mapXhrError(xhr));
          });
        return;
      }
      const error = translateSubmissionError(mapXhrError(xhr));
      reject(isUncertainSubmissionError(error) ? markUncertain(error) : error);
    };
    xhr.onerror = () => {
      detach();
      // A transport failure never proves the write failed; keep it uncertain.
      reject(markUncertain(mapNetworkError(undefined)));
    };
    xhr.onabort = () => {
      detach();
      reject(new DOMException('Submission aborted', 'AbortError'));
    };

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }
    xhr.send(formData);
  });
}
