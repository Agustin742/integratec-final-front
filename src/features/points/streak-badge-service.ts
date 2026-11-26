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
 * Fetches the authenticated user's server-computed daily study streak and
 * earned badges (`HU-GAM-002`). Never computes, increments, or awards
 * values client-side.
 */
export async function fetchOwnStreakAndBadges(
  client: TypedApiClient,
  options: StreakBadgeServiceOptions = {},
): Promise<OwnStreakAndBadgesDto> {
  const raw: unknown = await requestApi(() =>
    client.GET('/gamification/me', {
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
