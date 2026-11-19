import { ActivityDetailPage } from '../activity-detail-page';
import { ActivityForumPanel } from '../forum/activity-forum-panel';
import { SubmissionPanel } from './submission-panel';
import type { ActivityDetailDto } from '../activity-schema';

function renderSubmissionTab(activity: ActivityDetailDto) {
  return <SubmissionPanel activity={activity} />;
}

function renderForumTab(activity: ActivityDetailDto) {
  return <ActivityForumPanel activity={activity} />;
}

/**
 * Route entry for the activity detail route: fills the submission slot (#42)
 * and the per-activity query forum slot (#52) while keeping classroom and
 * activity ids sourced strictly from route params.
 */
export function ActivityDetailRoute() {
  return (
    <ActivityDetailPage
      renderSubmissionTab={renderSubmissionTab}
      renderForumTab={renderForumTab}
    />
  );
}
