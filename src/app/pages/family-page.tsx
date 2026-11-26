import { FamilyAreaView } from '@/features/family/family-area-view';
import { messages } from '../messages';
import { useDocumentTitle } from '../router/document-title';

export function FamilyPage() {
  const { title } = messages.pages.family;
  useDocumentTitle(title);

  return <FamilyAreaView title={title} />;
}
