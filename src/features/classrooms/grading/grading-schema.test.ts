import { describe, expect, it } from 'vitest';
import {
  createGradingFormSchema,
  formatFileSize,
  GRADE_LIMITS,
  gradeResponseDtoSchema,
  gradingQueueResponseSchema,
  submissionDownloadResponseSchema,
} from './grading-schema';

describe('grading-schema', () => {
  it('validates score boundaries 0..100 and rejects decimals or out-of-range scores', () => {
    const schema = createGradingFormSchema();

    expect(
      schema.safeParse({ score: '0', feedback: 'Sin entregas completas.' })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ score: '100', feedback: 'Excelente trabajo.' })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ score: '-1', feedback: 'Muy bajo.' }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ score: '101', feedback: 'Fuera de rango.' }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ score: '85.5', feedback: 'No admite decimales.' })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ score: '', feedback: 'Falta la nota.' }).success,
    ).toBe(false);
  });

  it('enforces activity maxScore while allowing unchanged initial score on feedback-only regrade', () => {
    const initialSchema = createGradingFormSchema({ maxScore: 80 });
    expect(
      initialSchema.safeParse({ score: '81', feedback: 'Supera el máximo.' })
        .success,
    ).toBe(false);
    expect(
      initialSchema.safeParse({ score: '80', feedback: 'Puntaje máximo.' })
        .success,
    ).toBe(true);

    const regradeSchema = createGradingFormSchema({
      maxScore: 80,
      initialScore: 90,
    });
    expect(
      regradeSchema.safeParse({
        score: '90',
        feedback: 'Se mantiene la nota anterior.',
      }).success,
    ).toBe(true);
    expect(
      regradeSchema.safeParse({
        score: '85',
        feedback: 'Cambiar nota sigue respetando maxScore.',
      }).success,
    ).toBe(false);
  });

  it('enforces @VisibleText rules on feedback (rejecting blank text, newlines, tabs, and >5000 chars)', () => {
    const schema = createGradingFormSchema();

    expect(schema.safeParse({ score: '70', feedback: '   ' }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({
        score: '70',
        feedback: 'Primera línea\nSegunda línea',
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        score: '70',
        feedback: 'Con\ttabulación',
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        score: '70',
        feedback: 'a'.repeat(GRADE_LIMITS.feedbackMaxLength + 1),
      }).success,
    ).toBe(false);

    const parsed = schema.safeParse({
      score: '88',
      feedback: '  Muy buen planteo en los ejercicios 1 y 2.  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        score: 88,
        feedback: 'Muy buen planteo en los ejercicios 1 y 2.',
      });
    }
  });

  it('rejects non-HTTP(S) downloadUrl protocols in submission detail DTO', () => {
    const base = {
      id: '00000000-0000-4000-8000-000000000101',
      activityId: '00000000-0000-4000-8000-000000000201',
      submittedAt: '2026-11-18T14:00:00.000Z',
      isLate: false,
      status: 'submitted' as const,
      files: [
        {
          id: '00000000-0000-4000-8000-000000000301',
          originalName: 'tp1.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
          position: 0,
          downloadUrl: 'javascript:alert(1)',
          downloadUrlExpiresAt: '2026-11-18T15:00:00.000Z',
        },
      ],
    };

    expect(submissionDownloadResponseSchema.safeParse(base).success).toBe(
      false,
    );
    expect(
      submissionDownloadResponseSchema.safeParse({
        ...base,
        files: [
          {
            ...base.files[0],
            downloadUrl: 'https://storage.example.invalid/signed/tp1.pdf',
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('parses valid queue and grade DTOs and formats file sizes', () => {
    expect(
      gradingQueueResponseSchema.safeParse({
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
      }).success,
    ).toBe(true);

    expect(
      gradeResponseDtoSchema.safeParse({
        id: 'g-1',
        submissionId: 's-1',
        activityId: 'a-1',
        studentId: 'u-1',
        graderId: 't-1',
        score: 92,
        feedback: 'Excelente desarrollo.',
        pointsAwarded: 138,
        pointTransactionId: 'tx-1',
        version: 1,
        gradedAt: '2026-11-18T16:00:00.000Z',
        createdAt: '2026-11-18T16:00:00.000Z',
        updatedAt: '2026-11-18T16:00:00.000Z',
      }).success,
    ).toBe(true);

    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
