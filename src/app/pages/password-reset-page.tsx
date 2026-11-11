import { messages } from '../messages';
import { AuthPlaceholderPage } from './auth-placeholder-page';

export function PasswordResetPage() {
  return <AuthPlaceholderPage {...messages.pages.passwordReset} />;
}
