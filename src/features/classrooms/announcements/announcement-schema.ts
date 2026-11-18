import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import { announcementMessages } from './messages';

z.config({ jitless: true });

export type AnnouncementDto = components['schemas']['AnnouncementDto'];
export type CreateAnnouncementDto =
  components['schemas']['CreateAnnouncementDto'];
export type UpdateAnnouncementDto =
  components['schemas']['UpdateAnnouncementDto'];

export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 200;
export const ANNOUNCEMENT_CONTENT_MAX_LENGTH = 5000;

export const announcementDtoSchema: z.ZodType<AnnouncementDto> = z.object({
  id: z.string().uuid(),
  classroomId: z.string().uuid(),
  authorId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  mentionedUserIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export interface PaginatedAnnouncementListDto {
  readonly items: AnnouncementDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export const paginatedAnnouncementListSchema: z.ZodType<PaginatedAnnouncementListDto> =
  z.object({
    items: z.array(announcementDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  });

export const announcementFormSchema = z.object({
  title: z
    .string()
    .refine((value) => !/[\r\n]/.test(value), {
      message: announcementMessages.form.titleSingleLine,
    })
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: announcementMessages.form.titleRequired,
    })
    .refine((value) => value.length <= ANNOUNCEMENT_TITLE_MAX_LENGTH, {
      message: announcementMessages.form.titleMaxLength,
    }),
  content: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: announcementMessages.form.contentRequired,
    })
    .refine((value) => value.length <= ANNOUNCEMENT_CONTENT_MAX_LENGTH, {
      message: announcementMessages.form.contentMaxLength,
    }),
});

export type AnnouncementFormInput = z.input<typeof announcementFormSchema>;
export type AnnouncementFormValues = z.output<typeof announcementFormSchema>;
