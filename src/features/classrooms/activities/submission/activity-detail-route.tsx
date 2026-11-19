import { ActivityDetailPage } from '../activity-detail-page';
import { SubmissionPanel } from './submission-panel';
import type { ActivityDetailDto } from '../activity-schema';

function renderSubmissionTab(activity: ActivityDetailDto) {
  return <SubmissionPanel activity={activity} />;
}

/**
 * Route entry for the student activity detail (#42): the shared detail page
 * with the submission tab filled by the file-submission panel. The classroom
 * and activity ids come from the route params, exactly as the detail page
 * resolves them.
 */
export function ActivityDetailRoute() {
  return <ActivityDetailPage renderSubmissionTab={renderSubmissionTab} />;
}
