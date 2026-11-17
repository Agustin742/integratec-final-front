import { PasswordResetForm } from '@/features/auth/password-reset-form';
import { messages } from '../messages';
import { useDocumentTitle } from '../router/document-title';

export function PasswordResetPage() {
  const { title } = messages.pages.passwordReset;
  useDocumentTitle(title);

  return <PasswordResetForm title={title} />;
}
