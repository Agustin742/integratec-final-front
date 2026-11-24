import { BackToListLink } from '@/features/classrooms/back-to-list-link';
import { ProfileView } from '@/features/profile/profile-view';
import { messages } from '../messages';
import { useDocumentTitle } from '../router/document-title';

export function ProfilePage() {
  const { title } = messages.pages.profile;
  useDocumentTitle(title);

  return (
    <>
      <div>
        <BackToListLink />
      </div>
      <ProfileView title={title} />
    </>
  );
}
