import { z } from 'zod';

z.config({ jitless: true });

/**
 * Provisional DTO for `HU-GAM-002` until `Agustin742/integratec-final-back#33`
 * lands in `src/api/schema.generated.ts`.
 */
export interface BadgeItemDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly unlocked: boolean;
  readonly unlockedAt: string | null;
}

export const badgeItemDtoSchema: z.ZodType<BadgeItemDto> = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  unlocked: z.boolean(),
  unlockedAt: z.string().datetime({ offset: true }).nullable(),
});

export interface OwnStreakAndBadgesDto {
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly lastQualifiedDate: string | null;
  readonly badges: readonly BadgeItemDto[];
}

export const ownStreakAndBadgesSchema: z.ZodType<OwnStreakAndBadgesDto> =
  z.object({
    currentStreak: z.number().int().nonnegative(),
    bestStreak: z.number().int().nonnegative(),
    lastQualifiedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    badges: z.array(badgeItemDtoSchema),
  });
