import { z } from 'zod';

z.config({ jitless: true });

export const BOT_MAX_QUESTION_LENGTH = 2000;

export const botCitationDtoSchema = z.object({
  materialId: z.string().uuid(),
  filename: z.string().trim().min(1),
  excerpt: z.string().trim().nullable().optional(),
});

export type BotCitationDto = z.infer<typeof botCitationDtoSchema>;

export const botStatusReasonSchema = z.enum([
  'exam_in_progress',
  'no_materials',
  'disabled',
]);

export type BotStatusReason = z.infer<typeof botStatusReasonSchema>;

/**
 * Provisional DTO for `GET /classrooms/{id}/bot/status` (`HU-BOT-002`) until
 * `Agustin742/integratec-final-back#41` lands in `src/api/schema.generated.ts`.
 */
export interface BotStatusDto {
  readonly available: boolean;
  readonly reason: BotStatusReason | null;
  readonly message: string | null;
}

export const botStatusDtoSchema: z.ZodType<BotStatusDto> = z.object({
  available: z.boolean(),
  reason: botStatusReasonSchema.nullable(),
  message: z.string().trim().nullable(),
});

export const botAnswerOutcomeSchema = z.enum([
  'answered',
  'out_of_scope',
  'guided_only',
]);

export type BotAnswerOutcome = z.infer<typeof botAnswerOutcomeSchema>;

export interface BotAnswerDto {
  readonly id: string;
  readonly answer: string;
  readonly outcome: BotAnswerOutcome;
  readonly citations: readonly BotCitationDto[];
  readonly createdAt: string;
}

export const botAnswerDtoSchema: z.ZodType<BotAnswerDto> = z.object({
  id: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  outcome: botAnswerOutcomeSchema,
  citations: z.array(botCitationDtoSchema),
  createdAt: z.string().datetime({ offset: true }),
});

export const askStudyGuideBotInputSchema = z.object({
  question: z.string().trim().min(1).max(BOT_MAX_QUESTION_LENGTH),
});

export type AskStudyGuideBotInput = z.infer<typeof askStudyGuideBotInputSchema>;
