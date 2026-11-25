import { callMessages } from './call-messages';

/** Only students lose the 3D world; moderators and other roles are unaffected. */
export function isWorldLocked(myRole: string, focusMode: boolean): boolean {
  return focusMode && myRole === 'STUDENT';
}

/** Calm replacement shown where the 3D world would be during focus mode. */
export function FocusModeNotice() {
  return (
    <div
      role="status"
      className="space-y-1 rounded-2xl border border-edge bg-card px-4 py-3 text-card-foreground"
    >
      <p className="font-display text-lg font-semibold">
        {callMessages.focus.title}
      </p>
      <p className="text-sm text-muted-foreground">{callMessages.focus.body}</p>
    </div>
  );
}
