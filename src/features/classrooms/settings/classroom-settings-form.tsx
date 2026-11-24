import { useEffect, useRef, useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import {
  classroomDetailQueryKey,
  createClassroomListPredicate,
} from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import { StaleDataNotice } from '@/components/feedback/states';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useUnsavedChangesGuard,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useSessionService } from '@/session/provider';
import {
  CLASSROOM_NAME_MAX_LENGTH,
  CLASSROOM_SUBJECT_MAX_LENGTH,
} from '../classroom-schema';
import { isAbortError, updateClassroom } from '../classroom-service';
import { classroomMessages } from '../messages';
import { settingsMessages } from './messages';
import {
  classroomSettingsFormSchema,
  toSettingsFormValues,
  toSettingsUpdatePayload,
  type ClassroomSettingsFormInput,
  type ClassroomSettingsFormOutput,
} from './settings-schema';
import { SettingsSection } from './settings-section';
import { SettingsSwitchRow } from './settings-switch-row';

type ClassroomContextDto = components['schemas']['ClassroomContextResponseDto'];
type SettingsForm = UseFormReturn<
  ClassroomSettingsFormInput,
  unknown,
  ClassroomSettingsFormOutput
>;
type SwitchName = 'adultMode' | 'chatMuted';

export interface ClassroomSettingsFormProps {
  readonly userId: string;
  readonly classroom: ClassroomContextDto;
}

export function ClassroomSettingsForm({
  userId,
  classroom,
}: ClassroomSettingsFormProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const classroomId = classroom.id;

  const form = useZodForm<
    ClassroomSettingsFormInput,
    ClassroomSettingsFormOutput
  >({
    schema: classroomSettingsFormSchema,
    defaultValues: toSettingsFormValues(classroom),
  });

  const isDirty = form.formState.isDirty;
  const [justSaved, setJustSaved] = useState(false);
  const [serverChanged, setServerChanged] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastSeenUpdatedAtRef = useRef(classroom.updatedAt);
  const isDirtyRef = useRef(isDirty);

  useUnsavedChangesGuard(isDirty, {
    message: classroomMessages.form.actions.unsavedChanges,
  });

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // Reconcile with the server: a clean form follows it silently; a dirty form
  // keeps the user's edits and offers an explicit reload instead.
  useEffect(() => {
    if (classroom.updatedAt === lastSeenUpdatedAtRef.current) {
      return;
    }
    lastSeenUpdatedAtRef.current = classroom.updatedAt;
    if (isDirtyRef.current) {
      setServerChanged(true);
      return;
    }
    form.reset(toSettingsFormValues(classroom));
  }, [classroom, form]);

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      const detailKey = classroomDetailQueryKey(userId, classroomId);
      try {
        const saved = await updateClassroom(
          client,
          classroomId,
          toSettingsUpdatePayload(values),
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        lastSeenUpdatedAtRef.current = saved.updatedAt;
        form.reset(toSettingsFormValues(saved));
        setServerChanged(false);
        setJustSaved(true);
        // The 3D top bar and this panel read the detail query: patch it in
        // place so the new name shows immediately.
        queryClient.setQueryData<ClassroomContextDto>(detailKey, (current) =>
          current === undefined
            ? current
            : {
                ...current,
                name: saved.name,
                subject: saved.subject,
                adultMode: saved.adultMode,
                chatMuted: saved.chatMuted,
                updatedAt: saved.updatedAt,
              },
        );
        // Adult mode changes which panels parents get: reconcile with server.
        if (saved.adultMode !== classroom.adultMode) {
          void queryClient.invalidateQueries({
            queryKey: detailKey,
            exact: true,
          });
        }
        void queryClient.invalidateQueries({
          predicate: createClassroomListPredicate(userId),
        });
        toast.success(settingsMessages.toastSavedTitle, {
          description: settingsMessages.toastSavedDescription(saved.name),
        });
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          return;
        }
        if (error instanceof ApiError && error.kind !== 'validation') {
          // Unknown outcome or lost access: re-read the truth before a retry.
          void queryClient.invalidateQueries({
            queryKey: detailKey,
            exact: true,
          });
        }
        throw error;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    {
      knownFields: ['name', 'subject', 'adultMode', 'chatMuted'],
    },
  );

  const resetToServer = () => {
    form.reset(toSettingsFormValues(classroom));
    form.clearErrors();
    setJustSaved(false);
  };

  const statusText = isDirty
    ? settingsMessages.saveBar.dirty
    : justSaved
      ? settingsMessages.saveBar.saved
      : settingsMessages.saveBar.clean;

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onChange={() => setJustSaved(false)}
      aria-label={settingsMessages.formLabel}
      className="min-w-0"
    >
      {serverChanged && (
        <StaleDataNotice
          headingLevel="h3"
          title={settingsMessages.stale.title}
          description={settingsMessages.stale.description}
          retryLabel={settingsMessages.stale.reload}
          onRetry={() => {
            resetToServer();
            setServerChanged(false);
          }}
          className="mb-4"
        />
      )}
      <FormRootError
        form={form}
        headingLevel="h3"
        title={classroomMessages.form.errors.rootTitle}
        className="mb-4"
      />

      <SettingsSection
        title={settingsMessages.sections.general.title}
        description={settingsMessages.sections.general.description}
      >
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
              autoComplete="off"
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
              autoComplete="off"
            />
          )}
        </FormField>
      </SettingsSection>

      <SettingsSection
        title={settingsMessages.sections.mode.title}
        description={settingsMessages.sections.mode.description}
      >
        <SwitchField form={form} name="adultMode" />
      </SettingsSection>

      <SettingsSection
        title={settingsMessages.sections.controls.title}
        description={settingsMessages.sections.controls.description}
      >
        <SwitchField form={form} name="chatMuted" />
      </SettingsSection>

      <div
        role="group"
        aria-label={settingsMessages.saveBar.label}
        className="sticky bottom-0 z-10 mt-2 flex flex-col gap-2 rounded-2xl border border-edge bg-card/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 shadow-ambient backdrop-blur"
      >
        <p role="status" className="text-sm font-semibold text-foreground">
          {statusText}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || isSubmitting}
            onClick={resetToServer}
          >
            {settingsMessages.saveBar.discard}
          </Button>
          <Button type="submit" disabled={!isDirty} busy={isSubmitting}>
            {isSubmitting
              ? settingsMessages.saveBar.saving
              : settingsMessages.saveBar.save}
          </Button>
        </div>
      </div>
    </form>
  );
}

function SwitchField({
  form,
  name,
}: {
  readonly form: SettingsForm;
  readonly name: SwitchName;
}) {
  const copy = settingsMessages.fields[name];
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <SettingsSwitchRow
          label={copy.label}
          description={copy.description}
          checked={field.value}
          onBlur={field.onBlur}
          onCheckedChange={(next) => {
            field.onChange(next);
            form.clearErrors('root.serverError');
          }}
        />
      )}
    />
  );
}
