import type { ReactNode } from 'react';
import type { CallEmote } from '@/realtime/call-contracts.generated';

function Icon({ children }: { readonly children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="size-5 shrink-0 fill-none stroke-current stroke-2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <Icon>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Icon>
  );
}

export function PhoneOffIcon() {
  return (
    <Icon>
      <path d="M3 14c5-5 13-5 18 0l-2.5 3-3-1.5V13a9 9 0 0 0-7 0v2.5L5.5 17Z" />
    </Icon>
  );
}

export function MicIcon() {
  return (
    <Icon>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icon>
  );
}

export function MicOffIcon() {
  return (
    <Icon>
      <path d="M9 9v2a3 3 0 0 0 5 2.2M15 9.5V6a3 3 0 0 0-5.6-1.5M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18" />
    </Icon>
  );
}

export function ReactionIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </Icon>
  );
}

export function ChatIcon() {
  return (
    <Icon>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12Z" />
    </Icon>
  );
}

export function ShieldIcon() {
  return (
    <Icon>
      <path d="M12 3 4.5 6v5.5c0 4.4 3 8 7.5 9.5 4.5-1.5 7.5-5.1 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

const EMOTE_PATHS: Record<CallEmote, ReactNode> = {
  wave: (
    <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10m0-4V4.5a1.5 1.5 0 0 1 3 0V10m0-4.5a1.5 1.5 0 0 1 3 0V11m0-3.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 6 16.5V12a1.5 1.5 0 0 1 1-1.4" />
  ),
  happy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 13.5a4.5 4.5 0 0 0 8 0M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  sad: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 16.5a4 4 0 0 1 7 0M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  angry: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 16h8M7.5 8l3 1.5M16.5 8l-3 1.5" />
    </>
  ),
  think: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M10 18h4M10.5 21h3M9.5 8.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4" />
    </>
  ),
  celebrate: (
    <path d="M12 3v3M5 6l2 2M19 6l-2 2M3 13h3M18 13h3M8 21l2-9 5 5-7 4Zm0 0 8-1" />
  ),
};

export function EmoteIcon({ emote }: { readonly emote: CallEmote }) {
  return <Icon>{EMOTE_PATHS[emote]}</Icon>;
}
