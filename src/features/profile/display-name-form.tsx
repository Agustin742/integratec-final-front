import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '@/api/errors';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useUnsavedChangesGuard,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionService } from '@/session/provider';
import { profileMessages } from './messages';
import {
  displayNameFormSchema,
  type DisplayNameFormInput,
  type DisplayNameFormOutput,
  type OwnProfileDto,
} from './profile-schema';
import { saveDisplayName } from './profile-service';
import { SaveStatusBadge, type SaveStatus } from './save-status';
import type { ProfileSectionProps } from './section-props';

const copy = profileMessages.displayName;

export function DisplayNameForm({
  profile,
  commit,
  reconcile,
  onDirtyChange,
}: ProfileSectionProps) {
  const { client } = useSessionService();
  const headingId = useId();
  const [announcement, setAnnouncement] = useState('');
  const confirmedName = profile.displayName;

  const form = useZodForm<DisplayNameFormInput, DisplayNameFormOutput>({
    schema: displayNameFormSchema,
    defaultValues: { displayName: confirmedName },
  });
  const { isDirty } = form.formState;
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Follow the confirmed value (another device, a reconcile) only while the
  // user has no draft: an edit in progress is never overwritten.
  useEffect(() => {
    if (!isDirtyRef.current) {
      form.reset({ displayName: confirmedName });
    }
  }, [confirmedName, form]);

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  useUnsavedChangesGuard(isDirty, {
    message: profileMessages.leaveConfirm,
  });

  const confirm = (saved: OwnProfileDto['displayName']): void => {
    commit({ displayName: saved });
    form.reset({ displayName: saved });
    setAnnouncement(copy.confirmed);
  };

  const onValid = async (values: DisplayNameFormOutput): Promise<void> => {
    setAnnouncement('');
    try {
      const saved = await saveDisplayName(client, values.displayName);
      confirm(saved.displayName);
    } catch (error) {
      // An unreadable outcome is reconciled with the server before anything
      // is claimed or repeated.
      if (error instanceof ApiError && error.kind === 'network') {
        let fresh: OwnProfileDto | null = null;
        try {
          fresh = await reconcile();
        } catch {
          fresh = null;
        }
        if (fresh !== null && fresh.displayName === values.displayName) {
          confirm(fresh.displayName);
          return;
        }
      }
      throw error;
    }
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(form, onValid, {
    knownFields: ['displayName'],
  });

  const hasFailure =
    form.formState.errors.root?.serverError !== undefined ||
    form.formState.errors.displayName !== undefined;
  let status: SaveStatus = 'saved';
  if (isSubmitting) status = 'saving';
  else if (hasFailure) status = 'failed';
  else if (isDirty) status = 'unsaved';

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-2xl border border-edge bg-card p-5 shadow-panel"
    >
      <div className="space-y-1">
        <h3
          id={headingId}
          className="font-display text-lg font-bold text-foreground"
        >
          {copy.heading}
        </h3>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <FormRootError form={form} headingLevel="h4" title={copy.rootTitle} />
        <FormField
          control={form.control}
          name="displayName"
          label={copy.label}
          description={copy.hint}
        >
          {(fieldProps) => (
            <Input {...fieldProps} type="text" autoComplete="nickname" />
          )}
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            busy={isSubmitting}
            disabled={!isDirty && !isSubmitting}
          >
            {isSubmitting ? copy.submitting : copy.submit}
          </Button>
          <SaveStatusBadge status={status} announcement={announcement} />
        </div>
      </form>
    </section>
  );
}
