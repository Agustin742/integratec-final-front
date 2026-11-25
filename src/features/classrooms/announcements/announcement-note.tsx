import { useRef, type ReactElement, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatInstant } from '@/lib/dates';
import type { AnnouncementDto } from './announcement-schema';
import { formatNoticeAge } from './format-notice-time';
import { announcementMessages } from './messages';

const copy = announcementMessages.list;

export interface NoticeAuthor {
  readonly name: string;
  readonly role: 'TEACHER' | 'STUDENT' | null;
}

/** Initials for the avatar: first letters of the first two name words, skipping honorifics such as "Prof.". */
export function noticeAuthorInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((word) => word.length > 0 && !word.endsWith('.'));
  const source = words.length > 0 ? words : name.split(/\s+/);
  return source
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export interface AnnouncementNoteProps {
  readonly item: AnnouncementDto;
  readonly author: NoticeAuthor;
  /** Epoch ms used only to phrase the relative age. */
  readonly now: number;
  readonly canModify: boolean;
  /** Disables the overflow menu while an action is in flight or confirming. */
  readonly menuDisabled: boolean;
  readonly registerMenuTrigger: (node: HTMLButtonElement | null) => void;
  readonly onEdit: (item: AnnouncementDto) => void;
  readonly onRemove: (item: AnnouncementDto) => void;
  /** Inline editor that replaces the notice body while editing. */
  readonly editor?: ReactNode;
  /** Inline destructive confirmation rendered under the body. */
  readonly children?: ReactNode;
}

export function AnnouncementNote({
  item,
  author,
  now,
  canModify,
  menuDisabled,
  registerMenuTrigger,
  onEdit,
  onRemove,
  editor,
  children,
}: AnnouncementNoteProps): ReactElement {
  // A menu action opens an editor or confirmation that owns focus next. It runs
  // only once the menu has unmounted (its focus trap would otherwise steal
  // focus back), and the menu then must not return focus to its trigger.
  const pendingActionRef = useRef<(() => void) | null>(null);
  const wasEdited = item.updatedAt !== item.createdAt;
  const absolute = formatInstant(item.createdAt);
  const roleLabel =
    author.role === 'TEACHER'
      ? copy.roleTeacher
      : author.role === 'STUDENT'
        ? copy.roleStudent
        : null;

  return (
    <li className="relative min-w-0">
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-1/2 z-10 h-5 w-20 -translate-x-1/2 -rotate-1 rounded-xs bg-warning-edge/70"
      />
      <article className="min-w-0 rounded-2xl border border-edge bg-card px-4 pt-6 pb-5 shadow-ambient sm:px-7 sm:pt-7 sm:pb-6">
        <header className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-base font-semibold text-secondary-foreground shadow-[0_2px_0_var(--key-secondary)]"
          >
            {noticeAuthorInitials(author.name)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-display text-base font-semibold break-words text-foreground">
                {author.name}
              </span>
              {roleLabel ? (
                <Badge variant="secondary" className="px-2.5 py-0.5 text-xs">
                  {roleLabel}
                </Badge>
              ) : null}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              <time dateTime={item.createdAt} title={absolute}>
                <span className="font-semibold text-foreground">
                  {formatNoticeAge(item.createdAt, now)}
                </span>
              </time>
              <span aria-hidden="true">·</span>
              <span>{absolute}</span>
              {wasEdited ? (
                <span>
                  {copy.updatedAtLabel}{' '}
                  <time dateTime={item.updatedAt}>
                    {formatInstant(item.updatedAt)}
                  </time>
                </span>
              ) : null}
            </p>
          </div>

          {canModify ? (
            <div className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={registerMenuTrigger}
                    type="button"
                    disabled={menuDisabled}
                    aria-label={copy.actionsAriaLabel(item.title)}
                    className={buttonStyles({
                      variant: 'outline',
                      size: 'icon',
                      disabled: menuDisabled,
                    })}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="currentColor"
                    >
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  onCloseAutoFocus={(event) => {
                    const pending = pendingActionRef.current;
                    if (pending) {
                      pendingActionRef.current = null;
                      event.preventDefault();
                      pending();
                    }
                  }}
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      pendingActionRef.current = () => onEdit(item);
                    }}
                  >
                    {copy.editLabel}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    tone="destructive"
                    onSelect={() => {
                      pendingActionRef.current = () => onRemove(item);
                    }}
                  >
                    {copy.removeLabel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </header>

        {editor ? (
          <div className="mt-4">{editor}</div>
        ) : (
          <div className="mt-4 space-y-2">
            <h4 className="font-display text-xl leading-snug font-semibold break-words text-foreground">
              {item.title}
            </h4>
            <p className="max-w-[68ch] text-base leading-relaxed break-words whitespace-pre-wrap text-foreground">
              {item.content}
            </p>
            {item.mentionedUserIds.length > 0 ? (
              <p>
                <Badge variant="info" className="px-2.5 py-0.5 text-xs">
                  {copy.mentionsLabel(item.mentionedUserIds.length)}
                </Badge>
              </p>
            ) : null}
          </div>
        )}

        {children ? <div className="mt-4">{children}</div> : null}
      </article>
    </li>
  );
}
