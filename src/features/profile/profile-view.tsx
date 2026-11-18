import { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router';
import {
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { useSessionSnapshot } from '@/session/provider';
import { AvatarForm } from './avatar-form';
import { DisplayNameForm } from './display-name-form';
import { profileMessages } from './messages';
import { useOwnProfile } from './use-own-profile';

export interface ProfileViewProps {
  readonly title: string;
}

type Section = 'displayName' | 'avatar';

/**
 * Profile page body (HU-AUT-003, part 1/2): loads the confirmed profile and
 * renders the editable sections. Loading, failure and stale data are distinct
 * states; no section is rendered from a guess about what is saved.
 */
export function ProfileView({ title }: ProfileViewProps) {
  const { query, commit, reconcile } = useOwnProfile();
  const snapshot = useSessionSnapshot();
  const [dirty, setDirty] = useState<Record<Section, boolean>>({
    displayName: false,
    avatar: false,
  });
  const hasDraft = dirty.displayName || dirty.avatar;
  const authenticated = snapshot.status === 'authenticated';

  // In-app navigation away from an unsaved draft asks first; the browser-level
  // `beforeunload` guard lives in each section's form. A session that is
  // ending is never held hostage by a draft.
  const blocker = useBlocker(hasDraft && authenticated);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(profileMessages.leaveConfirm)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  const onDisplayNameDirty = useCallback(
    (value: boolean) => setDirty((prev) => ({ ...prev, displayName: value })),
    [],
  );
  const onAvatarDirty = useCallback(
    (value: boolean) => setDirty((prev) => ({ ...prev, avatar: value })),
    [],
  );

  const profile = query.data;

  return (
    <section className="space-y-6" data-profile-page="true">
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {profileMessages.page.subtitle}
        </p>
      </div>

      {profile === undefined && query.isError && (
        <ErrorState
          title={profileMessages.loadError.title}
          description={profileMessages.loadError.description}
          error={query.error}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {profile === undefined && !query.isError && (
        <LoadingState label={profileMessages.loading} skeletonLines={4} />
      )}

      {profile !== undefined && (
        <>
          {query.isError && (
            <StaleDataNotice
              title={profileMessages.stale.title}
              description={profileMessages.stale.description}
              onRetry={() => void query.refetch()}
              isRetrying={query.isFetching}
            />
          )}

          <dl className="rounded-2xl border border-edge bg-tray/60 p-4 text-sm">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {profileMessages.page.emailLabel}
            </dt>
            <dd className="font-semibold text-foreground">{profile.email}</dd>
            <dd className="text-muted-foreground">
              {profileMessages.page.emailNote}
            </dd>
          </dl>

          {/* Keyed by account: a draft never survives an account switch. */}
          <DisplayNameForm
            key={`name-${profile.id}`}
            profile={profile}
            commit={commit}
            reconcile={reconcile}
            onDirtyChange={onDisplayNameDirty}
          />
          <AvatarForm
            key={`avatar-${profile.id}`}
            profile={profile}
            commit={commit}
            reconcile={reconcile}
            onDirtyChange={onAvatarDirty}
          />
        </>
      )}
    </section>
  );
}
