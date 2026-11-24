import {
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  MODULE_DESCRIPTION_MAX_LENGTH,
  MODULE_NAME_MAX_LENGTH,
  checkModuleForm,
  type MaterialModuleDto,
} from './module-schema';
import { materialMessages } from './messages';

const copy = materialMessages.modules;

/** Dialogs report a recoverable failure as text; `null` means it worked. */
export type DialogSubmit<T> = (value: T) => Promise<string | null>;

interface BaseDialogProps {
  readonly onClose: () => void;
  /** Lets the panel hand focus back to a meaningful element after closing. */
  readonly onCloseAutoFocus: (event: Event) => void;
}

function DialogActions({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
      {children}
    </div>
  );
}

export interface ModuleFormDialogProps extends BaseDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initial?: Pick<MaterialModuleDto, 'name' | 'description'>;
  readonly onSubmit: DialogSubmit<{
    readonly name: string;
    readonly description: string;
  }>;
}

export function ModuleFormDialog({
  mode,
  initial,
  onSubmit,
  onClose,
  onCloseAutoFocus,
}: ModuleFormDialogProps): ReactElement {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [fieldError, setFieldError] = useState<{
    readonly field: 'name' | 'description';
    readonly message: string;
  } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const check = checkModuleForm({ name, description });
    if (!check.ok) {
      const message =
        check.field === 'description'
          ? copy.form.descriptionTooLong
          : name.trim().length === 0
            ? copy.form.nameRequired
            : copy.form.nameTooLong;
      setFieldError({ field: check.field, message });
      return;
    }
    setFieldError(null);
    setServerError(null);
    setSubmitting(true);
    const failure = await onSubmit({
      name: check.name,
      description: check.description,
    });
    setSubmitting(false);
    if (failure !== null) setServerError(failure);
  }

  const isCreate = mode === 'create';
  const title = isCreate ? copy.form.createTitle : copy.form.editTitle;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{copy.form.description}</DialogDescription>
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-5 grid gap-4"
        >
          <Field
            label={copy.form.nameLabel}
            error={
              fieldError?.field === 'name' ? fieldError.message : undefined
            }
          >
            {(control) => (
              <Input
                {...control}
                value={name}
                maxLength={MODULE_NAME_MAX_LENGTH + 20}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field
            label={copy.form.descriptionLabel}
            error={
              fieldError?.field === 'description'
                ? fieldError.message
                : undefined
            }
          >
            {(control) => (
              <textarea
                {...control}
                value={description}
                rows={3}
                maxLength={MODULE_DESCRIPTION_MAX_LENGTH + 100}
                onChange={(event) => setDescription(event.target.value)}
                className="motion-field min-h-24 w-full min-w-0 resize-y rounded-xl border-2 border-field-border bg-card px-4 py-2 text-base text-card-foreground shadow-inset placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring aria-invalid:border-destructive"
              />
            )}
          </Field>
          {serverError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogActions>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onClose}
            >
              {copy.form.cancel}
            </Button>
            <Button type="submit" busy={submitting} disabled={submitting}>
              {submitting
                ? copy.form.submitting
                : isCreate
                  ? copy.form.createSubmit
                  : copy.form.editSubmit}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface DeleteModuleDialogProps extends BaseDialogProps {
  readonly module: Pick<MaterialModuleDto, 'name' | 'materialCount'>;
  readonly onConfirm: () => Promise<string | null>;
}

export function DeleteModuleDialog({
  module,
  onConfirm,
  onClose,
  onCloseAutoFocus,
}: DeleteModuleDialogProps): ReactElement {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleConfirm() {
    if (submitting) return;
    setServerError(null);
    setSubmitting(true);
    const failure = await onConfirm();
    setSubmitting(false);
    if (failure !== null) setServerError(failure);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>{copy.deleteDialog.title(module.name)}</DialogTitle>
        <DialogDescription>
          {copy.deleteDialog.description(module.materialCount)}
        </DialogDescription>
        <div className="mt-5 grid gap-4">
          {serverError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogActions>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onClose}
            >
              {copy.deleteDialog.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              busy={submitting}
              disabled={submitting}
              onClick={() => void handleConfirm()}
            >
              {submitting
                ? copy.deleteDialog.submitting
                : copy.deleteDialog.submit}
            </Button>
          </DialogActions>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface MoveMaterialDialogProps extends BaseDialogProps {
  readonly filename: string;
  /** Current module id, or `null` when the file is unassigned. */
  readonly currentModuleId: string | null;
  readonly modules: readonly Pick<MaterialModuleDto, 'id' | 'name'>[];
  readonly onSubmit: DialogSubmit<string | null>;
}

export function MoveMaterialDialog({
  filename,
  currentModuleId,
  modules,
  onSubmit,
  onClose,
  onCloseAutoFocus,
}: MoveMaterialDialogProps): ReactElement {
  const [target, setTarget] = useState<string>(currentModuleId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (target === (currentModuleId ?? '')) {
      onClose();
      return;
    }
    setServerError(null);
    setSubmitting(true);
    const failure = await onSubmit(target === '' ? null : target);
    setSubmitting(false);
    if (failure !== null) setServerError(failure);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>{copy.moveDialog.title(filename)}</DialogTitle>
        <DialogDescription>{copy.moveDialog.description}</DialogDescription>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-5 grid gap-4"
        >
          <Field label={copy.moveDialog.targetLabel}>
            {(control) => (
              <select
                {...control}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="motion-field min-h-11 w-full min-w-0 rounded-xl border-2 border-field-border bg-card px-4 py-2 text-base text-card-foreground shadow-inset focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
              >
                {modules.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
                <option value="">{copy.unassignedTitle}</option>
              </select>
            )}
          </Field>
          {serverError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogActions>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onClose}
            >
              {copy.moveDialog.cancel}
            </Button>
            <Button type="submit" busy={submitting} disabled={submitting}>
              {submitting ? copy.moveDialog.submitting : copy.moveDialog.submit}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface UploadDialogProps extends BaseDialogProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** Hosts the existing upload section so a file goes straight into a module. */
export function UploadDialog({
  title,
  children,
  onClose,
  onCloseAutoFocus,
}: UploadDialogProps): ReactElement {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle className="mb-4">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
