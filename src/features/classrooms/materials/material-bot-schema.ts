import { z } from 'zod';

z.config({ jitless: true });

export const BOT_INDEXING_STATUSES = [
  'disabled',
  'pending',
  'ready',
  'failed',
] as const;

export type BotIndexingStatus = (typeof BOT_INDEXING_STATUSES)[number];

export const botIndexingStatusSchema = z.enum(BOT_INDEXING_STATUSES);

/**
 * Provisional DTO for `HU-BOT-001` until `Agustin742/integratec-final-back#40`
 * lands in `src/api/schema.generated.ts`.
 */
export interface BotAllowedMaterialDto {
  readonly materialId: string;
  readonly classroomId: string;
  readonly botEnabled: boolean;
  readonly indexingStatus: BotIndexingStatus;
  readonly indexingError?: string | null;
  readonly updatedAt: string;
}

export const botAllowedMaterialDtoSchema: z.ZodType<BotAllowedMaterialDto> =
  z.object({
    materialId: z.string().uuid(),
    classroomId: z.string().uuid(),
    botEnabled: z.boolean(),
    indexingStatus: botIndexingStatusSchema,
    indexingError: z.string().trim().nullable().optional(),
    updatedAt: z.string().datetime({ offset: true }),
  });

export interface BotAllowedMaterialListDto {
  readonly items: readonly BotAllowedMaterialDto[];
}

export const botAllowedMaterialListSchema: z.ZodType<BotAllowedMaterialListDto> =
  z.object({
    items: z.array(botAllowedMaterialDtoSchema),
  });

export interface SetBotMaterialEnabledInput {
  readonly enabled: boolean;
}
