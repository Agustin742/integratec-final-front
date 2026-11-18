import { z } from 'zod';
import { DEFAULT_SCHOOL_TIME_ZONE } from '@/lib/dates';
import { classroomMessages } from '../messages';
import {
  activityTitleSchema,
  createActivityPayloadSchema,
  questionInputSchema,
  updateActivityPayloadSchema,
  type CreateActivityPayload,
  type TeacherActivityResponseDto,
  type UpdateActivityValidatedPayload,
} from './activity-schema';
import {
  datetimeLocalToInstantUtc,
  instantToDatetimeLocal,
} from './activity-school-datetime';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export type ActivityTypeValue = 'TP' | 'EXAM';
export type ActivityFormatValue = 'FILE' | 'MULTIPLE_CHOICE';

export interface ActivityEditorOptionInput {
  readonly label: string;
  readonly isCorrect: boolean;
}

export interface ActivityEditorQuestionInput {
  readonly prompt: string;
  readonly options: readonly ActivityEditorOptionInput[];
}

/**
 * Raw editor form values: datetime-local strings entered in the school time
 * zone, numeric fields as the text the inputs hold, and the questions builder
 * rows. Cross-field contract rules (EXAM-only `opensAt` strictly before
 * `dueAt`, required/forbidden questions per format, exactly one correct option
 * per question, weight decimals) are not restated here: the editor schema
 * converts the raw values and pipes them through the existing payload schemas
 * from `activity-schema.ts`, which stay the single source of those rules.
 */
export interface ActivityEditorFormInput {
  readonly type: ActivityTypeValue;
  readonly format: ActivityFormatValue;
  readonly title: string;
  readonly description: string;
  /** datetime-local in the school time zone; '' means absent. */
  readonly opensAt: string;
  /** datetime-local in the school time zone; required. */
  readonly dueAt: string;
  readonly allowLate: boolean;
  readonly maxScore: string;
  readonly weightMultiplier: string;
  readonly questions: readonly ActivityEditorQuestionInput[];
}

export interface ActivityEditorSchemaOptions {
  readonly timeZone?: string;
  /** Edit mode: `null` when the stored activity has no exam window. */
  readonly originalOpensAt?: string | null;
}

const editorMessages = classroomMessages.activities.editor;

/**
 * Numeric entry sanitation only: turns the text a number input holds into a
 * finite number or fails with an editor-level required message. Business
 * bounds (positive score, weight decimals) come from the payload schemas.
 */
function numericEntrySchema(message: string) {
  return z
    .union([z.number(), z.string()])
    .transform((raw) =>
      typeof raw === 'number'
        ? raw
        : raw.trim() === ''
          ? Number.NaN
          : Number(raw),
    )
    .refine((value) => Number.isFinite(value), { message });
}

/**
 * datetime-local entry: `required` decides whether an empty value fails with
 * `requiredMessage`; non-empty values must convert into a real school-zone
 * instant (rejects malformed strings and DST gaps).
 */
function datetimeLocalEntrySchema(
  requiredMessage: string | null,
  options: ActivityEditorSchemaOptions,
) {
  return z.string().superRefine((raw, ctx) => {
    if (raw.trim() === '') {
      if (requiredMessage !== null) {
        ctx.addIssue({ code: 'custom', message: requiredMessage });
      }
      return;
    }
    try {
      datetimeLocalToInstantUtc(raw, { timeZone: options.timeZone });
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.instantInvalid,
      });
    }
  });
}

function editorInputSchema(options: ActivityEditorSchemaOptions) {
  return z.object({
    type: z.enum(['TP', 'EXAM']),
    format: z.enum(['FILE', 'MULTIPLE_CHOICE']),
    // Field-level contract rules are the same schemas the payload schemas use,
    // so a blank submit surfaces title, prompt, label and exactly-one-correct
    // errors together with the editor-level required messages instead of only
    // after every other field parses.
    title: activityTitleSchema,
    description: z.string(),
    opensAt: datetimeLocalEntrySchema(null, options),
    dueAt: datetimeLocalEntrySchema(
      editorMessages.validation.dueAtRequired,
      options,
    ),
    allowLate: z.boolean(),
    maxScore: numericEntrySchema(editorMessages.validation.maxScoreRequired),
    weightMultiplier: numericEntrySchema(
      editorMessages.validation.weightMultiplierRequired,
    ),
    questions: z.array(questionInputSchema),
  });
}

/** Parsed intermediate shape: numeric entries already sanitized to numbers. */
interface EditorParsedValues {
  readonly type: ActivityTypeValue;
  readonly format: ActivityFormatValue;
  readonly title: string;
  readonly description: string;
  readonly opensAt: string;
  readonly dueAt: string;
  readonly allowLate: boolean;
  readonly maxScore: number;
  readonly weightMultiplier: number;
  readonly questions: readonly ActivityEditorQuestionInput[];
}

/** Converts parsed editor values into a payload input (ISO instants). */
function toPayloadInput(
  values: EditorParsedValues,
  options: ActivityEditorSchemaOptions,
) {
  return {
    type: values.type,
    format: values.format,
    title: values.title,
    description: values.description,
    ...(values.opensAt.trim() !== ''
      ? {
          opensAt: datetimeLocalToInstantUtc(values.opensAt, {
            timeZone: options.timeZone,
          }),
        }
      : {}),
    dueAt: datetimeLocalToInstantUtc(values.dueAt, {
      timeZone: options.timeZone,
    }),
    allowLate: values.allowLate,
    maxScore: values.maxScore,
    weightMultiplier: values.weightMultiplier,
    // Only pass questions when there is something to send: the payload
    // schemas reject an empty array for MULTIPLE_CHOICE (required) and any
    // array for FILE (forbidden), so empty builder state must stay absent.
    ...(values.questions.length > 0 ? { questions: values.questions } : {}),
  };
}

function sharedRawChecks(
  options: ActivityEditorSchemaOptions,
): (value: EditorParsedValues, ctx: z.RefinementCtx) => void {
  return (value, ctx) => {
    if (
      options.originalOpensAt !== undefined &&
      options.originalOpensAt !== null &&
      value.opensAt.trim() === ''
    ) {
      // The contract rejects `null` on PATCH, so a defined exam window can be
      // changed but never removed; silently keeping the stored instant while
      // the input shows an empty field would mislead the teacher.
      ctx.addIssue({
        code: 'custom',
        message: editorMessages.validation.opensAtCannotBeRemoved,
        path: ['opensAt'],
      });
    }
  };
}

/** Delegates payload validation to the existing schema, keeping issue paths. */
function delegateToPayloadSchema<Output>(
  payloadSchema: z.ZodType<Output, unknown>,
  payload: unknown,
  ctx: z.RefinementCtx,
): Output {
  const result = payloadSchema.safeParse(payload);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: 'custom',
        message: issue.message,
        path: issue.path,
      });
    }
    return z.NEVER;
  }
  return result.data;
}

/**
 * Create-mode editor schema: raw form values -> ISO payload -> the existing
 * `createActivityPayloadSchema`, which owns every cross-field contract rule.
 */
export function createActivityEditorSchema(
  options: ActivityEditorSchemaOptions = {},
): z.ZodType<CreateActivityPayload, ActivityEditorFormInput> {
  return editorInputSchema(options)
    .superRefine(sharedRawChecks(options))
    .transform((values, ctx) =>
      delegateToPayloadSchema(
        createActivityPayloadSchema,
        toPayloadInput(values, options),
        ctx,
      ),
    ) as z.ZodType<CreateActivityPayload, ActivityEditorFormInput>;
}

/**
 * Edit-mode editor schema: same raw shape, delegating to the existing
 * `updateActivityPayloadSchema`. Type and format are immutable after creation
 * and never leave the form, so they are not revalidated.
 */
export function updateActivityEditorSchema(
  options: ActivityEditorSchemaOptions,
): z.ZodType<UpdateActivityValidatedPayload, ActivityEditorFormInput> {
  return editorInputSchema(options)
    .superRefine(sharedRawChecks(options))
    .transform((values, ctx) =>
      delegateToPayloadSchema(
        updateActivityPayloadSchema,
        toPayloadInput(values, options),
        ctx,
      ),
    ) as z.ZodType<UpdateActivityValidatedPayload, ActivityEditorFormInput>;
}

/** Default create-mode values: TP with file submission, no exam window. */
export function createActivityEditorDefaults(): ActivityEditorFormInput {
  return {
    type: 'TP',
    format: 'FILE',
    title: '',
    description: '',
    opensAt: '',
    dueAt: '',
    allowLate: false,
    maxScore: '',
    weightMultiplier: '1',
    questions: [],
  };
}

/**
 * Edit-mode defaults from the server-confirmed teacher view. Instants become
 * school-zone datetime-local strings; question and option identities are
 * dropped because PATCH replaces the whole set.
 */
export function activityEditorDefaultsFromDetail(
  activity: TeacherActivityResponseDto,
): ActivityEditorFormInput {
  const timeZone = activity.timeZone;
  return {
    type: activity.type,
    format: activity.format,
    title: activity.title,
    description: activity.description,
    opensAt:
      activity.opensAt !== null
        ? instantToDatetimeLocal(activity.opensAt, { timeZone })
        : '',
    dueAt: instantToDatetimeLocal(activity.dueAt, { timeZone }),
    allowLate: activity.allowLate,
    maxScore: String(activity.maxScore),
    weightMultiplier: String(activity.weightMultiplier),
    questions: activity.questions.map((question) => ({
      prompt: question.prompt,
      options: question.options.map((option) => ({
        label: option.label,
        isCorrect: option.isCorrect,
      })),
    })),
  };
}

export { DEFAULT_SCHOOL_TIME_ZONE };
