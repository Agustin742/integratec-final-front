import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { ApiError } from '@/api/errors';
import {
  FormRootError,
  useProtectedSubmit,
  useUnsavedChangesGuard,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProfileInventorySection } from '../inventory/profile-inventory-section';
import { AvatarPreviewView } from './avatar-preview-view';
import {
  AVATAR_FIELDS,
  avatarsEqual,
  BODY_OPTIONS,
  CLOTHING_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  hairOptionsFor,
  reconcileAvatarChoices,
  topOptionsFor,
  withLockedStyles,
  type Avatar,
} from './avatar-options';
import { ChoiceGroup } from './choice-group';
import { CategoryNav, CategorySection } from './customization-categories';
import { profileMessages } from './messages';
import { avatarFormSchema } from './profile-schema';
import { isAbortError, saveAvatar } from './profile-service';
import { useAvatarStyles } from './use-avatar-styles';
import { SaveStatusBadge, type SaveStatus } from './save-status';
import type { ProfileSectionProps } from './section-props';
import { usePreviewEquipment } from './use-preview-equipment';
import { useSessionService } from '@/session/provider';

const copy = profileMessages.avatar;

export function AvatarForm({
  profile,
  commit,
  reconcile,
  onDirtyChange,
}: ProfileSectionProps) {
  const { client } = useSessionService();
  const headingId = useId();
  const idPrefix = useId();
  const categoryIds = {
    body: `${idPrefix}-body`,
    hair: `${idPrefix}-hair`,
    clothing: `${idPrefix}-clothing`,
    accessories: `${idPrefix}-accessories`,
  };
  const [classroomId, setClassroomId] = useState('');
  const equipped = usePreviewEquipment(classroomId);
  const [announcement, setAnnouncement] = useState('');
  const [adjusted, setAdjusted] = useState(false);
  const confirmed = profile.avatar;
  const styles = useAvatarStyles();

  const form = useZodForm<Avatar, Avatar>({
    schema: avatarFormSchema,
    defaultValues: { ...confirmed },
  });
  const { isDirty, errors } = form.formState;
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const [bodyId, hairId, topId, hairColor, clothingColor] = useWatch({
    control: form.control,
    name: [...AVATAR_FIELDS],
  });
  const draft: Avatar = { bodyId, hairId, topId, hairColor, clothingColor };

  // Follow the confirmed avatar (another device, a reconcile) only while the
  // user has no draft: an edit in progress is never overwritten.
  useEffect(() => {
    if (!isDirtyRef.current) {
      form.reset({ ...confirmed });
    }
  }, [confirmed, form]);

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  useUnsavedChangesGuard(isDirty, { message: profileMessages.leaveConfirm });

  const settle = (saved: Avatar): void => {
    commit({ avatar: saved });
    form.reset({ ...saved });
    setAdjusted(false);
    setAnnouncement(copy.confirmed);
  };

  const onValid = async (values: Avatar): Promise<void> => {
    setAnnouncement('');
    try {
      const saved = await saveAvatar(client, values);
      settle(saved);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      // An unreadable outcome is reconciled with the server before anything
      // is claimed or repeated.
      if (error instanceof ApiError && error.kind === 'network') {
        let fresh: Awaited<ReturnType<typeof reconcile>> = null;
        try {
          fresh = await reconcile();
        } catch {
          fresh = null;
        }
        if (fresh !== null && avatarsEqual(fresh.avatar, values)) {
          settle(fresh.avatar);
          return;
        }
      }
      // A rejected style means ownership changed under the draft: re-read it.
      if (error instanceof ApiError && error.kind === 'forbidden') {
        styles.refresh();
      }
      throw error;
    }
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(form, onValid, {
    knownFields: [...AVATAR_FIELDS],
  });

  const changeBody = (nextBody: Avatar['bodyId']): void => {
    const current = form.getValues();
    const next = reconcileAvatarChoices({ ...current, bodyId: nextBody });
    const options = { shouldDirty: true } as const;
    form.setValue('bodyId', nextBody, options);
    form.setValue('hairId', next.hairId, options);
    form.setValue('topId', next.topId, options);
    form.clearErrors(['hairId', 'topId']);
    setAdjusted(next.hairId !== current.hairId || next.topId !== current.topId);
    setAnnouncement('');
  };

  const discard = (): void => {
    form.reset({ ...confirmed });
    form.clearErrors();
    setAdjusted(false);
    setAnnouncement('');
  };

  const hasFailure =
    errors.root?.serverError !== undefined ||
    AVATAR_FIELDS.some((field) => errors[field] !== undefined);
  let status: SaveStatus = 'saved';
  if (isSubmitting) status = 'saving';
  else if (hasFailure) status = 'failed';
  else if (isDirty) status = 'unsaved';

  const hairOptions = withLockedStyles(
    'hair',
    hairOptionsFor(bodyId),
    styles.availability,
    confirmed.hairId,
  );
  const topOptions = withLockedStyles(
    'top',
    topOptionsFor(bodyId),
    styles.availability,
    confirmed.topId,
  );
  const hasLockedStyles =
    hairOptions.some((option) => option.locked) ||
    topOptions.some((option) => option.locked);

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

      {/* A flex column on phones, so the preview can stick while choosing. */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="sticky top-0 z-10 -mx-5 space-y-2 border-b border-edge bg-card px-5 py-3 md:top-4 md:mx-0 md:self-start md:border-0 md:p-0">
          <h4 className="sr-only">{copy.previewHeading}</h4>
          <div
            className="mx-auto w-44 rounded-2xl border border-edge bg-tray/60 p-2 md:w-full md:p-3"
            data-avatar-preview-frame={isDirty ? 'draft' : 'saved'}
          >
            <AvatarPreviewView avatar={draft} equipped={equipped} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant={isDirty ? 'warning' : 'success'}>
              {isDirty ? copy.previewDraft : copy.previewSaved}
            </Badge>
          </div>
          <p className="hidden text-center text-xs text-muted-foreground md:block">
            {copy.previewNote}
          </p>
        </div>

        {/* Scroll margins keep focused choices clear of the stuck preview. */}
        <div className="min-w-0 space-y-4 [&_button]:scroll-mt-80 [&_h4]:scroll-mt-80 [&_input]:scroll-mt-80 [&_label]:scroll-mt-80 md:[&_button]:scroll-mt-4 md:[&_h4]:scroll-mt-4 md:[&_input]:scroll-mt-4 md:[&_label]:scroll-mt-4">
          <CategoryNav headingIds={categoryIds} />

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <FormRootError
              form={form}
              headingLevel="h4"
              title={copy.rootTitle}
            />
            {styles.status === 'error' && (
              <Alert variant="info" role="status">
                <AlertDescription>{copy.stylesUnavailable}</AlertDescription>
              </Alert>
            )}
            {hasLockedStyles && (
              <p className="text-xs text-muted-foreground">
                {copy.styleLockedHint}
              </p>
            )}
            {adjusted && (
              <Alert variant="info" role="status">
                <AlertDescription>{copy.adjusted}</AlertDescription>
              </Alert>
            )}

            <CategorySection category="body" headingId={categoryIds.body}>
              <Controller
                control={form.control}
                name="bodyId"
                render={({ field, fieldState }) => (
                  <ChoiceGroup
                    legend={copy.groups.bodyId}
                    name={field.name}
                    options={BODY_OPTIONS}
                    value={field.value}
                    onChange={changeBody}
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </CategorySection>
            <CategorySection category="hair" headingId={categoryIds.hair}>
              <Controller
                control={form.control}
                name="hairId"
                render={({ field, fieldState }) => (
                  <ChoiceGroup
                    legend={copy.groups.hairId}
                    name={field.name}
                    options={hairOptions}
                    lockedLabel={copy.styleLockedLabel}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      setAdjusted(false);
                    }}
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="hairColor"
                render={({ field, fieldState }) => (
                  <ChoiceGroup
                    legend={copy.groups.hairColor}
                    name={field.name}
                    options={HAIR_COLOR_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    swatch
                    disabled={isSubmitting}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </CategorySection>
            <CategorySection
              category="clothing"
              headingId={categoryIds.clothing}
            >
              <Controller
                control={form.control}
                name="topId"
                render={({ field, fieldState }) => (
                  <ChoiceGroup
                    legend={copy.groups.topId}
                    name={field.name}
                    options={topOptions}
                    lockedLabel={copy.styleLockedLabel}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      setAdjusted(false);
                    }}
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="clothingColor"
                render={({ field, fieldState }) => (
                  <ChoiceGroup
                    legend={copy.groups.clothingColor}
                    name={field.name}
                    options={CLOTHING_COLOR_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    swatch
                    disabled={isSubmitting}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </CategorySection>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-edge bg-card/95 px-4 py-3 shadow-ambient md:sticky md:bottom-0 md:z-10">
              <Button
                type="submit"
                busy={isSubmitting}
                disabled={!isDirty && !isSubmitting}
              >
                {isSubmitting ? copy.submitting : copy.submit}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!isDirty || isSubmitting}
                onClick={discard}
              >
                {copy.discard}
              </Button>
              <SaveStatusBadge status={status} announcement={announcement} />
            </div>
          </form>

          {/* Outside the form: equipping saves at once, per classroom. */}
          <p className="text-sm text-muted-foreground">
            {copy.accessoriesNote}
          </p>
          <ProfileInventorySection
            headingId={categoryIds.accessories}
            onClassroomChange={setClassroomId}
          />
        </div>
      </div>
    </section>
  );
}
