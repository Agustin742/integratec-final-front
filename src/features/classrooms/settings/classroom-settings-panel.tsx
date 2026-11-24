import { useId, useState } from 'react';
import { useParams } from 'react-router';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClassroomInvitationsPanel } from '../classroom-invitations-panel';
import { useClassroomContext } from '../use-classroom-capabilities';
import { ClassroomSettingsForm } from './classroom-settings-form';
import { settingsMessages } from './messages';
import { SettingsSection } from './settings-section';

export interface ClassroomSettingsPanelProps {
  readonly classroomId?: string;
}

/**
 * Staff-only classroom settings. Everything is driven by
 * `PATCH /classrooms/{id}`; access management reuses the invitations panel
 * instead of duplicating it. Gated by the server capability
 * `configure_classroom` (the panel is also only listed for that capability).
 */
export function ClassroomSettingsPanel({
  classroomId: propClassroomId,
}: ClassroomSettingsPanelProps = {}) {
  const params = useParams<{ classroomId: string }>();
  const classroomId = propClassroomId ?? params.classroomId ?? '';
  const context = useClassroomContext(classroomId, {
    enabled: classroomId !== '',
  });

  if (context.status === 'pending') {
    return <LoadingState label={settingsMessages.loading} skeletonLines={5} />;
  }

  if (context.status === 'error') {
    const isTerminalDenied =
      context.error.kind === 'forbidden' ||
      context.error.status === 403 ||
      context.error.kind === 'not-found' ||
      context.error.status === 404;
    return isTerminalDenied ? (
      <ErrorState
        headingLevel="h3"
        title={settingsMessages.forbiddenTitle}
        description={settingsMessages.forbiddenDescription}
      />
    ) : (
      <ErrorState
        headingLevel="h3"
        title={settingsMessages.loadErrorTitle}
        description={settingsMessages.loadErrorDescription}
        onRetry={context.retry}
      />
    );
  }

  const { classroom, userId } = context;
  if (!classroom.capabilities.includes('configure_classroom')) {
    return (
      <ErrorState
        headingLevel="h3"
        title={settingsMessages.forbiddenTitle}
        description={settingsMessages.forbiddenDescription}
      />
    );
  }

  return (
    <div className="min-w-0">
      <ClassroomSettingsForm
        key={`${userId}:${classroom.id}`}
        userId={userId}
        classroom={classroom}
      />
      {classroom.capabilities.includes('invite_members') && (
        <AccessSection classroomId={classroom.id} />
      )}
    </div>
  );
}

function AccessSection({ classroomId }: { readonly classroomId: string }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const copy = settingsMessages.sections.access;

  return (
    <SettingsSection title={copy.title} description={copy.description}>
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((current) => !current)}
        className="h-auto w-full min-w-0 justify-between gap-3 py-3 text-left whitespace-normal"
      >
        <span className="min-w-0">
          <span className="block font-semibold">{copy.toggle}</span>
          <span className="block text-sm font-normal text-muted-foreground">
            {copy.toggleHint}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'shrink-0 text-lg motion-safe:transition-transform',
            open && 'rotate-180',
          )}
        >
          ▾
        </span>
      </Button>
      <div id={regionId} hidden={!open}>
        {open && <ClassroomInvitationsPanel classroomId={classroomId} />}
      </div>
    </SettingsSection>
  );
}
