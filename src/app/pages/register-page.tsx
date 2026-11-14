import { RegisterForm } from '@/features/auth/register-form';
import { messages } from '../messages';
import { useDocumentTitle } from '../router/document-title';

export function RegisterPage() {
  const { title } = messages.pages.register;
  useDocumentTitle(title);

  return <RegisterForm title={title} />;
}
