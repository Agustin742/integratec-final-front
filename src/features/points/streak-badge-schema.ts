import { z } from 'zod';
import type { components } from '@/api/schema.generated';

z.config({ jitless: true });

export type BadgeItemDto = components['schemas']['EarnedBadgeDto'];

export type OwnStreakAndBadgesDto =
  components['schemas']['GamificationSummaryDto'];

export const badgeItemDtoSchema: z.ZodType<BadgeItemDto> = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  awardedAt: z.string().datetime({ offset: true }),
});

export const ownStreakAndBadgesSchema: z.ZodType<OwnStreakAndBadgesDto> =
  z.object({
    streak: z.object({
      currentStreak: z.number().int().nonnegative(),
      bestStreak: z.number().int().nonnegative(),
      lastQualifyingDay: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    }),
    badges: z.array(badgeItemDtoSchema),
  });
