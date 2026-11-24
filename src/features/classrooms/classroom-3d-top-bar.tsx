import type { ReactNode, RefObject } from 'react';
import { Link } from 'react-router';
import { Button, buttonStyles } from '@/components/ui/button';
import { ChatsNavLink } from '@/features/chat-page/chats-nav-link';
import { ClaimedNotificationCenter } from '@/features/notifications/notification-host';
import { ProfileNavLink } from '@/features/profile/profile-nav-link';
import { classroomMessages as messages } from './messages';

export interface Classroom3DTopBarProps {
  readonly classroomName: string;
  readonly roleLabel: string;
  /** Receives focus when the panel dialogs have nowhere better to return it. */
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly modeToggleLabel: string;
  readonly onToggleMode: () => void;
  /** Student wallet chip, when the viewer has one. */
  readonly wallet?: ReactNode;
}

/**
 * Floating rounded navbar over the full-screen 3D world (`#128`): back link,
 * classroom name and role, wallet, the 2D / 3D switch and the account shortcuts (profile, messages, notifications). It is a
 * semi-opaque blurred card so the text keeps its contrast over the scene; the
 * overlay that hosts it is click-through, only this card takes pointer events.
 */
export function Classroom3DTopBar({
  classroomName,
  roleLabel,
  headingRef,
  modeToggleLabel,
  onToggleMode,
  wallet,
}: Classroom3DTopBarProps) {
  return (
    <header
      aria-label={messages.viewMode.immersive.topBarLabel}
      data-testid="classroom-3d-top-bar"
      className="pointer-events-auto w-full max-w-4xl min-w-0 rounded-2xl border border-edge bg-card/85 px-3 py-2 text-card-foreground shadow-panel backdrop-blur-md"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label={messages.backToList}
            title={messages.backToList}
            className={buttonStyles({ variant: 'outline', size: 'icon' })}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-lg leading-tight font-semibold text-foreground wrap-anywhere"
            >
              {classroomName}
            </h2>
            <p className="text-xs text-muted-foreground">
              {messages.role}: {roleLabel}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {wallet}
          {/* Visual cue only: aria-keyshortcuts on the button already announces Alt+M. */}
          <span
            aria-hidden="true"
            className="hidden text-xs text-muted-foreground lg:inline"
          >
            {messages.viewMode.shortcutHint}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-keyshortcuts="Alt+M"
            onClick={onToggleMode}
          >
            {modeToggleLabel}
          </Button>
          {/* Same components as the covered global header; the bell is
              claimed so only one instance polls and announces. */}
          <div className="flex items-center gap-2">
            <ProfileNavLink />
            <ChatsNavLink />
            <ClaimedNotificationCenter />
          </div>
        </div>
      </div>
    </header>
  );
}
