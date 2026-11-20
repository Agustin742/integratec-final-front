import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { ErrorState } from '@/components/feedback/states';
import { classroomMessages as messages } from '../messages';
import { ChatConversation } from './chat-conversation';

export interface ChatPanelProps {
  /** Send-side composer slot, see `ChatConversation`. */
  readonly composer?: ReactNode;
}

/**
 * Workspace chat panel (`HU-COM-002`, issue #51): the shared
 * `ChatConversation` bound to the classroom of the route, sized for the panel
 * dialog. The floating chat dock renders the same conversation for any of the
 * user's classrooms.
 */
export function ChatPanel({ composer }: ChatPanelProps) {
  const { classroomId } = useParams();
  if (!classroomId) {
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.chat.states.loadErrorTitle}
        description={messages.chat.states.loadErrorDescription}
      />
    );
  }
  return (
    <ChatConversation
      classroomId={classroomId}
      variant="panel"
      composer={composer}
    />
  );
}
