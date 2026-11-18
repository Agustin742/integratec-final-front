import { useEffect, useId, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import { ApiError } from '@/api/errors';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useUnsavedChangesGuard,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import {
  CLASSROOM_NAME_MAX_LENGTH,
  CLASSROOM_SUBJECT_MAX_LENGTH,
  classroomFormSchema,
  toCreateClassroomPayload,
  toUpdateClassroomPayload,
  type ClassroomDetailResponseDto,
  type ClassroomFormInput,
  type ClassroomFormOutput,
  type ClassroomListItemDto,
} from './classroom-schema';
import {
  createClassroom,
  isUncertainWriteError,
  updateClassroom,
} from './classroom-service';
import { classroomMessages } from './messages';

export interface SchoolContextOption {
  readonly schoolId: string;
  readonly label: string;
}

export type ClassroomFormMode =
  | { readonly kind: 'create'; readonly defaultSchoolId?: string }
  | { readonly kind: 'edit'; readonly classroom: ClassroomListItemDto };

export interface ClassroomFormDialogProps {
  readonly open: boolean;
  readonly formKey: string;
  readonly mode: ClassroomFormMode | null;
  readonly availableSchools: readonly SchoolContextOption[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: (
    saved: ClassroomDetailResponseDto,
    mode: 'create' | 'edit',
  ) => void;
  readonly onForbidden: (mode: 'create' | 'edit') => void;
  readonly onReconcileRequired: () => void;
  readonly onDirtyStateChange?: (dirty: boolean) => void;
  readonly fallbackFocus: () => HTMLElement | null;
  readonly getTriggerElement?: () => HTMLElement | null;
}

const ADULT_MODE_OPTIONS = [
  {
    value: false,
    key: 'school' as const,
  },
  {
    value: true,
    key: 'adult' as const,
  },
] as const;

const selectControlClass =
  'motion-field min-h-11 w-full min-w-0 rounded-xl border-2 border-field-border bg-card px-4 py-2 text-base text-card-foreground shadow-inset focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive';

function focusIfUsable(element: HTMLElement | null | undefined): boolean {
  if (
    !element?.isConnected ||
    element.closest('[hidden], [inert], [aria-hidden="true"]') ||
    element.matches(':disabled, [aria-disabled="true"]')
  ) {
    return false;
  }
  element.focus();
  return document.activeElement === element;
}

export function ClassroomFormDialog({
  open,
  formKey,
  mode,
  availableSchools,
  onOpenChange,
  onSuccess,
  onForbidden,
  onReconcileRequired,
  onDirtyStateChange,
  fallbackFocus,
  getTriggerElement,
}: ClassroomFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const canDismissRef = useRef<() => boolean>(() => true);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (submitting) {
      return;
    }
    if (!canDismissRef.current()) {
      return;
    }
    onOpenChange(false);
  };

  if (!open || mode === null) {
    return null;
  }

  const isCreate = mode.kind === 'create';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        key={formKey}
        className="max-h-[calc(100dvh-2rem)] [overflow-wrap:anywhere]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!focusIfUsable(getTriggerElement?.())) {
            focusIfUsable(fallbackFocus());
          }
        }}
      >
        <DialogTitle>
          {isCreate
            ? classroomMessages.form.createTitle
            : classroomMessages.form.editTitle}
        </DialogTitle>
        <DialogDescription>
          {isCreate
            ? classroomMessages.form.createDescription
            : classroomMessages.form.editDescription}
        </DialogDescription>

        <ClassroomFormContent
          key={formKey}
          mode={mode}
          availableSchools={availableSchools}
          onSubmittingChange={setSubmitting}
          onCanDismissChange={(fn) => {
            canDismissRef.current = fn;
          }}
          onDirtyStateChange={onDirtyStateChange}
          onRequestClose={() => handleOpenChange(false)}
          onSuccess={onSuccess}
          onForbidden={onForbidden}
          onReconcileRequired={onReconcileRequired}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ClassroomFormContentProps {
  readonly mode: ClassroomFormMode;
  readonly availableSchools: readonly SchoolContextOption[];
  readonly onSubmittingChange: (submitting: boolean) => void;
  readonly onCanDismissChange: (fn: () => boolean) => void;
  readonly onDirtyStateChange?: (dirty: boolean) => void;
  readonly onRequestClose: () => void;
  readonly onSuccess: (
    saved: ClassroomDetailResponseDto,
    mode: 'create' | 'edit',
  ) => void;
  readonly onForbidden: (mode: 'create' | 'edit') => void;
  readonly onReconcileRequired: () => void;
}

function ClassroomFormContent({
  mode,
  availableSchools,
  onSubmittingChange,
  onCanDismissChange,
  onDirtyStateChange,
  onRequestClose,
  onSuccess,
  onForbidden,
  onReconcileRequired,
}: ClassroomFormContentProps) {
  const { client } = useSessionService();
  const modeDescId = useId();
  const modeGroupId = useId();

  const isCreate = mode.kind === 'create';
  const defaultValues: ClassroomFormInput =
    mode.kind === 'edit'
      ? {
          name: mode.classroom.name,
          subject: mode.classroom.subject ?? '',
          adultMode: mode.classroom.adultMode,
          schoolId: '',
        }
      : {
          name: '',
          subject: '',
          adultMode: false,
          schoolId: mode.defaultSchoolId ?? '',
        };

  const form = useZodForm<ClassroomFormInput, ClassroomFormOutput>({
    schema: classroomFormSchema,
    defaultValues,
  });

  const isDirty = form.formState.isDirty;
  const { confirmNavigation } = useUnsavedChangesGuard(isDirty, {
    message: classroomMessages.form.actions.unsavedChanges,
  });

  useEffect(() => {
    onCanDismissChange(confirmNavigation);
  }, [onCanDismissChange, confirmNavigation]);

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [onDirtyStateChange, isDirty]);

  const onValid = async (values: ClassroomFormOutput): Promise<void> => {
    onSubmittingChange(true);
    try {
      const saved =
        mode.kind === 'create'
          ? await createClassroom(client, toCreateClassroomPayload(values))
          : await updateClassroom(
              client,
              mode.classroom.id,
              toUpdateClassroomPayload(values),
            );
      onSuccess(saved, mode.kind);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.kind === 'forbidden' || error.status === 403)
      ) {
        onForbidden(mode.kind);
        if (mode.kind === 'edit') {
          onReconcileRequired();
        }
      } else if (isUncertainWriteError(error)) {
        onReconcileRequired();
      }
      throw error;
    } finally {
      onSubmittingChange(false);
    }
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(form, onValid, {
    knownFields: isCreate
      ? ['name', 'subject', 'adultMode', 'schoolId']
      : ['name', 'subject', 'adultMode'],
  });

  const hasSchoolError = Boolean(form.formState.errors.schoolId);
  const showSchoolSelect = isCreate && availableSchools.length > 1;
  const showSchoolManualInput =
    isCreate && availableSchools.length <= 1 && hasSchoolError;

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-5">
      <FormRootError
        form={form}
        headingLevel="h3"
        title={classroomMessages.form.errors.rootTitle}
      />

      <FormField
        control={form.control}
        name="name"
        label={classroomMessages.form.fields.name.label}
        description={classroomMessages.form.fields.name.description}
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="text"
            maxLength={CLASSROOM_NAME_MAX_LENGTH}
            placeholder={classroomMessages.form.fields.name.placeholder}
          />
        )}
      </FormField>

      <FormField
        control={form.control}
        name="subject"
        label={classroomMessages.form.fields.subject.label}
        description={classroomMessages.form.fields.subject.description}
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="text"
            maxLength={CLASSROOM_SUBJECT_MAX_LENGTH}
            placeholder={classroomMessages.form.fields.subject.placeholder}
          />
        )}
      </FormField>

      {showSchoolSelect && (
        <FormField
          control={form.control}
          name="schoolId"
          label={classroomMessages.form.fields.schoolId.label}
          description={classroomMessages.form.fields.schoolId.description}
        >
          {(fieldProps) => (
            <select {...fieldProps} className={selectControlClass}>
              <option value="">
                {classroomMessages.form.fields.schoolId.selectPlaceholder}
              </option>
              {availableSchools.map((school) => (
                <option key={school.schoolId} value={school.schoolId}>
                  {school.label}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}

      {showSchoolManualInput && (
        <FormField
          control={form.control}
          name="schoolId"
          label={classroomMessages.form.fields.schoolId.label}
          description={classroomMessages.form.fields.schoolId.description}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              placeholder={
                classroomMessages.form.fields.schoolId.uuidPlaceholder
              }
            />
          )}
        </FormField>
      )}

      <fieldset aria-describedby={modeDescId} className="space-y-2.5">
        <legend className="text-sm font-semibold text-foreground">
          {classroomMessages.form.fields.adultMode.legend}
        </legend>
        <p id={modeDescId} className="text-sm text-muted-foreground">
          {classroomMessages.form.fields.adultMode.description}
        </p>

        <Controller
          control={form.control}
          name="adultMode"
          render={({ field }) => (
            <div className="space-y-2.5 pt-1">
              {ADULT_MODE_OPTIONS.map((option) => {
                const copy =
                  classroomMessages.form.fields.adultMode.options[option.key];
                const isSelected = field.value === option.value;
                const radioId = `${modeGroupId}-${option.key}`;
                const radioTitleId = `${radioId}-title`;
                const radioDescId = `${radioId}-desc`;
                return (
                  <div key={option.key} className="relative">
                    <input
                      id={radioId}
                      type="radio"
                      name={field.name}
                      value={String(option.value)}
                      checked={isSelected}
                      aria-labelledby={radioTitleId}
                      aria-describedby={radioDescId}
                      onBlur={field.onBlur}
                      onChange={() => {
                        field.onChange(option.value);
                        form.clearErrors('root.serverError');
                      }}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={radioId}
                      className={cn(
                        'block min-h-11 cursor-pointer rounded-2xl border-2 p-3.5 motion-safe:transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ring',
                        isSelected
                          ? 'border-primary bg-tray/80 shadow-[0_3px_0_var(--key-sand)]'
                          : 'border-edge bg-card hover:bg-tray/45',
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-2.5 font-display text-base font-semibold text-foreground">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                            isSelected
                              ? 'border-primary bg-card'
                              : 'border-muted-foreground/50 bg-card',
                          )}
                        >
                          {isSelected && (
                            <span className="size-2.5 rounded-full bg-primary" />
                          )}
                        </span>
                        <span id={radioTitleId}>{copy.title}</span>
                        <Badge
                          variant={isSelected ? 'default' : 'outline'}
                          className="ml-auto shrink-0 px-2.5 py-0.5 text-xs"
                        >
                          {copy.badge}
                        </Badge>
                      </span>
                      <span
                        id={radioDescId}
                        className="mt-1.5 block pl-7 text-sm text-pretty text-muted-foreground"
                      >
                        {copy.description}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        />
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onRequestClose}
        >
          {classroomMessages.form.actions.cancel}
        </Button>
        <Button type="submit" busy={isSubmitting}>
          {isSubmitting
            ? isCreate
              ? classroomMessages.form.actions.createPending
              : classroomMessages.form.actions.editPending
            : isCreate
              ? classroomMessages.form.actions.createSubmit
              : classroomMessages.form.actions.editSubmit}
        </Button>
      </div>
    </form>
  );
}
