import { describe, expect, test } from 'vitest';
import {
  ACTIVITY_LIMITS,
  createActivityPayloadSchema,
  updateActivityPayloadSchema,
} from './activity-schema';
import { activityMessages } from './messages';

const validDueAt = '2026-12-01T23:59:59.000Z';
const validOpensAt = '2026-11-25T12:00:00.000Z';

const validFileTpPayload = {
  type: 'TP',
  format: 'FILE',
  title: 'Trabajo práctico de síntesis',
  description: 'Adjuntá un PDF con el desarrollo completo.',
  dueAt: validDueAt,
  allowLate: true,
  maxScore: 100,
  weightMultiplier: 1,
};

const validMcqExamPayload = {
  type: 'EXAM',
  format: 'MULTIPLE_CHOICE',
  title: 'Examen parcial',
  description: 'Evaluación de la unidad 3.',
  opensAt: validOpensAt,
  dueAt: validDueAt,
  allowLate: false,
  maxScore: 50,
  weightMultiplier: 1.5,
  questions: [
    {
      prompt: '¿Cuál es la capital de Francia?',
      options: [
        { label: 'París', isCorrect: true },
        { label: 'Londres', isCorrect: false },
      ],
    },
  ],
};

describe('createActivityPayloadSchema', () => {
  test('accepts a valid FILE TP payload without questions and explicit offset instants', () => {
    const parsed = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      dueAt: '2026-12-01T20:59:59-03:00',
    });
    expect(parsed.success).toBe(true);
  });

  test('accepts a valid MULTIPLE_CHOICE EXAM payload with one window and questions', () => {
    const parsed = createActivityPayloadSchema.safeParse(validMcqExamPayload);
    expect(parsed.success).toBe(true);
  });

  test('rejects a missing, blank, or overly long title and overly long description', () => {
    const missing = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      title: undefined,
    });
    expect(missing.success).toBe(false);

    const blank = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      title: '   ',
    });
    expect(blank.success).toBe(false);
    if (!blank.success) {
      expect(blank.error.issues[0].message).toBe(
        activityMessages.validation.titleRequired,
      );
    }

    const tooLongTitle = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      title: 'A'.repeat(ACTIVITY_LIMITS.titleMax + 1),
    });
    expect(tooLongTitle.success).toBe(false);
    if (!tooLongTitle.success) {
      expect(tooLongTitle.error.issues[0].message).toBe(
        activityMessages.validation.titleTooLong,
      );
    }

    const tooLongDescription = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      description: 'D'.repeat(ACTIVITY_LIMITS.descriptionMax + 1),
    });
    expect(tooLongDescription.success).toBe(false);
    if (!tooLongDescription.success) {
      expect(tooLongDescription.error.issues[0].message).toBe(
        activityMessages.validation.descriptionTooLong,
      );
    }
  });

  test('rejects opensAt on a TP activity', () => {
    const parsed = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      opensAt: validOpensAt,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        activityMessages.validation.opensAtOnlyForExams,
      );
    }
  });

  test('rejects opensAt on or after dueAt', () => {
    const same = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      opensAt: validDueAt,
    });
    expect(same.success).toBe(false);
    if (!same.success) {
      expect(same.error.issues[0].message).toBe(
        activityMessages.validation.opensAtBeforeDueAt,
      );
    }

    const after = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      opensAt: '2026-12-02T00:00:00.000Z',
    });
    expect(after.success).toBe(false);
  });

  test('enforces MULTIPLE_CHOICE question bounds (1..50) and forbids questions on FILE', () => {
    const withoutQuestions = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: undefined,
    });
    expect(withoutQuestions.success).toBe(false);
    if (!withoutQuestions.success) {
      expect(withoutQuestions.error.issues[0].message).toBe(
        activityMessages.validation.questionsRequired,
      );
    }

    const tooManyQuestions = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: Array.from(
        { length: ACTIVITY_LIMITS.questions.max + 1 },
        (_, idx) => ({
          prompt: `Pregunta ${idx + 1}`,
          options: [
            { label: 'Sí', isCorrect: true },
            { label: 'No', isCorrect: false },
          ],
        }),
      ),
    });
    expect(tooManyQuestions.success).toBe(false);
    if (!tooManyQuestions.success) {
      expect(tooManyQuestions.error.issues[0].message).toBe(
        activityMessages.validation.questionsTooMany,
      );
    }

    const onFile = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      questions: validMcqExamPayload.questions,
    });
    expect(onFile.success).toBe(false);
    if (!onFile.success) {
      expect(onFile.error.issues[0].message).toBe(
        activityMessages.validation.questionsForbiddenForFile,
      );
    }
  });

  test('enforces option count bounds (2..6) and exactly one correct option per question', () => {
    const oneOption = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: [
        {
          prompt: '¿2+2?',
          options: [{ label: '4', isCorrect: true }],
        },
      ],
    });
    expect(oneOption.success).toBe(false);
    if (!oneOption.success) {
      expect(oneOption.error.issues[0].message).toBe(
        activityMessages.validation.optionsMin,
      );
    }

    const sevenOptions = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: [
        {
          prompt: '¿2+2?',
          options: Array.from(
            { length: ACTIVITY_LIMITS.options.max + 1 },
            (_, idx) => ({
              label: `Opción ${idx + 1}`,
              isCorrect: idx === 0,
            }),
          ),
        },
      ],
    });
    expect(sevenOptions.success).toBe(false);
    if (!sevenOptions.success) {
      expect(sevenOptions.error.issues[0].message).toBe(
        activityMessages.validation.optionsMax,
      );
    }

    const zeroCorrect = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: [
        {
          prompt: '¿2+2?',
          options: [
            { label: '3', isCorrect: false },
            { label: '4', isCorrect: false },
          ],
        },
      ],
    });
    expect(zeroCorrect.success).toBe(false);
    if (!zeroCorrect.success) {
      expect(zeroCorrect.error.issues[0].message).toBe(
        activityMessages.validation.exactlyOneCorrectOption,
      );
    }

    const multipleCorrect = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: [
        {
          prompt: '¿2+2?',
          options: [
            { label: '3', isCorrect: false },
            { label: '4', isCorrect: true },
            { label: 'cuatro', isCorrect: true },
          ],
        },
      ],
    });
    expect(multipleCorrect.success).toBe(false);
    if (!multipleCorrect.success) {
      expect(multipleCorrect.error.issues[0].message).toBe(
        activityMessages.validation.exactlyOneCorrectOption,
      );
    }
  });

  test('rejects blank or overly long question prompts and option labels', () => {
    const blank = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: [
        {
          prompt: '   ',
          options: [
            { label: '', isCorrect: true },
            { label: '4', isCorrect: false },
          ],
        },
      ],
    });
    expect(blank.success).toBe(false);

    const tooLongPrompt = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: [
        {
          prompt: 'P'.repeat(ACTIVITY_LIMITS.promptMax + 1),
          options: [
            { label: 'A', isCorrect: true },
            { label: 'B', isCorrect: false },
          ],
        },
      ],
    });
    expect(tooLongPrompt.success).toBe(false);
    if (!tooLongPrompt.success) {
      expect(tooLongPrompt.error.issues[0].message).toBe(
        activityMessages.validation.questionPromptTooLong,
      );
    }

    const tooLongLabel = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: [
        {
          prompt: '¿Cuál?',
          options: [
            {
              label: 'L'.repeat(ACTIVITY_LIMITS.labelMax + 1),
              isCorrect: true,
            },
            { label: 'B', isCorrect: false },
          ],
        },
      ],
    });
    expect(tooLongLabel.success).toBe(false);
    if (!tooLongLabel.success) {
      expect(tooLongLabel.error.issues[0].message).toBe(
        activityMessages.validation.optionLabelTooLong,
      );
    }
  });

  test('enforces weightMultiplier bounds (0.5..3) and at most two decimals', () => {
    expect(
      createActivityPayloadSchema.safeParse({
        ...validFileTpPayload,
        weightMultiplier: 0.5,
      }).success,
    ).toBe(true);
    expect(
      createActivityPayloadSchema.safeParse({
        ...validFileTpPayload,
        weightMultiplier: 3,
      }).success,
    ).toBe(true);

    const tooLow = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      weightMultiplier: 0.4,
    });
    expect(tooLow.success).toBe(false);
    if (!tooLow.success) {
      expect(tooLow.error.issues[0].message).toBe(
        activityMessages.validation.weightMultiplierRange,
      );
    }

    const tooHigh = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      weightMultiplier: 3.1,
    });
    expect(tooHigh.success).toBe(false);
    if (!tooHigh.success) {
      expect(tooHigh.error.issues[0].message).toBe(
        activityMessages.validation.weightMultiplierRange,
      );
    }

    const tooManyDecimals = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      weightMultiplier: 1.234,
    });
    expect(tooManyDecimals.success).toBe(false);
    if (!tooManyDecimals.success) {
      expect(tooManyDecimals.error.issues[0].message).toBe(
        activityMessages.validation.weightMultiplierDecimals,
      );
    }
  });

  test('enforces integer maxScore between 0 and 100 inclusive', () => {
    expect(
      createActivityPayloadSchema.safeParse({
        ...validFileTpPayload,
        maxScore: 0,
      }).success,
    ).toBe(true);
    expect(
      createActivityPayloadSchema.safeParse({
        ...validFileTpPayload,
        maxScore: 100,
      }).success,
    ).toBe(true);

    for (const invalidScore of [-1, 10.5, 101]) {
      const parsed = createActivityPayloadSchema.safeParse({
        ...validFileTpPayload,
        maxScore: invalidScore,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toBe(
          activityMessages.validation.maxScoreRange,
        );
      }
    }
  });

  test('requires strict ISO-8601-with-offset instants for dueAt and opensAt', () => {
    for (const invalidDueAt of [
      undefined,
      'mañana',
      '2026-12-01',
      '2026-12-01T23:59:59',
    ]) {
      const parsed = createActivityPayloadSchema.safeParse({
        ...validFileTpPayload,
        dueAt: invalidDueAt,
      });
      expect(parsed.success).toBe(false);
    }
  });

  test('rejects an unknown type or format', () => {
    const badType = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      type: 'QUIZ',
    });
    expect(badType.success).toBe(false);

    const badFormat = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      format: 'TEXT',
    });
    expect(badFormat.success).toBe(false);
  });
});

describe('updateActivityPayloadSchema', () => {
  test('accepts an empty update payload', () => {
    const parsed = updateActivityPayloadSchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  test('accepts a partial update with required defaulted fields', () => {
    const parsed = updateActivityPayloadSchema.safeParse({
      title: 'Nuevo título',
      description: '',
      allowLate: false,
      weightMultiplier: 2,
    });
    expect(parsed.success).toBe(true);
  });

  test('rejects opensAt on or after the new dueAt', () => {
    const parsed = updateActivityPayloadSchema.safeParse({
      description: '',
      allowLate: false,
      weightMultiplier: 1,
      opensAt: validDueAt,
      dueAt: validDueAt,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        activityMessages.validation.opensAtBeforeDueAt,
      );
    }
  });

  test('rejects invalid questions on update', () => {
    const parsed = updateActivityPayloadSchema.safeParse({
      description: '',
      allowLate: false,
      weightMultiplier: 1,
      questions: [
        {
          prompt: '¿2+2?',
          options: [
            { label: '4', isCorrect: false },
            { label: '5', isCorrect: false },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  test('rejects a weightMultiplier with more than two decimals on update', () => {
    const valid = updateActivityPayloadSchema.safeParse({
      description: '',
      allowLate: false,
      weightMultiplier: 1.99,
    });
    expect(valid.success).toBe(true);

    const tooMany = updateActivityPayloadSchema.safeParse({
      description: '',
      allowLate: false,
      weightMultiplier: 1.999,
    });
    expect(tooMany.success).toBe(false);
  });
});
