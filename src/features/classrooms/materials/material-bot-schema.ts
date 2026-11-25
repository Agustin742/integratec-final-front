import { z } from 'zod';
import type { components } from '@/api/schema.generated';

z.config({ jitless: true });

type GeneratedBotMaterialDto = components['schemas']['BotMaterialDto'];

/**
 * One material allowed for the Study Guide Bot (`HU-BOT-001`). A material with
 * no entry is disabled. `failureReason` is retyped because the published
 * OpenAPI declares it as an object while the server sends a string.
 */
export type BotAllowedMaterialDto = Omit<
  GeneratedBotMaterialDto,
  'failureReason'
> & { readonly failureReason?: string | null };

export type BotIndexState = GeneratedBotMaterialDto['indexState'];

export const botAllowedMaterialDtoSchema: z.ZodType<BotAllowedMaterialDto> =
  z.object({
    id: z.string().uuid(),
    classroomId: z.string().uuid(),
    materialId: z.string().uuid(),
    filename: z.string().min(1),
    contentType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
    sizeBytes: z.number().int(),
    indexState: z.enum(['PENDING', 'INDEXED', 'FAILED']),
    failureReason: z.string().nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
  });

/** One page of `GET /classrooms/{id}/bot/materials`. */
export const botAllowedMaterialPageSchema = z.object({
  items: z.array(botAllowedMaterialDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

/** Every allowed material of a classroom, across all pages. */
export interface BotAllowedMaterialListDto {
  readonly items: readonly BotAllowedMaterialDto[];
}
