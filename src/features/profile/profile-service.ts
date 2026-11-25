import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError, mapNetworkError } from '@/api/errors';
import { avatarSchema, profileSchema } from '@/session/transport';
import type { Avatar } from './avatar-options';
import { profileMessages } from './messages';
import {
  avatarStylesSchema,
  type AvatarStyles,
  type OwnProfileDto,
} from './profile-schema';

export interface ProfileRequestOptions {
  readonly signal?: AbortSignal;
}

export const isAbortError = (cause: unknown): boolean =>
  (cause instanceof Error || cause instanceof DOMException) &&
  cause.name === 'AbortError';

function copyError(
  base: ApiError,
  userMessage: string,
  keepFieldErrors = true,
): ApiError {
  return new ApiError({
    kind: base.kind,
    status: base.status,
    code: base.code,
    userMessage,
    details: base.details,
    fieldErrors: keepFieldErrors ? base.fieldErrors : {},
    correlationId: base.correlationId,
    cause: base.cause,
  });
}

/**
 * A write whose outcome cannot be read is uncertain: the server may have
 * stored the change even though the response never arrived or was unusable.
 * It is reported as a `network` error so callers reconcile with
 * `GET /users/me` before claiming success or repeating the write
 * (`rules/error-handling-and-feedback.md`, `rules/avatars-and-customization.md`).
 */
const uncertainWriteError = (cause?: unknown): ApiError =>
  new ApiError({
    kind: 'network',
    status: null,
    code: null,
    userMessage: profileMessages.errors.networkUncertain,
    cause,
  });

function translateWriteError(
  error: ApiError,
  forbiddenMessage: string = profileMessages.errors.forbidden,
): ApiError {
  if (error.kind === 'network') {
    return copyError(error, profileMessages.errors.networkUncertain, false);
  }
  if (error.kind === 'forbidden') {
    return copyError(error, forbiddenMessage, false);
  }
  if (error.kind === 'validation') {
    return copyError(error, profileMessages.errors.validation);
  }
  if (error.kind === 'unexpected') {
    return copyError(error, profileMessages.errors.unexpected, false);
  }
  return error;
}

async function writeRequest<TData>(
  execute: () => Promise<TData>,
  forbiddenMessage?: string,
): Promise<TData> {
  try {
    return await execute();
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    if (cause instanceof ApiError) {
      throw translateWriteError(cause, forbiddenMessage);
    }
    throw translateWriteError(mapNetworkError(cause), forbiddenMessage);
  }
}

/** `GET /users/me`: confirmed profile and base avatar for the active session. */
export async function fetchOwnProfile(
  client: TypedApiClient,
  options: ProfileRequestOptions = {},
): Promise<OwnProfileDto> {
  const payload: unknown = await requestApi(() =>
    client.GET('/users/me', { signal: options.signal }),
  );
  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: profileMessages.errors.invalidResponse,
    });
  }
  return parsed.data;
}

/** `GET /users/me/avatar/styles`: which hair and top styles the user owns. */
export async function fetchAvatarStyles(
  client: TypedApiClient,
  options: ProfileRequestOptions = {},
): Promise<AvatarStyles> {
  const payload: unknown = await requestApi(() =>
    client.GET('/users/me/avatar/styles', { signal: options.signal }),
  );
  const parsed = avatarStylesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: profileMessages.errors.invalidResponse,
    });
  }
  return parsed.data;
}

/** `PATCH /users/me/profile`: changes only the display name. */
export function saveDisplayName(
  client: TypedApiClient,
  displayName: string,
  options: ProfileRequestOptions = {},
): Promise<OwnProfileDto> {
  return writeRequest(async () => {
    const payload: unknown = await requestApi(() =>
      client.PATCH('/users/me/profile', {
        body: { displayName },
        signal: options.signal,
      }),
    );
    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) throw uncertainWriteError();
    return parsed.data;
  });
}

/** `PATCH /users/me/avatar`: replaces the whole base avatar (five fields). */
export function saveAvatar(
  client: TypedApiClient,
  avatar: Avatar,
  options: ProfileRequestOptions = {},
): Promise<Avatar> {
  return writeRequest(async () => {
    const payload: unknown = await requestApi(() =>
      client.PATCH('/users/me/avatar', {
        body: avatar,
        signal: options.signal,
      }),
    );
    const parsed = avatarSchema.safeParse(payload);
    if (!parsed.success) throw uncertainWriteError();
    return parsed.data;
  }, profileMessages.avatar.errors.styleLocked);
}
