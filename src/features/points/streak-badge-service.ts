import type { Client } from 'openapi-fetch';
import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { pointsMessages } from './messages';
import {
  ownStreakAndBadgesSchema,
  type OwnStreakAndBadgesDto,
} from './streak-badge-schema';

export interface StreakBadgeServiceOptions {
  readonly signal?: AbortSignal;
}

/**
 * Provisional OpenAPI path shape for `HU-GAM-002` until
 * `Agustin742/integratec-final-back#33` lands in `src/api/schema.generated.ts`.
 */
interface StreakAndBadgesPaths {
  '/users/me/streak-and-badges': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': OwnStreakAndBadgesDto;
          };
        };
      };
    };
  };
}

function asGamificationClient(
  client: TypedApiClient,
): Client<StreakAndBadgesPaths> {
  return client as unknown as Client<StreakAndBadgesPaths>;
}

/**
 * Fetches the authenticated user's server-computed daily study streak and
 * earned/locked badges (`HU-GAM-002`). Never computes, increments, or awards
 * values client-side.
 */
export async function fetchOwnStreakAndBadges(
  client: TypedApiClient,
  options: StreakBadgeServiceOptions = {},
): Promise<OwnStreakAndBadgesDto> {
  const gamificationClient = asGamificationClient(client);
  const raw: unknown = await requestApi(() =>
    gamificationClient.GET('/users/me/streak-and-badges', {
      signal: options.signal,
    }),
  );

  const parsed = ownStreakAndBadgesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: pointsMessages.streakAndBadges.unexpectedError,
      cause: parsed.error,
    });
  }
  return parsed.data;
}
