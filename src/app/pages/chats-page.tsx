import { useParams } from 'react-router';
import { BackToListLink } from '@/features/classrooms/back-to-list-link';
import { ChatsPageView } from '@/features/chat-page/chats-page-view';
import { useSessionSnapshot } from '@/session/provider';

/** `/chats` and `/chats/:classroomId`: the chats of every classroom. */
export function ChatsPage() {
  const { classroomId } = useParams();
  const snapshot = useSessionSnapshot();
  if (snapshot.status !== 'authenticated') {
    return null;
  }
  return (
    <>
      <div>
        <BackToListLink />
      </div>
      <ChatsPageView
        key={snapshot.user.id}
        userId={snapshot.user.id}
        classroomId={classroomId}
      />
    </>
  );
}
