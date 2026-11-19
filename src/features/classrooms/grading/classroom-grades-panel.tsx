import { useParams } from 'react-router';
import { EmptyState, LoadingState } from '@/components/feedback/states';
import { classroomMessages } from '../messages';
import { useClassroomContext } from '../use-classroom-capabilities';
import { gradingMessages } from './grading-messages';
import { TeacherGradingQueuePanel } from './teacher-grading-queue-panel';

/**
 * Classroom `grades` panel (`classroomPanelCatalog` key `'grades'`).
 * - Teaching staff (`publish_content`) get the classroom-wide grading queue,
 *   submission viewer, and grade/regrade workflow (`HU-ACT-004`).
 * - Students and linked parents see an honest pending placeholder without
 *   issuing staff-only requests (leaving the student/parent view cleanly
 *   isolated for `HU-ACT-005` / `HU-ACT-006`).
 */
export function ClassroomGradesPanel() {
  const { classroomId } = useParams();
  const normalizedClassroomId = (classroomId ?? '').trim();
  const context = useClassroomContext(normalizedClassroomId);

  if (context.status === 'pending') {
    return <LoadingState label={gradingMessages.panel.loading} />;
  }

  if (
    context.status === 'ready' &&
    context.classroom.capabilities.includes('publish_content')
  ) {
    return <TeacherGradingQueuePanel classroomId={normalizedClassroomId} />;
  }

  return (
    <EmptyState
      title={classroomMessages.pendingPanelTitle}
      description={classroomMessages.pendingPanelDescription}
    />
  );
}
