import { Link } from 'react-router';
import { buttonStyles } from '@/components/ui/button';
import { classroomMessages as messages } from './messages';

/**
 * Text link back to the classrooms list ("Volver a mis aulas"), shared by the
 * classroom lost-access view and the account pages (`/profile`, `/chats`).
 */
export function BackToListLink() {
  return (
    <Link to="/" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
      {messages.backToList}
    </Link>
  );
}
