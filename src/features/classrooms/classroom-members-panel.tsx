import { useParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClassroomInvitationsPanel } from './classroom-invitations-panel';
import { ClassroomRosterPanel } from './classroom-roster-panel';
import { classroomMessages } from './messages';
import { useClassroomCapabilities } from './use-classroom-capabilities';

export interface ClassroomMembersPanelProps {
  readonly classroomId?: string;
}

/**
 * Container panel for the `members` workspace tab (`HU-AUL-002` + `HU-AUL-003`).
 * Renders tabbed navigation (`Nómina` and `Invitaciones y código`) only when the
 * server grants `invite_members`; otherwise renders `ClassroomRosterPanel` directly.
 */
export function ClassroomMembersPanel({
  classroomId: propClassroomId,
}: ClassroomMembersPanelProps = {}) {
  const params = useParams<{ classroomId: string }>();
  const resolvedClassroomId = propClassroomId ?? params.classroomId ?? '';
  const capabilities = useClassroomCapabilities(resolvedClassroomId);
  const canInviteMembers =
    capabilities.status === 'ready' && capabilities.can('invite_members');

  if (!canInviteMembers) {
    return <ClassroomRosterPanel classroomId={resolvedClassroomId} />;
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

      <TabsContent value="roster">
        <ClassroomRosterPanel classroomId={resolvedClassroomId} />
      </TabsContent>
      <TabsContent value="invitations">
        <ClassroomInvitationsPanel classroomId={resolvedClassroomId} />
      </TabsContent>
    </Tabs>
  );
}
