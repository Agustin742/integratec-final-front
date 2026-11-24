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
  isAbortError,
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
  readonly onSubmitStart?: () => void;
  readonly onSubmitSettled?: () => void;
  readonly onEditTargetMissing?: () => void;
  readonly onSuccess: (saved: AnnouncementDto, mode: 'create' | 'edit') => void;
  readonly onReconcileRequired: (resetPage: boolean) => void;
  /** Reconciles after an uncertain create; resolves true when the draft was found published. */
  readonly onUncertainCreate: (values: {
    readonly title: string;
    readonly content: string;
  }) => Promise<boolean>;
  readonly onCancelEdit?: () => void;
  /** Closes the composer without publishing (create mode only). */
  readonly onCancelCreate?: () => void;
}

export function AnnouncementForm({
  classroomId,
  mode,
  onSubmitStart,
  onSubmitSettled,
  onEditTargetMissing,
  onSuccess,
  onReconcileRequired,
  onUncertainCreate,
  onCancelEdit,
  onCancelCreate,
}: AnnouncementFormProps) {
  const { client } = useSessionService();
  const headingId = useId();
  const isEdit = mode.kind === 'edit';
  const unmountAbortRef = useRef<AbortController | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    unmountAbortRef.current = controller;
    return () => {
      controller.abort();
      unmountAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    titleInputRef.current?.focus();
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
      onSubmitStart?.();
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
        if (isAbortError(error)) {
          return;
        }
        if (isEdit && error instanceof ApiError && error.status === 404) {
          onEditTargetMissing?.();
          return;
        }
        if (isUncertainAnnouncementError(error)) {
          if (isEdit) {
            onReconcileRequired(false);
          } else {
            const published = await onUncertainCreate({
              title: values.title,
              content: values.content,
            });
            if (published) {
              form.reset({ title: '', content: '' });
              return;
            }
            throw new ApiError({
              kind: 'unexpected',
              status: null,
              code: null,
              userMessage:
                announcementMessages.form.serverErrors.uncertainCreate,
            });
          }
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
      } finally {
        onSubmitSettled?.();
      }
    },
  );

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'min-w-0',
        isEdit
          ? 'rounded-xl border-2 border-dashed border-edge bg-tray/40 p-4'
          : 'rounded-2xl border border-edge bg-card p-4 shadow-ambient sm:p-5',
      )}
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
              ref={(el) => {
                fieldProps.ref(el);
                titleInputRef.current = el;
              }}
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
          {!isEdit && onCancelCreate ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={onCancelCreate}
            >
              {announcementMessages.composer.discard}
            </Button>
          ) : null}
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
