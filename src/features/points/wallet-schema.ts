import { z } from 'zod';
import type { components } from '@/api/schema.generated';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export type PointEntryKind = components['schemas']['PointEntryKind'];
export type PointMovementDto = components['schemas']['PointMovementDto'];
export type StudentWalletDto = components['schemas']['StudentWalletDto'];

export const pointEntryKindSchema: z.ZodType<PointEntryKind> = z.enum([
  'EARNING',
  'DEBIT',
  'COMPENSATION',
]);

export const pointMovementSchema: z.ZodType<PointMovementDto> = z.object({
  id: z.string().uuid(),
  entryKind: pointEntryKindSchema,
  amount: z
    .number()
    .int()
    .refine((value) => value !== 0, {
      message: 'Point movement amount must be non-zero.',
    }),
  sourceType: z.string().refine((value) => value.trim().length > 0, {
    message: 'Point movement sourceType must not be blank.',
  }),
  sourceId: z.string().uuid(),
  reason: z.string().refine((value) => value.trim().length > 0, {
    message: 'Point movement reason must not be blank.',
  }),
  actorId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const studentWalletSchema: z.ZodType<StudentWalletDto> = z.object({
  classroomId: z.string().uuid(),
  studentId: z.string().uuid(),
  balance: z.number().int().nonnegative(),
  items: z.array(pointMovementSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
});
