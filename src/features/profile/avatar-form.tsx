import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ProfileInventorySection } from '../inventory/profile-inventory-section';
import { useStudentClassrooms } from '../inventory/use-student-classrooms';
import { AvatarThumbnail } from '../shop/shop-item-preview';
import { AvatarChoiceGroup } from './avatar-choice-group';
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
  type AvatarOption,
} from './avatar-options';
import { CategoryTabs, type CategoryId } from './customization-categories';
import { profileMessages } from './messages';
import { avatarFormSchema } from './profile-schema';
import { isAbortError, saveAvatar } from './profile-service';
import { useAvatarStyles } from './use-avatar-styles';
import { SaveStatusBadge, type SaveStatus } from './save-status';
import type { ProfileSectionProps } from './section-props';
import { usePreviewEquipment } from './use-preview-equipment';
import { useSessionService } from '@/session/provider';

const copy = profileMessages.avatar;

/** Owned choices first; the catalog order is kept within each half. */
const ownedFirst = <T extends AvatarOption<string>>(
  options: readonly T[],
): readonly T[] =>
  [...options].sort((a, b) => Number(a.locked) - Number(b.locked));

/** The tab that holds the first field with an error. */
const TAB_OF_FIELD = {
  bodyId: 'body',
  hairId: 'hair',
  hairColor: 'hair',
  topId: 'clothing',
  clothingColor: 'clothing',
} as const satisfies Record<keyof Avatar, CategoryId>;

export function AvatarForm({
  profile,
  commit,
  reconcile,
  onDirtyChange,
  intro,
}: ProfileSectionProps & {
  /** Shown above the avatar options, beside the preview. */
  readonly intro?: ReactNode;
}) {
  const { client } = useSessionService();
  const headingId = useId();
  const formId = useId();
  const [tab, setTab] = useState<CategoryId>('body');
  // Once opened, the accessories stay mounted so a pending or rejected equip
  // is still reported after switching tabs.
  const [accessoriesOpened, setAccessoriesOpened] = useState(false);
  const [errorTab, setErrorTab] = useState<CategoryId | null>(null);
  const classrooms = useStudentClassrooms();
  const equipped = usePreviewEquipment(classrooms.activeId);
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

  const hairOptions = ownedFirst(
    withLockedStyles(
      'hair',
      hairOptionsFor(bodyId),
      styles.availability,
      confirmed.hairId,
    ),
  );
  const topOptions = ownedFirst(
    withLockedStyles(
      'top',
      topOptionsFor(bodyId),
      styles.availability,
      confirmed.topId,
    ),
  );
  // A rejected field is shown where it can be fixed.
  const rejected = AVATAR_FIELDS.find((field) => errors[field] !== undefined);
  const rejectedTab = rejected === undefined ? null : TAB_OF_FIELD[rejected];
  if (rejectedTab !== errorTab) {
    setErrorTab(rejectedTab);
    if (rejectedTab !== null) setTab(rejectedTab);
  }

  const shopHref = classrooms.activeId
    ? `/classrooms/${classrooms.activeId}/panels/shop`
    : '/';
  const wornFrom = equipped
    ? classrooms.items.find(({ id }) => id === classrooms.activeId)?.name
    : undefined;
  // On accessories the base-appearance bar only appears when it has something
  // to say: they save on their own.
  const showSaveBar =
    tab !== 'accessories' || status !== 'saved' || announcement !== '';

  const colorGroup = (
    name: 'hairColor' | 'clothingColor',
    options: readonly AvatarOption<string>[],
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <AvatarChoiceGroup
          legend={copy.groups[name]}
          name={field.name}
          options={options}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={isSubmitting}
          error={fieldState.error?.message}
        />
      )}
    />
  );

  const styleGroup = (
    name: 'hairId' | 'topId',
    options: readonly AvatarOption<string>[],
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <AvatarChoiceGroup
          legend={copy.groups[name]}
          name={field.name}
          options={options}
          value={field.value}
          onChange={(value) => {
            field.onChange(value);
            setAdjusted(false);
          }}
          onBlur={field.onBlur}
          disabled={isSubmitting}
          error={fieldState.error?.message}
          shopHref={shopHref}
          renderPicture={(option) => (
            <AvatarThumbnail
              item={{
                type: name === 'hairId' ? 'hair' : 'top',
                id: option.value,
                // The saved color: trying colors does not redraw every card.
                color:
                  name === 'hairId'
                    ? confirmed.hairColor
                    : confirmed.clothingColor,
              }}
              bodyId={bodyId}
              name={option.label}
              className="rounded-xl"
            />
          )}
        />
      )}
    />
  );

  return (
    // A flex column on phones, so the preview can stick while choosing.
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
      <div className="sticky top-0 z-20 -mx-4 border-b border-edge bg-background px-4 py-2 md:top-4 md:mx-0 md:self-start md:border-0 md:p-0">
        <h3 className="sr-only">{copy.previewHeading}</h3>
        <div className="space-y-2 md:rounded-3xl md:border md:border-edge md:bg-card md:p-3 md:shadow-panel">
          <div
            className="mx-auto w-36 md:w-full"
            data-avatar-preview-frame={isDirty ? 'draft' : 'saved'}
          >
            <AvatarPreviewView avatar={draft} equipped={equipped} />
          </div>
          <div className="flex justify-center">
            <Badge variant={isDirty ? 'warning' : 'success'}>
              {isDirty ? copy.previewDraft : copy.previewSaved}
            </Badge>
          </div>
          {wornFrom !== undefined && (
            <p className="hidden text-center text-xs text-muted-foreground md:block">
              {copy.previewClassroom(wornFrom)}
            </p>
          )}
          <p className="hidden text-center text-xs text-muted-foreground md:block">
            {copy.previewNote}
          </p>
        </div>
      </div>

      {/* Scroll margins keep focused choices clear of the stuck preview and
          of the save bar. */}
      <div className="min-w-0 space-y-4 [&_a]:scroll-mt-64 [&_a]:scroll-mb-28 [&_button]:scroll-mt-64 [&_input]:scroll-mt-64 [&_input]:scroll-mb-28 [&_label]:scroll-mt-64 [&_select]:scroll-mt-64 md:[&_a]:scroll-mt-4 md:[&_button]:scroll-mt-4 md:[&_input]:scroll-mt-4 md:[&_label]:scroll-mt-4 md:[&_select]:scroll-mt-4">
        {intro}
        <section
          aria-labelledby={headingId}
          className="rounded-3xl border border-edge bg-card p-3 shadow-panel sm:p-5"
        >
          <h3
            id={headingId}
            className="mb-3 font-display text-lg font-bold text-foreground"
          >
            {copy.heading}
          </h3>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as CategoryId);
              if (value === 'accessories') setAccessoriesOpened(true);
            }}
          >
            <CategoryTabs />
            <p className="mt-3 text-sm text-pretty text-muted-foreground">
              {tab === 'accessories'
                ? copy.accessoriesNote
                : copy.saveScopeNote}
            </p>

            <form
              id={formId}
              noValidate
              onSubmit={handleSubmit}
              className="mt-3"
            >
              <div className="space-y-3 empty:hidden">
                <FormRootError
                  form={form}
                  headingLevel="h4"
                  title={copy.rootTitle}
                />
                {styles.status === 'error' && (
                  <Alert variant="info" role="status">
                    <AlertDescription>
                      {copy.stylesUnavailable}
                    </AlertDescription>
                  </Alert>
                )}
                {adjusted && (
                  <Alert variant="info" role="status">
                    <AlertDescription>{copy.adjusted}</AlertDescription>
                  </Alert>
                )}
              </div>

              <TabsContent value="body" className="motion-reduce:animate-none">
                <Controller
                  control={form.control}
                  name="bodyId"
                  render={({ field, fieldState }) => (
                    <AvatarChoiceGroup
                      legend={copy.groups.bodyId}
                      name={field.name}
                      options={BODY_OPTIONS}
                      value={field.value}
                      onChange={changeBody}
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                      error={fieldState.error?.message}
                      className="max-w-sm grid-cols-2"
                      renderPicture={(option) => (
                        // Each body wearing the same top, so only it differs.
                        <AvatarThumbnail
                          item={{
                            type: 'top',
                            id: confirmed.topId,
                            color: confirmed.clothingColor,
                          }}
                          bodyId={option.value}
                          name={option.label}
                          className="rounded-xl"
                        />
                      )}
                    />
                  )}
                />
              </TabsContent>
              <TabsContent
                value="hair"
                className="space-y-5 motion-reduce:animate-none"
              >
                {colorGroup('hairColor', HAIR_COLOR_OPTIONS)}
                {hairOptions.some((option) => option.locked) && (
                  <p className="text-xs text-muted-foreground">
                    {copy.styleLockedHint}
                  </p>
                )}
                {styleGroup('hairId', hairOptions)}
              </TabsContent>
              <TabsContent
                value="clothing"
                className="space-y-5 motion-reduce:animate-none"
              >
                {colorGroup('clothingColor', CLOTHING_COLOR_OPTIONS)}
                {topOptions.some((option) => option.locked) && (
                  <p className="text-xs text-muted-foreground">
                    {copy.styleLockedHint}
                  </p>
                )}
                {styleGroup('topId', topOptions)}
              </TabsContent>
            </form>

            {/* Outside the form: equipping saves at once, per classroom. */}
            <TabsContent
              value="accessories"
              forceMount={accessoriesOpened ? true : undefined}
              hidden={tab !== 'accessories'}
              className="motion-reduce:animate-none"
            >
              {(tab === 'accessories' || accessoriesOpened) && (
                <ProfileInventorySection
                  classrooms={classrooms}
                  bodyId={bodyId}
                  active={tab === 'accessories'}
                />
              )}
            </TabsContent>
          </Tabs>

          <div
            hidden={!showSaveBar}
            className="sticky bottom-0 z-10 -mx-3 mt-4 border-t border-edge bg-card px-3 py-3 sm:-mx-5 sm:px-5"
          >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                type="submit"
                form={formId}
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
          </div>
        </section>
      </div>
    </div>
  );
}
