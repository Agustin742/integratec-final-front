import { useId, type BaseSyntheticEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { ApiError } from '@/api/errors';
import { classroomActivityDetailQueryKey } from '@/api/query-keys';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useUnsavedChangesGuard,
  useZodForm,
} from '@/components/forms/form-primitives';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DEFAULT_SCHOOL_TIME_ZONE, formatInstant } from '@/lib/dates';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { cn } from '@/lib/utils';
import { classroomMessages } from '../messages';
import {
  createClassroomActivity,
  getClassroomActivity,
  isAbortError,
  isUncertainWriteError,
  updateClassroomActivity,
} from './activity-service';
import {
  toCreateActivityDto,
  toUpdateActivityDto,
  type CreateActivityPayload,
  type TeacherActivityResponseDto,
  type UpdateActivityValidatedPayload,
} from './activity-schema';
import {
  activityEditorDefaultsFromDetail,
  createActivityEditorDefaults,
  createActivityEditorSchema,
  updateActivityEditorSchema,
  type ActivityEditorFormInput,
} from './activity-editor-schema';
import { datetimeLocalToInstantUtc } from './activity-school-datetime';
import { MultipleChoiceBuilder } from './multiple-choice-builder';

const messages = classroomMessages.activities.editor;

export type ActivityEditorFormOutput =
  CreateActivityPayload | UpdateActivityValidatedPayload;

/** Create/edit target of the editor dialog. */
export type ActivityEditorMode =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly activityId: string };

export interface ActivityEditorDialogProps {
  readonly open: boolean;
  /** Remounts the form for every open so state never leaks between targets. */
  readonly formKey: string;
  readonly classroomId: string;
  readonly mode: ActivityEditorMode | null;
  readonly onOpenChange: (open: boolean) => void;
  /** Server-confirmed save; the panel reconciles and offers publishing. */
  readonly onSaved: (
    saved: TeacherActivityResponseDto,
    mode: 'create' | 'edit',
  ) => void;
  /** 403/404/uncertain outcomes: reconcile the list before retrying. */
  readonly onReconcileRequired: () => void;
  readonly getTriggerElement?: () => HTMLElement | null;
  readonly fallbackFocus: () => HTMLElement | null;
}

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

/**
 * Teacher activity editor (`HU-ACT-001`, T3): creates and edits TP/EXAM drafts
 * with an accessible multiple-choice builder. Validation reuses the payload
 * schemas from `activity-schema.ts` through `@hookform/resolvers`;
 * datetime-local values are entered in the school time zone and converted to
 * UTC instants with an explicit offset on submit; pending writes disable the
 * form; server `400`s keep field errors and all entered input; and leaving
 * with unsaved changes asks for confirmation.
 */
export function ActivityEditorDialog({
  open,
  formKey,
  classroomId,
  mode,
  onOpenChange,
  onSaved,
  onReconcileRequired,
  getTriggerElement,
  fallbackFocus,
}: ActivityEditorDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const canDismissRef = useRef<() => boolean>(() => true);

  const handleOpenChange = (nextOpen: boolean): void => {
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        key={formKey}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xl [overflow-wrap:anywhere]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!focusIfUsable(getTriggerElement?.())) {
            focusIfUsable(fallbackFocus());
          }
        }}
      >
        <DialogTitle>
          {mode.kind === 'create' ? messages.createTitle : messages.editTitle}
        </DialogTitle>
        <DialogDescription>
          {mode.kind === 'create'
            ? messages.createDescription
            : messages.editDescription}
        </DialogDescription>

        <ActivityEditorContent
          key={formKey}
          classroomId={classroomId}
          mode={mode}
          onSaved={onSaved}
          onReconcileRequired={onReconcileRequired}
          onSubmittingChange={setSubmitting}
          onCanDismissChange={(fn) => {
            canDismissRef.current = fn;
          }}
          onRequestClose={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ActivityEditorContentProps {
  readonly classroomId: string;
  readonly mode: ActivityEditorMode;
  readonly onSaved: (
    saved: TeacherActivityResponseDto,
    mode: 'create' | 'edit',
  ) => void;
  readonly onReconcileRequired: () => void;
  readonly onSubmittingChange: (submitting: boolean) => void;
  readonly onCanDismissChange: (fn: () => boolean) => void;
  readonly onRequestClose: () => void;
}

function ActivityEditorContent(props: ActivityEditorContentProps) {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const { mode, classroomId } = props;

  // Edit mode loads the teacher view (questions with correct answers) through
  // the scoped detail query; create mode renders the blank form directly.
  const detailQuery = useQuery({
    queryKey: classroomActivityDetailQueryKey(
      userId ?? 'signed-out',
      classroomId,
      mode.kind === 'edit' ? mode.activityId : 'create',
    ),
    queryFn: ({ signal }) =>
      getClassroomActivity(
        client,
        classroomId,
        mode.kind === 'edit' ? mode.activityId : '',
        { signal },
      ),
    enabled: mode.kind === 'edit' && userId !== null,
    staleTime: 0,
  });

  if (mode.kind === 'create') {
    return (
      <CreateEditorForm
        client={client}
        classroomId={classroomId}
        onSaved={props.onSaved}
        onReconcileRequired={props.onReconcileRequired}
        onSubmittingChange={props.onSubmittingChange}
        onCanDismissChange={props.onCanDismissChange}
        onRequestClose={props.onRequestClose}
      />
    );
  }

  if (detailQuery.isPending) {
    return (
      <div className="mt-5">
        <LoadingState label={messages.loadingDetail} skeletonLines={4} />
      </div>
    );
  }

  if (detailQuery.isError) {
    const description =
      detailQuery.error instanceof ApiError
        ? detailQuery.error.userMessage
        : classroomMessages.activities.detail.errorDescription;
    return (
      <div className="mt-5">
        <ErrorState
          headingLevel="h3"
          title={messages.detailErrorTitle}
          description={description}
        />
      </div>
    );
  }

  if (detailQuery.data.kind !== 'teacher') {
    return (
      <div className="mt-5">
        <ErrorState
          headingLevel="h3"
          title={messages.detailErrorTitle}
          description={messages.detailNotTeacherView}
        />
      </div>
    );
  }

  return (
    <EditEditorForm
      client={client}
      classroomId={classroomId}
      activity={detailQuery.data.activity}
      onSaved={props.onSaved}
      onReconcileRequired={props.onReconcileRequired}
      onSubmittingChange={props.onSubmittingChange}
      onCanDismissChange={props.onCanDismissChange}
      onRequestClose={props.onRequestClose}
    />
  );
}

interface EditorFormShellProps<TOutput extends ActivityEditorFormOutput> {
  readonly form: UseFormReturn<ActivityEditorFormInput, unknown, TOutput>;
  readonly modeKind: 'create' | 'edit';
  readonly timeZone: string;
  /** Edit mode: the stored exam window, `null` when none was defined. */
  readonly originalOpensAt: string | null;
  readonly write: (
    values: TOutput,
    signal: AbortSignal,
  ) => Promise<TeacherActivityResponseDto>;
  readonly onSaved: (
    saved: TeacherActivityResponseDto,
    mode: 'create' | 'edit',
  ) => void;
  readonly onReconcileRequired: () => void;
  readonly onSubmittingChange: (submitting: boolean) => void;
  readonly onCanDismissChange: (fn: () => boolean) => void;
  readonly onRequestClose: () => void;
}

/** Shared create/edit form body; `write` owns the mode-specific service call. */
function ActivityEditorFormShell<TOutput extends ActivityEditorFormOutput>({
  form,
  modeKind,
  timeZone,
  originalOpensAt,
  write,
  onSaved,
  onReconcileRequired,
  onSubmittingChange,
  onCanDismissChange,
  onRequestClose,
}: EditorFormShellProps<TOutput>) {
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isCreate = modeKind === 'create';
  const isDirty = form.formState.isDirty;
  const { confirmNavigation } = useUnsavedChangesGuard(isDirty, {
    message: messages.actions.unsavedChanges,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      onSubmittingChange(false);
    };
  }, [onSubmittingChange]);

  useEffect(() => {
    onCanDismissChange(confirmNavigation);
  }, [onCanDismissChange, confirmNavigation]);

  const onValid = async (values: TOutput): Promise<void> => {
    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
    onSubmittingChange(true);
    try {
      const saved = await write(values, controller.signal);
      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }
      onSaved(saved, modeKind);
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        !isMountedRef.current
      ) {
        return;
      }
      if (
        error instanceof ApiError &&
        (error.kind === 'forbidden' ||
          error.status === 403 ||
          error.kind === 'not-found' ||
          error.status === 404 ||
          isUncertainWriteError(error))
      ) {
        onReconcileRequired();
      }
      throw error;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      onSubmittingChange(false);
    }
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(form, onValid);

  return (
    <ActivityEditorFormFields
      form={form}
      isCreate={isCreate}
      isSubmitting={isSubmitting}
      timeZone={timeZone}
      originalOpensAt={originalOpensAt}
      handleSubmit={handleSubmit}
      onRequestClose={onRequestClose}
    />
  );
}

interface CreateEditorFormProps {
  readonly client: ReturnType<typeof useSessionService>['client'];
  readonly classroomId: string;
  readonly onSaved: (
    saved: TeacherActivityResponseDto,
    mode: 'create' | 'edit',
  ) => void;
  readonly onReconcileRequired: () => void;
  readonly onSubmittingChange: (submitting: boolean) => void;
  readonly onCanDismissChange: (fn: () => boolean) => void;
  readonly onRequestClose: () => void;
}

function CreateEditorForm(props: CreateEditorFormProps) {
  // Create mode has no server-reported time zone yet; the school default is
  // the explicit policy (FD11), never a browser guess.
  const schema = useMemo(
    () => createActivityEditorSchema({ timeZone: DEFAULT_SCHOOL_TIME_ZONE }),
    [],
  );

  const form = useZodForm<ActivityEditorFormInput, CreateActivityPayload>({
    schema,
    defaultValues: createActivityEditorDefaults(),
  });

  const write = (
    values: CreateActivityPayload,
    signal: AbortSignal,
  ): Promise<TeacherActivityResponseDto> =>
    createClassroomActivity(
      props.client,
      props.classroomId,
      toCreateActivityDto(values),
      { signal },
    );

  return (
    <ActivityEditorFormShell
      form={form}
      modeKind="create"
      timeZone={DEFAULT_SCHOOL_TIME_ZONE}
      originalOpensAt={null}
      write={write}
      onSaved={props.onSaved}
      onReconcileRequired={props.onReconcileRequired}
      onSubmittingChange={props.onSubmittingChange}
      onCanDismissChange={props.onCanDismissChange}
      onRequestClose={props.onRequestClose}
    />
  );
}

interface EditEditorFormProps {
  readonly client: ReturnType<typeof useSessionService>['client'];
  readonly classroomId: string;
  readonly activity: TeacherActivityResponseDto;
  readonly onSaved: (
    saved: TeacherActivityResponseDto,
    mode: 'create' | 'edit',
  ) => void;
  readonly onReconcileRequired: () => void;
  readonly onSubmittingChange: (submitting: boolean) => void;
  readonly onCanDismissChange: (fn: () => boolean) => void;
  readonly onRequestClose: () => void;
}

function EditEditorForm(props: EditEditorFormProps) {
  const { activity } = props;
  const schema = useMemo(
    () =>
      updateActivityEditorSchema({
        timeZone: activity.timeZone,
        originalOpensAt: activity.opensAt,
      }),
    [activity.timeZone, activity.opensAt],
  );

  const form = useZodForm<
    ActivityEditorFormInput,
    UpdateActivityValidatedPayload
  >({
    schema,
    defaultValues: useMemo(
      () => activityEditorDefaultsFromDetail(activity),
      [activity],
    ),
  });

  const write = (
    values: UpdateActivityValidatedPayload,
    signal: AbortSignal,
  ): Promise<TeacherActivityResponseDto> =>
    updateClassroomActivity(
      props.client,
      props.classroomId,
      activity.id,
      toUpdateActivityDto(values),
      { signal },
    );

  return (
    <ActivityEditorFormShell
      form={form}
      modeKind="edit"
      timeZone={activity.timeZone}
      originalOpensAt={activity.opensAt}
      write={write}
      onSaved={props.onSaved}
      onReconcileRequired={props.onReconcileRequired}
      onSubmittingChange={props.onSubmittingChange}
      onCanDismissChange={props.onCanDismissChange}
      onRequestClose={props.onRequestClose}
    />
  );
}

interface ActivityEditorFormFieldsProps {
  readonly form: UseFormReturn<ActivityEditorFormInput, unknown, unknown>;
  readonly isCreate: boolean;
  readonly isSubmitting: boolean;
  readonly timeZone: string;
  readonly originalOpensAt: string | null;
  readonly handleSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
  readonly onRequestClose: () => void;
}

function ActivityEditorFormFields({
  form,
  isCreate,
  isSubmitting,
  timeZone,
  originalOpensAt,
  handleSubmit,
  onRequestClose,
}: ActivityEditorFormFieldsProps) {
  const { control } = form;
  console.error(
    'FIELDS RENDER errors=',
    JSON.stringify(form.formState.errors).slice(0, 400),
  );
  const typeGroupId = useId();
  const formatGroupId = useId();
  const allowLateId = useId();

  const activityType = useWatch({ control, name: 'type' });
  const activityFormat = useWatch({ control, name: 'format' });
  const opensAtValue = useWatch({ control, name: 'opensAt' });
  const questionsValue = useWatch({ control, name: 'questions' });

  const questionsCount = questionsValue?.length ?? 0;
  const lingeringOpensAt =
    activityType === 'TP' && opensAtValue !== undefined && opensAtValue !== ''
      ? opensAtValue
      : null;
  const opensAtError = pathErrorMessage(form.formState.errors, 'opensAt');
  const questionsError = rootQuestionsErrorMessage(form.formState.errors);

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-5">
      <FormRootError
        form={form}
        headingLevel="h3"
        title={messages.errors.rootTitle}
      />

      <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
        <RadioChoiceGroup
          groupId={typeGroupId}
          legend={messages.fields.type.legend}
          description={messages.fields.type.description}
          options={TYPE_OPTIONS}
          selected={activityType}
          disabled={!isCreate}
          immutableNotice={
            isCreate ? null : messages.fields.type.immutableNotice
          }
          onChange={(value) => {
            form.setValue('type', value, { shouldDirty: true });
            form.clearErrors('root.serverError');
          }}
        />

        <RadioChoiceGroup
          groupId={formatGroupId}
          legend={messages.fields.format.legend}
          description={messages.fields.format.description}
          options={FORMAT_OPTIONS}
          selected={activityFormat}
          disabled={!isCreate}
          immutableNotice={
            isCreate ? null : messages.fields.format.immutableNotice
          }
          onChange={(value) => {
            form.setValue('format', value, { shouldDirty: true });
            form.clearErrors('root.serverError');
          }}
        />

        <FormField
          control={control}
          name="title"
          label={messages.fields.title.label}
          description={messages.fields.title.description}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              placeholder={messages.fields.title.placeholder}
            />
          )}
        </FormField>

        <FormField
          control={control}
          name="description"
          label={messages.fields.description.label}
          description={messages.fields.description.description}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              placeholder={messages.fields.description.placeholder}
            />
          )}
        </FormField>

        <FormField
          control={control}
          name="dueAt"
          label={messages.fields.dueAt.label}
          description={messages.fields.dueAt.timezoneNote(timeZone)}
        >
          {(fieldProps) => <Input {...fieldProps} type="datetime-local" />}
        </FormField>

        {activityType === 'EXAM' ? (
          <FormField
            control={control}
            name="opensAt"
            label={messages.fields.opensAt.label}
            description={
              originalOpensAt !== null
                ? `${messages.fields.opensAt.timezoneNote(timeZone)} ${messages.fields.opensAt.immutableHint}`
                : messages.fields.opensAt.timezoneNote(timeZone)
            }
          >
            {(fieldProps) => <Input {...fieldProps} type="datetime-local" />}
          </FormField>
        ) : (
          <div className="min-w-0 space-y-2 rounded-2xl border border-edge bg-tray/30 p-3.5">
            <p className="text-sm text-pretty text-muted-foreground">
              {messages.fields.opensAt.tpHint}
            </p>
            {lingeringOpensAt !== null && (
              <>
                <p className="text-sm text-pretty text-foreground">
                  {messages.fields.opensAt.tpStoredValue(
                    formatInstant(
                      datetimeLocalToInstantUtc(lingeringOpensAt, {
                        timeZone,
                      }),
                      { timeZone },
                    ),
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    form.setValue('opensAt', '', {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="min-h-11"
                >
                  {messages.fields.opensAt.removeAction}
                </Button>
              </>
            )}
            {opensAtError !== null && (
              <p
                role="alert"
                className="text-sm font-semibold text-destructive"
              >
                {opensAtError}
              </p>
            )}
          </div>
        )}

        <Controller
          control={control}
          name="allowLate"
          render={({ field, fieldState }) => {
            const describedBy =
              fieldState.error?.message !== undefined
                ? `${allowLateId}-description ${allowLateId}-error`
                : `${allowLateId}-description`;
            return (
              <div className="grid min-w-0 gap-2">
                <label
                  htmlFor={allowLateId}
                  className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 rounded-xl border-2 border-field-border bg-card px-3.5 py-2 text-base text-card-foreground shadow-inset focus-within:border-primary focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ring"
                >
                  <input
                    id={allowLateId}
                    type="checkbox"
                    checked={field.value === true}
                    aria-invalid={
                      fieldState.error?.message !== undefined ? true : undefined
                    }
                    aria-describedby={describedBy}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.checked)}
                    className="size-5"
                  />
                  <span className="font-medium">
                    {messages.fields.allowLate.label}
                  </span>
                </label>
                <p
                  id={`${allowLateId}-description`}
                  className="text-sm text-muted-foreground"
                >
                  {messages.fields.allowLate.description}
                </p>
                {fieldState.error?.message !== undefined && (
                  <p
                    id={`${allowLateId}-error`}
                    role="alert"
                    className="text-sm font-semibold text-destructive"
                  >
                    {fieldState.error?.message}
                  </p>
                )}
              </div>
            );
          }}
        />

        <FormField
          control={control}
          name="maxScore"
          label={messages.fields.maxScore.label}
          description={messages.fields.maxScore.description}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="any"
              inputMode="decimal"
              placeholder={messages.fields.maxScore.placeholder}
            />
          )}
        </FormField>

        <FormField
          control={control}
          name="weightMultiplier"
          label={messages.fields.weightMultiplier.label}
          description={messages.fields.weightMultiplier.description}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="any"
              inputMode="decimal"
              placeholder={messages.fields.weightMultiplier.placeholder}
            />
          )}
        </FormField>

        {activityFormat === 'MULTIPLE_CHOICE' ? (
          <MultipleChoiceBuilder form={form} disabled={isSubmitting} />
        ) : (
          <div className="min-w-0 space-y-2 rounded-2xl border border-edge bg-tray/30 p-3.5">
            <p className="text-sm text-pretty text-muted-foreground">
              {messages.questions.fileFormatHint}
            </p>
            {questionsCount > 0 && (
              <>
                <p className="text-sm text-pretty text-foreground">
                  {messages.questions.fileFormatStored(questionsCount)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    form.setValue('questions', [], {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="min-h-11"
                >
                  {messages.questions.removeQuestionsAction}
                </Button>
              </>
            )}
            {questionsError !== null && (
              <p
                role="alert"
                className="text-sm font-semibold text-destructive"
              >
                {questionsError}
              </p>
            )}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onRequestClose}
        >
          {messages.actions.cancel}
        </Button>
        <Button type="submit" busy={isSubmitting}>
          {isSubmitting
            ? isCreate
              ? messages.actions.createPending
              : messages.actions.editPending
            : isCreate
              ? messages.actions.createSubmit
              : messages.actions.editSubmit}
        </Button>
      </div>
    </form>
  );
}

type TypeValue = ActivityEditorFormInput['type'];
type FormatValue = ActivityEditorFormInput['format'];

interface RadioOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly description: string;
}

const TYPE_OPTIONS: readonly RadioOption<TypeValue>[] = [
  {
    value: 'TP',
    label: messages.fields.type.options.TP.label,
    description: messages.fields.type.options.TP.description,
  },
  {
    value: 'EXAM',
    label: messages.fields.type.options.EXAM.label,
    description: messages.fields.type.options.EXAM.description,
  },
];

const FORMAT_OPTIONS: readonly RadioOption<FormatValue>[] = [
  {
    value: 'FILE',
    label: messages.fields.format.options.FILE.label,
    description: messages.fields.format.options.FILE.description,
  },
  {
    value: 'MULTIPLE_CHOICE',
    label: messages.fields.format.options.MULTIPLE_CHOICE.label,
    description: messages.fields.format.options.MULTIPLE_CHOICE.description,
  },
];

interface RadioChoiceGroupProps<Value extends string> {
  readonly groupId: string;
  readonly legend: string;
  readonly description: string;
  readonly options: readonly RadioOption<Value>[];
  readonly selected: Value | undefined;
  readonly disabled: boolean;
  readonly immutableNotice: string | null;
  readonly onChange: (value: Value) => void;
}

/**
 * Radio group for the explicit type/format choices: visible labels,
 * descriptions, and a disabled state that explains immutability in edit mode
 * (`rules/ui-and-accessibility.md`).
 */
function RadioChoiceGroup<Value extends string>({
  groupId,
  legend,
  description,
  options,
  selected,
  disabled,
  immutableNotice,
  onChange,
}: RadioChoiceGroupProps<Value>) {
  const descriptionId = `${groupId}-description`;
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={descriptionId}
      className="space-y-2.5"
    >
      <legend className="text-sm font-semibold text-foreground">
        {legend}
      </legend>
      <p id={descriptionId} className="text-sm text-muted-foreground">
        {description}
      </p>
      <div className="space-y-2.5 pt-1">
        {options.map((option) => {
          const isSelected = selected === option.value;
          const radioId = `${groupId}-${option.value}`;
          const optionTitleId = `${radioId}-title`;
          const optionDescId = `${radioId}-desc`;
          return (
            <div key={option.value} className="relative">
              <input
                id={radioId}
                type="radio"
                name={groupId}
                value={option.value}
                checked={isSelected}
                disabled={disabled}
                aria-labelledby={optionTitleId}
                aria-describedby={optionDescId}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={radioId}
                className={cn(
                  'block min-h-11 cursor-pointer rounded-2xl border-2 p-3.5 motion-safe:transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ring',
                  isSelected
                    ? 'border-primary bg-tray/80 shadow-[0_3px_0_var(--key-sand)]'
                    : 'border-edge bg-card hover:bg-tray/45',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="font-display text-base font-semibold text-foreground">
                  <span id={optionTitleId}>{option.label}</span>
                </span>
                <span
                  id={optionDescId}
                  className="mt-1 block text-sm text-pretty text-muted-foreground"
                >
                  {option.description}
                </span>
              </label>
            </div>
          );
        })}
      </div>
      {immutableNotice !== null && (
        <p className="text-sm text-pretty text-muted-foreground">
          {immutableNotice}
        </p>
      )}
    </fieldset>
  );
}

/** Field-level error message for a hidden-but-invalid field. */
function pathErrorMessage(
  errors: UseFormReturn<ActivityEditorFormInput>['formState']['errors'],
  path: 'opensAt',
): string | null {
  const message = errors[path]?.message;
  return typeof message === 'string' && message !== '' ? message : null;
}

/** Root-level `questions` error (required for MCQ, forbidden for FILE). */
function rootQuestionsErrorMessage(
  errors: UseFormReturn<ActivityEditorFormInput>['formState']['errors'],
): string | null {
  const questionErrors = errors.questions;
  if (questionErrors === undefined || questionErrors === null) {
    return null;
  }
  const message = (questionErrors as { message?: string }).message;
  return typeof message === 'string' && message !== '' ? message : null;
}
