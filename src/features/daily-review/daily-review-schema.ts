import { z } from 'zod';

z.config({ jitless: true });

/**
 * Provisional DTOs for `HU-BOT-003` until
 * `Agustin742/integratec-final-back#42` lands in `src/api/schema.generated.ts`.
 * The server decides eligibility, once-per-day delivery
 * (`America/Argentina/Buenos_Aires`), audience, and whether the content is
 * generated or a structured fallback; the client only renders what it receives
 * (`rules/ai-bot-and-daily-briefing.md`).
 */

export const dailyReviewSectionKindSchema = z.enum(['pending', 'news']);

export type DailyReviewSectionKind = z.infer<
  typeof dailyReviewSectionKindSchema
>;

export const dailyReviewItemKindSchema = z.enum([
  'pending_activity',
  'recent_grade',
  'announcement',
  'teacher_review',
]);

export type DailyReviewItemKind = z.infer<typeof dailyReviewItemKindSchema>;

export interface DailyReviewItemDto {
  readonly kind: DailyReviewItemKind;
  readonly title: string;
  readonly detail: string | null;
  readonly classroomName: string | null;
  /** ISO 8601 instant rendered in the school time zone, never a client-decided date. */
  readonly dueAt: string | null;
}

export const dailyReviewItemDtoSchema: z.ZodType<DailyReviewItemDto> = z.object(
  {
    kind: dailyReviewItemKindSchema,
    title: z.string().trim().min(1),
    detail: z.string().trim().nullable(),
    classroomName: z.string().trim().nullable(),
    dueAt: z.string().datetime({ offset: true }).nullable(),
  },
);

export interface DailyReviewSectionDto {
  readonly kind: DailyReviewSectionKind;
  readonly items: readonly DailyReviewItemDto[];
}

export const dailyReviewSectionDtoSchema: z.ZodType<DailyReviewSectionDto> =
  z.object({
    kind: dailyReviewSectionKindSchema,
    items: z.array(dailyReviewItemDtoSchema),
  });

export interface DailyQuestionDto {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly string[];
  readonly materialTitle: string | null;
}

export const dailyQuestionDtoSchema: z.ZodType<DailyQuestionDto> = z.object({
  id: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2).max(6),
  materialTitle: z.string().trim().nullable(),
});

export const dailyReviewAudienceSchema = z.enum(['STUDENT', 'TEACHER']);

export type DailyReviewAudience = z.infer<typeof dailyReviewAudienceSchema>;

export const dailyReviewContentKindSchema = z.enum(['generated', 'structured']);

export type DailyReviewContentKind = z.infer<
  typeof dailyReviewContentKindSchema
>;

/**
 * `not_due` covers every server-decided non-delivery: already delivered today
 * (reload, another tab), parents, and any state the server does not consider
 * eligible. The client never distinguishes these on its own.
 */
export type DailyReviewResponseDto =
  | { readonly status: 'not_due' }
  | {
      readonly status: 'due';
      readonly audience: DailyReviewAudience;
      readonly contentKind: DailyReviewContentKind;
      readonly summary: string | null;
      readonly sections: readonly DailyReviewSectionDto[];
      /** Present only for students when the server has a question for the day. */
      readonly dailyQuestion: DailyQuestionDto | null;
    };

export const dailyReviewResponseSchema: z.ZodType<DailyReviewResponseDto> =
  z.discriminatedUnion('status', [
    z.object({ status: z.literal('not_due') }),
    z.object({
      status: z.literal('due'),
      audience: dailyReviewAudienceSchema,
      contentKind: dailyReviewContentKindSchema,
      summary: z.string().trim().nullable(),
      sections: z.array(dailyReviewSectionDtoSchema),
      dailyQuestion: dailyQuestionDtoSchema.nullable(),
    }),
  ]);

export interface AnswerDailyReviewQuestionInput {
  readonly questionId: string;
  readonly answer: string;
}

export const answerDailyReviewQuestionInputSchema = z.object({
  questionId: z.string().trim().min(1),
  answer: z.string().trim().min(1),
});

export interface DailyReviewStreakFeedbackDto {
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly lastQualifiedDate: string | null;
}

export const dailyReviewStreakFeedbackSchema: z.ZodType<DailyReviewStreakFeedbackDto> =
  z.object({
    currentStreak: z.number().int().nonnegative(),
    bestStreak: z.number().int().nonnegative(),
    lastQualifiedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  });

export interface DailyQuestionAnswerResultDto {
  readonly correct: boolean;
  readonly feedback: string | null;
  /** Server-confirmed streak state after the answer; rendered only when present. */
  readonly streak: DailyReviewStreakFeedbackDto | null;
}

export const dailyQuestionAnswerResultSchema: z.ZodType<DailyQuestionAnswerResultDto> =
  z.object({
    correct: z.boolean(),
    feedback: z.string().trim().nullable(),
    streak: dailyReviewStreakFeedbackSchema.nullable(),
  });
