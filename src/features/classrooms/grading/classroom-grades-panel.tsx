import { useParams } from 'react-router';
import { LoadingState } from '@/components/feedback/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GradesPanel } from '../grades/grades-panel';
import { gradesMessages } from '../grades/messages';
import { useClassroomContext } from '../use-classroom-capabilities';
import { gradingMessages } from './grading-messages';
import { TeacherGradingQueuePanel } from './teacher-grading-queue-panel';

/**
 * Unified classroom `grades` panel (`classroomPanelCatalog` key `'grades'`).
 * - Teaching staff (`publish_content`) get tabs for the classroom grading
 *   review queue (`HU-ACT-004`) and the per-student participation metrics table
 *   (`HU-ACT-005`).
 * - Students and linked parents delegate to `GradesPanel` (`HU-ACT-005`)
 *   without issuing staff-only requests.
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
    return (
      <Tabs defaultValue="review" className="min-w-0 space-y-4">
        <TabsList>
          <TabsTrigger value="review">
            {gradingMessages.panel.heading}
          </TabsTrigger>
          <TabsTrigger value="metrics">
            {gradesMessages.teacher.heading}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="review">
          <TeacherGradingQueuePanel classroomId={normalizedClassroomId} />
        </TabsContent>
        <TabsContent value="metrics">
          <GradesPanel />
        </TabsContent>
      </Tabs>
    );
  }

  return <GradesPanel />;
}
