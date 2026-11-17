import { LoginForm } from '@/features/auth/login-form';
import { messages } from '../messages';
import { useDocumentTitle } from '../router/document-title';

export function LoginPage() {
  const { title } = messages.pages.login;
  useDocumentTitle(title);

  return <LoginForm title={title} />;
}
