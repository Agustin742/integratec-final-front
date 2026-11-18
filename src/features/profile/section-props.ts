import type { Avatar } from './avatar-options';
import type { OwnProfileDto } from './profile-schema';

/** What every editable section of the profile page receives from the view. */
export interface ProfileSectionProps {
  /** Confirmed profile as the server last returned it. */
  readonly profile: OwnProfileDto;
  /** Records a server-confirmed change in the cache and the session. */
  readonly commit: (
    patch: Partial<{ displayName: string; avatar: Avatar }>,
  ) => void;
  /** Re-reads the authoritative profile; `null` when it cannot be read. */
  readonly reconcile: () => Promise<OwnProfileDto | null>;
  /** Reports whether the section holds an unsaved draft. */
  readonly onDirtyChange: (dirty: boolean) => void;
}
