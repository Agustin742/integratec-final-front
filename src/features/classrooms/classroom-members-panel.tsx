import { useParams } from 'react-router';
import { LoadingState } from '@/components/feedback/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClassroomDirectoryPanel,
  ClassroomTeachersSection,
} from './classroom-directory';
import { ClassroomInvitationsPanel } from './classroom-invitations-panel';
import { ClassroomRosterPanel } from './classroom-roster-panel';
import { classroomMessages } from './messages';
import { useClassroomCapabilities } from './use-classroom-capabilities';

export interface ClassroomMembersPanelProps {
  readonly classroomId?: string;
}

/**
 * Container panel for the `members` workspace tab (`HU-AUL-002` + `HU-AUL-003`).
 * - Staff with `invite_members` get tabs (roster and invitations); the roster
 *   tab shows the teaching team above the managed student roster.
 * - Students (and other directory readers) get the public member directory
 *   grouped into teachers and students.
 * - Everyone else falls back to `ClassroomRosterPanel`, which renders the
 *   server's refusal honestly.
 */
export function ClassroomMembersPanel({
  classroomId: propClassroomId,
}: ClassroomMembersPanelProps = {}) {
  const params = useParams<{ classroomId: string }>();
  const resolvedClassroomId = propClassroomId ?? params.classroomId ?? '';
  const capabilities = useClassroomCapabilities(resolvedClassroomId);

  if (capabilities.status === 'pending') {
    return <LoadingState label={classroomMessages.members.directoryLoading} />;
  }

  const canInviteMembers =
    capabilities.status === 'ready' && capabilities.can('invite_members');
  const canListDirectory =
    capabilities.status === 'ready' && capabilities.can('list_directory');

  if (!canInviteMembers) {
    return canListDirectory ? (
      <ClassroomDirectoryPanel classroomId={resolvedClassroomId} />
    ) : (
      <ClassroomRosterPanel classroomId={resolvedClassroomId} />
    );
  }

  return (
    <Tabs defaultValue="roster" className="min-w-0 pt-2">
      <TabsList aria-label={classroomMessages.members.tabsLabel}>
        <TabsTrigger value="roster" className="min-h-11">
          {classroomMessages.members.rosterTab}
        </TabsTrigger>
        <TabsTrigger value="invitations" className="min-h-11">
          {classroomMessages.members.invitationsTab}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="roster" className="min-w-0 space-y-2">
        {canListDirectory ? (
          <ClassroomTeachersSection classroomId={resolvedClassroomId} />
        ) : null}
        <ClassroomRosterPanel classroomId={resolvedClassroomId} />
      </TabsContent>
      <TabsContent value="invitations">
        <ClassroomInvitationsPanel classroomId={resolvedClassroomId} />
      </TabsContent>
    </Tabs>
  );
}
