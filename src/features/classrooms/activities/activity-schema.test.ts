import { describe, expect, test } from 'vitest';
import { classroomMessages } from '../messages';
import {
  createActivityPayloadSchema,
  updateActivityPayloadSchema,
} from './activity-schema';

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
  test('accepts a valid FILE TP payload without questions', () => {
    const parsed = createActivityPayloadSchema.safeParse(validFileTpPayload);
    expect(parsed.success).toBe(true);
  });

  test('accepts a valid MULTIPLE_CHOICE EXAM payload with one window and questions', () => {
    const parsed = createActivityPayloadSchema.safeParse(validMcqExamPayload);
    expect(parsed.success).toBe(true);
  });

  test('rejects a missing or blank title', () => {
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
        classroomMessages.activities.validation.titleRequired,
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
        classroomMessages.activities.validation.opensAtOnlyForExams,
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
        classroomMessages.activities.validation.opensAtBeforeDueAt,
      );
    }

    const after = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      opensAt: '2026-12-02T00:00:00.000Z',
    });
    expect(after.success).toBe(false);
  });

  test('rejects a MULTIPLE_CHOICE payload without questions', () => {
    const parsed = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: undefined,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        classroomMessages.activities.validation.questionsRequired,
      );
    }
  });

  test('rejects questions on a FILE payload', () => {
    const parsed = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      questions: validMcqExamPayload.questions,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        classroomMessages.activities.validation.questionsForbiddenForFile,
      );
    }
  });

  test('rejects a question with zero correct options', () => {
    const parsed = createActivityPayloadSchema.safeParse({
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
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        classroomMessages.activities.validation.exactlyOneCorrectOption,
      );
    }
  });

  test('rejects a question with more than one correct option', () => {
    const parsed = createActivityPayloadSchema.safeParse({
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
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        classroomMessages.activities.validation.exactlyOneCorrectOption,
      );
    }
  });

  test('rejects a blank question prompt and blank option label', () => {
    const parsed = createActivityPayloadSchema.safeParse({
      ...validMcqExamPayload,
      questions: [
        {
          prompt: '   ',
          options: [{ label: '', isCorrect: true }],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  test('rejects a weightMultiplier with more than two decimals', () => {
    const parsed = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      weightMultiplier: 1.234,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        classroomMessages.activities.validation.weightMultiplierDecimals,
      );
    }
  });

  test('rejects a non-positive maxScore', () => {
    const zero = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      maxScore: 0,
    });
    expect(zero.success).toBe(false);

    const negative = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      maxScore: -10,
    });
    expect(negative.success).toBe(false);
    if (!negative.success) {
      expect(negative.error.issues[0].message).toBe(
        classroomMessages.activities.validation.maxScorePositive,
      );
    }
  });

  test('rejects a missing or invalid dueAt', () => {
    const missing = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      dueAt: undefined,
    });
    expect(missing.success).toBe(false);

    const notIso = createActivityPayloadSchema.safeParse({
      ...validFileTpPayload,
      dueAt: 'mañana',
    });
    expect(notIso.success).toBe(false);
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
        classroomMessages.activities.validation.opensAtBeforeDueAt,
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
