import type { ActivityListItemDto } from './activity-schema';

export type ActivityGroupKey =
  'drafts' | 'published' | 'closed' | 'todo' | 'done';

export interface ActivityGroup {
  readonly key: ActivityGroupKey;
  readonly items: readonly ActivityListItemDto[];
}

export interface GroupActivitiesOptions {
  readonly isStaff: boolean;
  /** Epoch ms. Presentation grouping only; the server owns deadline authority. */
  readonly now: number;
}

function pushTo(
  buckets: Map<ActivityGroupKey, ActivityListItemDto[]>,
  key: ActivityGroupKey,
  item: ActivityListItemDto,
): void {
  const bucket = buckets.get(key);
  if (bucket) {
    bucket.push(item);
  } else {
    buckets.set(key, [item]);
  }
}

const STAFF_ORDER: readonly ActivityGroupKey[] = [
  'drafts',
  'published',
  'closed',
];
const STUDENT_ORDER: readonly ActivityGroupKey[] = ['todo', 'done'];

/**
 * Groups one page of activities by state using only what the API provides:
 * staff by `state` and `dueAt`, students by their own work `status`. Students
 * whose payload carries no `status` fall back to a single published group.
 * Empty groups are omitted and the incoming order is kept within each group.
 */
export function groupActivities(
  items: readonly ActivityListItemDto[],
  { isStaff, now }: GroupActivitiesOptions,
): readonly ActivityGroup[] {
  const buckets = new Map<ActivityGroupKey, ActivityListItemDto[]>();
  const studentHasStatus = items.every((item) => item.status !== undefined);

  for (const item of items) {
    if (isStaff) {
      if (item.state === 'DRAFT') {
        pushTo(buckets, 'drafts', item);
      } else if (Date.parse(item.dueAt) < now) {
        pushTo(buckets, 'closed', item);
      } else {
        pushTo(buckets, 'published', item);
      }
    } else if (!studentHasStatus) {
      pushTo(buckets, 'published', item);
    } else if (item.status === 'pending' || item.status === 'overdue') {
      pushTo(buckets, 'todo', item);
    } else {
      pushTo(buckets, 'done', item);
    }
  }

  const order: readonly ActivityGroupKey[] = isStaff
    ? STAFF_ORDER
    : studentHasStatus
      ? STUDENT_ORDER
      : ['published'];
  return order.flatMap((key) => {
    const bucket = buckets.get(key);
    return bucket ? [{ key, items: bucket }] : [];
  });
}
