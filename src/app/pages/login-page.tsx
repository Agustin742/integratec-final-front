import { messages } from '../messages';
import { AuthPlaceholderPage } from './auth-placeholder-page';

export function LoginPage() {
  return <AuthPlaceholderPage {...messages.pages.login} />;
}
