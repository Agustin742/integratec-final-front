import { describe, expect, test } from 'vitest';
import { DEFAULT_SCHOOL_TIME_ZONE } from '@/lib/dates';
import {
  activityEditorDefaultsFromDetail,
  createActivityEditorDefaults,
  createActivityEditorSchema,
  updateActivityEditorSchema,
  type ActivityEditorFormInput,
} from './activity-editor-schema';
import { activityMessages } from './messages';

const validationCopy = activityMessages.validation;
const editorValidationCopy = activityMessages.editor.validation;

type SafeParseLike =
  | { readonly success: true }
  | {
      readonly success: false;
      readonly error: {
        readonly issues: readonly { readonly message: string }[];
      };
    };

function messagesOf(result: SafeParseLike): string[] {
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
}

function validCreateInput(): ActivityEditorFormInput {
  return {
    type: 'TP',
    format: 'FILE',
    title: 'TP Fracciones',
    description: 'Resolver el capítulo 3.',
    opensAt: '',
    dueAt: '2026-12-01T20:00',
    allowLate: false,
    maxScore: '10',
    weightMultiplier: '1',
    questions: [],
  };
}

describe('activity editor schema (#39 T3)', () => {
  test('blank create defaults fail with title, dueAt and maxScore messages', () => {
    const result = createActivityEditorSchema().safeParse(
      createActivityEditorDefaults(),
    );
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    const messages = messagesOf(result);
    expect(messages).toContain(validationCopy.titleRequired);
    expect(messages).toContain(editorValidationCopy.dueAtRequired);
    expect(messages).toContain(editorValidationCopy.maxScoreRequired);
  });

  test('valid create input converts school-zone datetime-local into UTC instants', () => {
    const result = createActivityEditorSchema().safeParse(validCreateInput());
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // 20:00 in America/Argentina/Buenos_Aires (UTC-3) is 23:00 UTC.
    expect(result.data.dueAt).toBe('2026-12-01T23:00:00.000Z');
    expect(result.data.opensAt).toBeUndefined();
    expect(result.data.title).toBe('TP Fracciones');
    expect(result.data.maxScore).toBe(10);
    expect(result.data.weightMultiplier).toBe(1);
    expect(result.data.questions).toBeUndefined();
  });

  test('TP with an opensAt value is refused (EXAM-only contract rule)', () => {
    const result = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      type: 'TP',
      opensAt: '2026-12-01T19:00',
    });
    expect(messagesOf(result)).toContain(validationCopy.opensAtOnlyForExams);
  });

  test('EXAM opensAt must be strictly before dueAt', () => {
    const equal = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      type: 'EXAM',
      opensAt: '2026-12-01T20:00',
    });
    expect(messagesOf(equal)).toContain(validationCopy.opensAtBeforeDueAt);

    const after = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      type: 'EXAM',
      opensAt: '2026-12-01T21:00',
    });
    expect(messagesOf(after)).toContain(validationCopy.opensAtBeforeDueAt);

    const before = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      type: 'EXAM',
      opensAt: '2026-12-01T19:30',
    });
    expect(before.success).toBe(true);
  });

  test('MULTIPLE_CHOICE requires questions; FILE with questions is refused', () => {
    const withoutQuestions = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      format: 'MULTIPLE_CHOICE',
      questions: [],
    });
    expect(messagesOf(withoutQuestions)).toContain(
      validationCopy.questionsRequired,
    );

    const withQuestions = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      format: 'FILE',
      questions: [
        {
          prompt: '¿Cuánto es 2 + 2?',
          options: [
            { label: '3', isCorrect: false },
            { label: '4', isCorrect: true },
          ],
        },
      ],
    });
    expect(messagesOf(withQuestions)).toContain(
      validationCopy.questionsForbiddenForFile,
    );
  });

  test('enforces 2..6 options and exactly one correct option per question', () => {
    const singleOption = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      format: 'MULTIPLE_CHOICE',
      questions: [
        {
          prompt: '¿Cuánto es 2 + 2?',
          options: [{ label: '4', isCorrect: true }],
        },
      ],
    });
    expect(messagesOf(singleOption)).toContain(validationCopy.optionsMin);

    const zero = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      format: 'MULTIPLE_CHOICE',
      questions: [
        {
          prompt: '¿Cuánto es 2 + 2?',
          options: [
            { label: '3', isCorrect: false },
            { label: '4', isCorrect: false },
          ],
        },
      ],
    });
    expect(messagesOf(zero)).toContain(validationCopy.exactlyOneCorrectOption);

    const multiple = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      format: 'MULTIPLE_CHOICE',
      questions: [
        {
          prompt: '¿Cuánto es 2 + 2?',
          options: [
            { label: '3', isCorrect: true },
            { label: '4', isCorrect: true },
          ],
        },
      ],
    });
    expect(messagesOf(multiple)).toContain(
      validationCopy.exactlyOneCorrectOption,
    );

    const single = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      format: 'MULTIPLE_CHOICE',
      questions: [
        {
          prompt: '¿Cuánto es 2 + 2?',
          options: [
            { label: '3', isCorrect: false },
            { label: '4', isCorrect: true },
          ],
        },
      ],
    });
    expect(single.success).toBe(true);
  });

  test('weightMultiplier must be between 0.5 and 3 with at most two decimals', () => {
    const threeDecimals = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      weightMultiplier: '1.234',
    });
    expect(messagesOf(threeDecimals)).toContain(
      validationCopy.weightMultiplierDecimals,
    );

    const tooLow = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      weightMultiplier: '0.4',
    });
    expect(messagesOf(tooLow)).toContain(validationCopy.weightMultiplierRange);

    const tooHigh = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      weightMultiplier: '3.5',
    });
    expect(messagesOf(tooHigh)).toContain(validationCopy.weightMultiplierRange);

    const twoDecimals = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      weightMultiplier: '1.25',
    });
    expect(twoDecimals.success).toBe(true);
  });

  test('maxScore must be an integer between 0 and 100 inclusive', () => {
    const zero = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      maxScore: '0',
    });
    expect(zero.success).toBe(true);

    const decimal = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      maxScore: '10.5',
    });
    expect(messagesOf(decimal)).toContain(validationCopy.maxScoreRange);

    const overMax = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      maxScore: '101',
    });
    expect(messagesOf(overMax)).toContain(validationCopy.maxScoreRange);

    const negative = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      maxScore: '-1',
    });
    expect(messagesOf(negative)).toContain(validationCopy.maxScoreRange);
  });

  test('malformed and DST-gap datetime-local values are refused', () => {
    const malformed = createActivityEditorSchema().safeParse({
      ...validCreateInput(),
      dueAt: 'fecha-invalida',
    });
    expect(messagesOf(malformed)).toContain(validationCopy.instantInvalid);

    // 02:30 on 2026-03-08 does not exist in America/New_York (DST gap).
    const gap = createActivityEditorSchema({
      timeZone: 'America/New_York',
    }).safeParse({ ...validCreateInput(), dueAt: '2026-03-08T02:30' });
    expect(messagesOf(gap)).toContain(validationCopy.instantInvalid);
  });

  test('edit schema blocks removing a defined exam window (null is rejected)', () => {
    const result = updateActivityEditorSchema({
      timeZone: DEFAULT_SCHOOL_TIME_ZONE,
      originalOpensAt: '2026-11-25T13:00:00.000Z',
    }).safeParse({
      ...validCreateInput(),
      type: 'EXAM',
      opensAt: '',
    });
    expect(messagesOf(result)).toContain(
      editorValidationCopy.opensAtCannotBeRemoved,
    );
  });

  test('edit defaults convert UTC instants back into school-zone values', () => {
    const defaults = activityEditorDefaultsFromDetail({
      id: '6a6b6c6d-0000-4000-8000-0000000000a3',
      classroomId: '4e5f6a7b-0000-4000-8000-000000000033',
      type: 'EXAM',
      format: 'MULTIPLE_CHOICE',
      state: 'DRAFT',
      title: 'Examen Parcial',
      description: '',
      opensAt: '2026-11-25T13:00:00.000Z',
      dueAt: '2026-11-30T23:00:00.000Z',
      allowLate: true,
      maxScore: 10,
      weightMultiplier: 1.5,
      publishedAt: null,
      timeZone: 'America/Argentina/Buenos_Aires',
      questionCount: 1,
      createdAt: '2026-11-10T12:00:00.000Z',
      updatedAt: '2026-11-10T12:00:00.000Z',
      createdById: '00000000-0000-4000-8000-000000000001',
      questions: [
        {
          id: '00000000-0000-4000-8000-000000001001',
          position: 1,
          prompt: '¿Cuánto es 2 + 2?',
          options: [
            {
              id: '00000000-0000-4000-8000-000000002001',
              position: 1,
              label: '3',
              isCorrect: false,
            },
            {
              id: '00000000-0000-4000-8000-000000002002',
              position: 2,
              label: '4',
              isCorrect: true,
            },
          ],
        },
      ],
    });

    expect(defaults.opensAt).toBe('2026-11-25T10:00');
    expect(defaults.dueAt).toBe('2026-11-30T20:00');
    expect(defaults.weightMultiplier).toBe('1.5');
    expect(defaults.questions).toEqual([
      {
        prompt: '¿Cuánto es 2 + 2?',
        options: [
          { label: '3', isCorrect: false },
          { label: '4', isCorrect: true },
        ],
      },
    ]);
  });
});
