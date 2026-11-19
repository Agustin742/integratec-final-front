import { z } from 'zod';
import type { components } from '@/api/schema.generated';

z.config({ jitless: true });

export type NotificationDto = components['schemas']['NotificationDto'];
export type NotificationKind = NotificationDto['kind'];
export type NotificationsReadResultDto =
  components['schemas']['NotificationsReadResultDto'];

export const NOTIFICATION_KINDS = [
  'activity_published',
  'grade_posted',
  'announcement',
  'mention',
  'activity_forum_reply',
] as const satisfies readonly NotificationKind[];

export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);

export const notificationDtoSchema: z.ZodType<NotificationDto> = z.object({
  id: z.string().uuid(),
  kind: notificationKindSchema,
  resourceId: z.string().uuid(),
  classroomId: z.string().uuid(),
  studentId: z.string().uuid().nullable(),
  readAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export interface PaginatedNotificationListDto {
  readonly items: NotificationDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export const paginatedNotificationListSchema: z.ZodType<PaginatedNotificationListDto> =
  z.object({
    items: z.array(notificationDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  });

export const notificationsReadResultSchema: z.ZodType<NotificationsReadResultDto> =
  z.object({
    updated: z.number().int().nonnegative(),
  });

const uuidSchema = z.string().uuid();

/**
 * Deduplicates notifications by `id` (handling out-of-order or overlapping
 * polling responses) and sorts newest-first by `createdAt`.
 */
export function dedupeAndSortNotifications(
  items: readonly NotificationDto[],
): NotificationDto[] {
  const byId = new Map<string, NotificationDto>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    // Preserve confirmed readAt if either snapshot has it.
    if (existing.readAt === null && item.readAt !== null) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const timeDiff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (Number.isFinite(timeDiff) && timeDiff !== 0) {
      return timeDiff;
    }
    const isoDiff = b.createdAt.localeCompare(a.createdAt);
    return isoDiff !== 0 ? isoDiff : b.id.localeCompare(a.id);
  });
}

/**
 * Maps a notification to a safe in-app classroom panel path.
 * The destination route and backend endpoint authorize access independently.
 */
export function getNotificationTargetPath(
  notification: NotificationDto,
): string | null {
  if (!uuidSchema.safeParse(notification.classroomId).success) {
    return null;
  }
  const panelKey =
    notification.kind === 'grade_posted'
      ? 'grades'
      : notification.kind === 'activity_published' ||
          notification.kind === 'activity_forum_reply'
        ? 'activities'
        : 'notices';
  return `/classrooms/${notification.classroomId}/panels/${panelKey}`;
}
