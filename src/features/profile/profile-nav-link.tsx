import { NavLink } from 'react-router';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { messages } from '@/app/messages';

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 fill-none stroke-current stroke-[2]"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

/**
 * Icon-only link to the profile page, shared by the global app header and the
 * floating 3D classroom navbar. The accessible name comes from the shell
 * messages; `NavLink` supplies `aria-current` for the active route.
 */
export function ProfileNavLink({ className }: { readonly className?: string }) {
  return (
    <NavLink
      to="/profile"
      aria-label={messages.shell.profileLink}
      title={messages.shell.profileLink}
      className={({ isActive }) =>
        cn(
          buttonStyles({
            variant: isActive ? 'secondary' : 'outline',
            size: 'sm',
          }),
          'min-h-11 min-w-11 px-3',
          className,
        )
      }
    >
      <UserIcon />
    </NavLink>
  );
}
