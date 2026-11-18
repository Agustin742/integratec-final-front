import { useEffect, useId, useRef } from 'react';
import { ApiError } from '@/api/errors';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import {
  ANNOUNCEMENT_CONTENT_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  announcementFormSchema,
  type AnnouncementDto,
  type AnnouncementFormInput,
  type AnnouncementFormValues,
} from './announcement-schema';
import {
  createClassroomAnnouncement,
  isUncertainAnnouncementError,
  updateClassroomAnnouncement,
} from './announcement-service';
import { announcementMessages } from './messages';

export type AnnouncementFormMode =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly announcement: AnnouncementDto };

export interface AnnouncementFormProps {
  readonly classroomId: string;
  readonly mode: AnnouncementFormMode;
  readonly onSuccess: (saved: AnnouncementDto, mode: 'create' | 'edit') => void;
  readonly onReconcileRequired: () => void;
  readonly onCancelEdit?: () => void;
}

export function AnnouncementForm({
  classroomId,
  mode,
  onSuccess,
  onReconcileRequired,
  onCancelEdit,
}: AnnouncementFormProps) {
  const { client } = useSessionService();
  const headingId = useId();
  const isEdit = mode.kind === 'edit';
  const unmountAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    unmountAbortRef.current = controller;
    return () => {
      controller.abort();
      unmountAbortRef.current = null;
    };
  }, []);

  const form = useZodForm<AnnouncementFormInput, AnnouncementFormValues>({
    schema: announcementFormSchema,
    defaultValues: isEdit
      ? {
          title: mode.announcement.title,
          content: mode.announcement.content,
        }
      : {
          title: '',
          content: '',
        },
  });

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      try {
        const saved = isEdit
          ? await updateClassroomAnnouncement(
              client,
              classroomId,
              mode.announcement.id,
              { title: values.title, content: values.content },
              { signal: unmountAbortRef.current?.signal },
            )
          : await createClassroomAnnouncement(
              client,
              classroomId,
              { title: values.title, content: values.content },
              { signal: unmountAbortRef.current?.signal },
            );

        if (!isEdit) {
          form.reset({ title: '', content: '' });
        }
        onSuccess(saved, mode.kind);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (isUncertainAnnouncementError(error)) {
          onReconcileRequired();
        }
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError({
          kind: 'unexpected',
          status: null,
          code: null,
          userMessage: announcementMessages.form.serverErrors.uncertain,
        });
      }
    },
  );

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-base font-semibold text-foreground">
          {isEdit
            ? announcementMessages.form.editHeading
            : announcementMessages.form.publishHeading}
        </h3>
        {isEdit && onCancelEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onClick={onCancelEdit}
          >
            {announcementMessages.form.cancelEdit}
          </Button>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormRootError form={form} headingLevel="h4" />

        <FormField
          control={form.control}
          name="title"
          label={announcementMessages.form.titleLabel}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
              placeholder={announcementMessages.form.titlePlaceholder}
              disabled={isSubmitting}
              autoComplete="off"
            />
          )}
        </FormField>

        <FormField
          control={form.control}
          name="content"
          label={announcementMessages.form.contentLabel}
          description={announcementMessages.form.contentHelper}
        >
          {(fieldProps) => (
            <textarea
              {...fieldProps}
              rows={4}
              maxLength={ANNOUNCEMENT_CONTENT_MAX_LENGTH}
              placeholder={announcementMessages.form.contentPlaceholder}
              disabled={isSubmitting}
              className={cn(
                'motion-field flex min-h-24 w-full rounded-xl border-2 border-field-border bg-card px-4 py-2 text-base text-card-foreground shadow-inset placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive',
              )}
            />
          )}
        </FormField>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEdit
                ? announcementMessages.form.submittingEdit
                : announcementMessages.form.submittingPublish
              : isEdit
                ? announcementMessages.form.submitEdit
                : announcementMessages.form.submitPublish}
          </Button>
        </div>
      </form>
    </section>
  );
}
