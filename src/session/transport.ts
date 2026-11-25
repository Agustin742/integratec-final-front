import { z } from 'zod';
import {
  createApiClient,
  requestApi,
  requestApiVoid,
  type CreateApiClientOptions,
} from '../api/client';
import { ApiError, mapApiError, mapNetworkError } from '../api/errors';
import type { components } from '../api/schema.generated';
import { tokenPairSchema, type TokenPair } from './storage';

export type LoginInput = components['schemas']['LoginRequestDto'];
export type OwnProfile = components['schemas']['OwnProfileDto'];
export type OwnAvatar = components['schemas']['AvatarDto'];
export const avatarSchema = z.object({
  bodyId: z.enum(['male', 'female']),
  hairId: z.enum([
    'buzz-cut',
    'classic-short',
    'short-curls',
    'bob',
    'middle-part',
    'long-straight',
    'ponytail',
    'bun',
    'afro',
    'afro-with-headband',
    'box-braids',
    'braid',
    'dreads',
    'fringe',
    'half-up',
    'long-curls',
    'long-wavy',
    'messy',
    'side-part',
    'soft-mohawk',
    'two-braids',
    'two-pigtails',
    'wavy',
  ]),
  topId: z.enum([
    'school-smock',
    'school-sweatshirt',
    'basic-tshirt',
    'tank-top',
    'denim-jacket',
    'flannel-shirt',
    'holiday-sweater',
    'hoodie',
    'national-team-jersey',
    'school-polo',
    'shirt-and-tie',
    'sweater',
    'track-jacket',
    'vest',
    'winter-coat',
  ]),
  hairColor: z.enum(['#6C4D48', '#AF6D63', '#E5AD58', '#353849', '#C77DAA']),
  clothingColor: z.enum([
    '#5B4F96',
    '#75B7DA',
    '#F2C85C',
    '#EFA5AE',
    '#7EBA8B',
    '#F4E6D2',
  ]),
}) satisfies z.ZodType<OwnAvatar>;
export const profileSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  displayName: z.string().min(1),
  avatar: avatarSchema,
}) satisfies z.ZodType<OwnProfile>;

// Never propagate raw fetch exceptions, validation payloads or server diagnostics from auth.
export function safeSessionError(error?: unknown): ApiError {
  if (error instanceof ApiError && error.status !== null) {
    return mapApiError(undefined, {
      status: error.status,
      headers: new Headers(),
    });
  }
  return error instanceof ApiError && error.kind === 'network'
    ? mapNetworkError(undefined)
    : mapApiError(undefined);
}

export function createAuthTransport(options: CreateApiClientOptions) {
  const client = createApiClient(options);
  async function validate(
    execute: () => Promise<TokenPair>,
    preserveLoginMetadata = false,
  ): Promise<TokenPair> {
    let payload: unknown;
    try {
      payload = await execute();
    } catch (error) {
      const safe = safeSessionError(error);
      if (
        preserveLoginMetadata &&
        error instanceof ApiError &&
        error.status !== 401
      ) {
        throw new ApiError({
          ...safe,
          fieldErrors: error.fieldErrors,
          correlationId: error.correlationId,
        });
      }
      throw safe;
    }
    const parsed = tokenPairSchema.safeParse(payload);
    if (!parsed.success) throw safeSessionError();
    return parsed.data;
  }
  return {
    login: (body: LoginInput, signal: AbortSignal): Promise<TokenPair> =>
      validate(
        () =>
          requestApi(() =>
            client.POST('/auth/login', {
              body,
              signal,
              credentials: 'omit',
              redirect: 'error',
            }),
          ),
        true,
      ),
    refresh: (refreshToken: string, signal: AbortSignal): Promise<TokenPair> =>
      validate(() =>
        requestApi(() =>
          client.POST('/auth/refresh', {
            body: { refreshToken },
            signal,
            credentials: 'omit',
            redirect: 'error',
          }),
        ),
      ),
    async logout(accessToken: string, signal: AbortSignal): Promise<void> {
      try {
        await requestApiVoid(async () => {
          const result = await client.POST('/auth/logout', {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal,
            credentials: 'omit',
            redirect: 'error',
          });
          if (result.response.ok && result.response.status !== 204)
            throw safeSessionError();
          return result;
        });
      } catch (error) {
        throw safeSessionError(error);
      }
    },
  };
}
