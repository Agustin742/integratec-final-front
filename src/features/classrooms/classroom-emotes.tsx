import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  isEditableTarget,
  isInteractionBlocked,
} from '@/lib/input-arbitration';
import { cn } from '@/lib/utils';
import {
  AVATAR_EMOTE_COOLDOWN_MS,
  AVATAR_EMOTES,
  type AvatarEmote,
} from '@/realtime/contracts.generated';
import { classroomMessages } from './messages';

/** Controls that Space already activates; the wheel must not take the press. */
const SPACE_CONTROL_SELECTOR =
  'button, input, select, textarea, summary, audio, video, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"], [role="slider"], [role="combobox"]';

function ownsSpace(target: EventTarget | null): boolean {
  if (isEditableTarget(target)) return true;
  return (
    target instanceof Element && target.closest(SPACE_CONTROL_SELECTOR) !== null
  );
}

const copy = classroomMessages.emotes;

const ICON_PATHS: Record<AvatarEmote, readonly string[]> = {
  Wave: [
    'M8 13V6a1.5 1.5 0 0 1 3 0v5V4.500a1.500 1.500 0 0 1 3 0V11V6a1.500 1.500 0 0 1 3 0v8a7 7 0 0 1-12.500 4L4 13.500a1.500 1.500 0 0 1 2.500-1.500L8 13.500',
    'M19 3c1 .7 1.700 1.700 2 3',
  ],
  Cheer: [
    'M12 3l2.500 5.500 6 .700-4.500 4 1.300 5.800-5.300-3-5.300 3 1.300-5.800-4.500-4 6-.700Z',
  ],
  Clap: [
    'M9 12 6.500 8.500a1.400 1.400 0 0 1 2.300-1.600L13 13M11 10 9 6.500a1.400 1.400 0 0 1 2.400-1.400L16 13c2 4-1 8-5 8-3 0-4-1.500-7-6.500a1.400 1.400 0 0 1 2.300-1.500L8 15',
    'M17 3v3M21 6l-2 2',
  ],
  Dance: [
    'M9 18V5l11-2v13',
    'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM17 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  ],
  RaiseHand: [
    'M12 21v-9M12 12V3M12 3 9 6M12 3l3 3',
    'M5 21v-3a7 7 0 0 1 14 0v3',
  ],
};

function EmoteIcon({ icon }: { readonly icon: AvatarEmote }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const FOCUS_RING =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';
const CARD =
  'pointer-events-auto border border-edge bg-card/90 font-display text-sm font-semibold text-card-foreground shadow-panel backdrop-blur-md hover:bg-card';

/** Distance from the wheel centre to each choice, which leaves the avatar visible. */
const RADIUS_REM = 7;

function slotPosition(index: number) {
  const angle = (index / AVATAR_EMOTES.length) * 2 * Math.PI - Math.PI / 2;
  return {
    left: `calc(50% + ${(Math.cos(angle) * RADIUS_REM).toFixed(2)}rem)`,
    top: `calc(50% + ${(Math.sin(angle) * RADIUS_REM).toFixed(2)}rem)`,
  };
}

export interface ClassroomEmotesProps {
  /** False without a live connection or while a panel is open. */
  readonly available: boolean;
  /** Returns whether the emote was sent. */
  readonly onSelect: (emote: AvatarEmote) => boolean;
}

/**
 * Emote wheel of the 3D classroom (#154): Space opens it. The
 * avatar only plays once the room announces the emote, so this just sends.
 * Choices stay disabled for the server cooldown, which drops early attempts.
 */
export function ClassroomEmotes({ available, onSelect }: ClassroomEmotesProps) {
  const [open, setOpen] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);

  if (open && !available) setOpen(false);

  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setTimeout(
      () => setCoolingDown(false),
      AVATAR_EMOTE_COOLDOWN_MS,
    );
    return () => window.clearTimeout(timer);
  }, [coolingDown]);

  const openWheel = () => {
    invokerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setOpen(true);
  };

  const closeWheel = () => {
    setOpen(false);
    const invoker = invokerRef.current;
    if (invoker && invoker !== document.body && invoker.isConnected) {
      invoker.focus();
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  useEffect(() => {
    if (!available || open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented) {
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (ownsSpace(event.target) || ownsSpace(document.activeElement)) return;
      if (isInteractionBlocked()) return;
      event.preventDefault();
      openWheel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [available, open]);

  useEffect(() => {
    if (!open) return;
    wheelRef.current?.querySelector('button')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!wheelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeWheel();
      return;
    }
    // A Space still held from opening the wheel must not pick a choice.
    if (event.repeat && event.key === ' ') {
      event.preventDefault();
      return;
    }
    const back =
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp' ||
      (event.key === 'Tab' && event.shiftKey);
    const forward =
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      (event.key === 'Tab' && !event.shiftKey);
    if (!back && !forward) return;
    event.preventDefault();
    const buttons = [...(wheelRef.current?.querySelectorAll('button') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[
      (index + (back ? -1 : 1) + buttons.length) % buttons.length
    ]?.focus();
  };

  const pick = (emote: AvatarEmote) => {
    if (coolingDown) return;
    if (onSelect(emote)) setCoolingDown(true);
    closeWheel();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center">
      <div
        ref={wheelRef}
        role="dialog"
        aria-label={copy.wheelLabel}
        className="relative size-76 motion-safe:animate-dialog-in"
      >
        {AVATAR_EMOTES.map((emote, index) => (
          <button
            key={emote}
            type="button"
            aria-disabled={coolingDown}
            onClick={() => pick(emote)}
            onKeyDown={handleKeyDown}
            style={slotPosition(index)}
            className={cn(
              CARD,
              FOCUS_RING,
              'motion-colors absolute flex size-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full p-1 text-center text-xs leading-tight aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
            )}
          >
            <EmoteIcon icon={emote} />
            {copy.names[emote]}
          </button>
        ))}
        <p
          role="status"
          className={cn(
            coolingDown
              ? 'pointer-events-none absolute inset-x-0 -bottom-6 mx-auto w-max max-w-full rounded-xl bg-card px-3 py-1 text-center text-xs text-card-foreground shadow-panel'
              : 'sr-only',
          )}
        >
          {coolingDown ? copy.cooldown : ''}
        </p>
      </div>
    </div>
  );
}
