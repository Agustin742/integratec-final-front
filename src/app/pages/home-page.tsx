import { ClassroomListPage } from '@/features/classrooms/classroom-list-page';
import { messages } from '../messages';
import { useDocumentTitle } from '../router/document-title';

export function HomePage() {
  const { title } = messages.pages.home;
  useDocumentTitle(title);

  return <ClassroomListPage title={title} />;
}
