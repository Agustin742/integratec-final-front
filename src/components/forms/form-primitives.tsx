import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type BaseSyntheticEvent,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Controller,
  useForm,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type Path,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';
import { ApiError } from '@/api/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Field, type FieldControlProps } from '@/components/ui/field';

export const formMessages = {
  rootErrorTitle: 'No pudimos procesar el formulario',
  rootErrorFallback:
    'Ocurrió un problema al enviar los datos. Revisá la información e intentá de nuevo.',
  unsavedChangesConfirm:
    'Tenés cambios sin guardar. ¿Seguro que querés salir sin guardar?',
} as const;

export type UseZodFormProps<
  TInput extends FieldValues,
  TOutput extends FieldValues = TInput,
> = Omit<UseFormProps<TInput, unknown, TOutput>, 'resolver'> & {
  schema: z.ZodType<TOutput, TInput>;
};

/**
 * Creates a typed React Hook Form instance wired to a Zod schema (`rules/forms-and-validation.md`).
 */
export function useZodForm<
  TInput extends FieldValues,
  TOutput extends FieldValues = TInput,
>({
  schema,
  ...options
}: UseZodFormProps<TInput, TOutput>): UseFormReturn<TInput, unknown, TOutput> {
  return useForm<TInput, unknown, TOutput>({
    ...options,
    resolver: zodResolver(schema),
  });
}

export type FormFieldRenderProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FieldControlProps & ControllerRenderProps<TFieldValues, TName>;

export type FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
> = Omit<ComponentProps<'div'>, 'children'> & {
  control: Control<TFieldValues, unknown, TTransformedValues>;
  name: TName;
  label: ReactNode;
  description?: ReactNode;
  describedBy?: string;
  children: (
    fieldProps: FormFieldRenderProps<TFieldValues, TName>,
  ) => ReactNode;
};

/**
 * Connects a React Hook Form field to the shared accessible `Field` primitive,
 * wiring label, help description, `aria-invalid`, and `role="alert"` error message.
 */
export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
>({
  control,
  name,
  label,
  description,
  describedBy,
  id,
  className,
  children,
  ...props
}: FormFieldProps<TFieldValues, TName, TTransformedValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          {...props}
          id={id}
          label={label}
          description={description}
          error={fieldState.error?.message}
          describedBy={describedBy}
          className={className}
        >
          {(controlProps) =>
            children({
              ...field,
              ...controlProps,
            })
          }
        </Field>
      )}
    />
  );
}

export type FormRootErrorProps<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
> = Omit<ComponentProps<'div'>, 'title'> & {
  form?: Pick<
    UseFormReturn<TFieldValues, unknown, TTransformedValues>,
    'formState'
  >;
  error?: ReactNode;
  title?: ReactNode;
  headingLevel?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

/**
 * Renders form-level or unmapped backend errors in an accessible `role="alert"` slot
 * so unknown server rejections are never silently discarded (`rules/forms-and-validation.md`).
 */
export function FormRootError<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
>({
  form,
  error,
  title = formMessages.rootErrorTitle,
  headingLevel = 'h3',
  className,
  ...props
}: FormRootErrorProps<TFieldValues, TTransformedValues>) {
  const rootServerMessage =
    form?.formState.errors.root?.serverError?.message ??
    form?.formState.errors.root?.message;
  const resolvedError = error ?? rootServerMessage;

  if (
    resolvedError == null ||
    resolvedError === false ||
    resolvedError === ''
  ) {
    return null;
  }

  return (
    <Alert {...props} variant="destructive" role="alert" className={className}>
      <AlertTitle as={headingLevel}>{title}</AlertTitle>
      <AlertDescription>{resolvedError}</AlertDescription>
    </Alert>
  );
}

export interface ApplyServerErrorsOptions<TFieldValues extends FieldValues> {
  readonly knownFields?: readonly Path<TFieldValues>[];
}

function collectDottedPaths(
  value: unknown,
  prefix: string,
  target: Set<string>,
): void {
  if (prefix !== '') {
    target.add(prefix);
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const childPath = prefix === '' ? String(index) : `${prefix}.${index}`;
      collectDottedPaths(value[index], childPath, target);
    }
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, childValue] of Object.entries(value)) {
      const childPath = prefix === '' ? key : `${prefix}.${key}`;
      collectDottedPaths(childValue, childPath, target);
    }
  }
}

function hasDottedPath(root: unknown, dottedPath: string): boolean {
  const segments = dottedPath.split('.').filter(Boolean);
  if (segments.length === 0) {
    return false;
  }
  let current: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }
    if (
      typeof current === 'object' &&
      current !== null &&
      Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    return false;
  }
  return true;
}

function isKnownFieldPath<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
>(
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>,
  fieldPath: string,
  explicitKnownFields: ReadonlySet<string> | null,
  discoveredPaths: ReadonlySet<string>,
): boolean {
  if (explicitKnownFields !== null) {
    return explicitKnownFields.has(fieldPath);
  }
  if (discoveredPaths.has(fieldPath)) {
    return true;
  }
  return (
    hasDottedPath(form.getValues(), fieldPath) ||
    hasDottedPath(form.control._fields, fieldPath)
  );
}

/**
 * Maps a backend `ApiError` onto React Hook Form fields (`error.fieldErrors`) and
 * routes any unknown field paths or general failure messages to `root.serverError`.
 */
export function applyServerErrorsToForm<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
>(
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>,
  error: unknown,
  options?: ApplyServerErrorsOptions<TFieldValues>,
): void {
  if (!(error instanceof ApiError)) {
    form.setError('root.serverError', {
      type: 'server',
      message: formMessages.rootErrorFallback,
    });
    return;
  }

  const explicitKnownFields = options?.knownFields
    ? new Set<string>(options.knownFields)
    : null;
  const discoveredPaths = new Set<string>();
  if (explicitKnownFields === null) {
    collectDottedPaths(form.getValues(), '', discoveredPaths);
    collectDottedPaths(form.control._fields, '', discoveredPaths);
  }

  const unmappedMessages: string[] = [];
  let mappedAnyField = false;

  for (const [fieldPath, messages] of Object.entries(error.fieldErrors)) {
    const joined = messages.filter(Boolean).join(' ');
    if (!joined) {
      continue;
    }
    if (
      isKnownFieldPath(form, fieldPath, explicitKnownFields, discoveredPaths)
    ) {
      form.setError(fieldPath as Path<TFieldValues>, {
        type: 'server',
        message: joined,
      });
      mappedAnyField = true;
    } else {
      unmappedMessages.push(joined);
    }
  }

  if (unmappedMessages.length > 0) {
    form.setError('root.serverError', {
      type: 'server',
      message: unmappedMessages.join(' '),
    });
  } else if (!mappedAnyField) {
    form.setError('root.serverError', {
      type: 'server',
      message: error.userMessage,
    });
  }
}

export interface ProtectedSubmitResult {
  readonly isSubmitting: boolean;
  readonly handleSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
}

/**
 * Wraps `form.handleSubmit` with a synchronous in-flight lock (`submittingRef`)
 * so rapid double-clicks send only one request, and automatically maps `ApiError`
 * rejections onto the form while preserving user input (`rules/forms-and-validation.md`).
 *
 * Non-`ApiError` programming exceptions thrown by `onValid` are rethrown so bugs
 * are never silently masked as server validation errors.
 */
export function useProtectedSubmit<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
>(
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>,
  onValid: (values: TTransformedValues) => Promise<void> | void,
  options?: ApplyServerErrorsOptions<TFieldValues>,
): ProtectedSubmitResult {
  const submittingRef = useRef(false);
  const onValidRef = useRef(onValid);
  const optionsRef = useRef(options);

  useEffect(() => {
    onValidRef.current = onValid;
    optionsRef.current = options;
  }, [onValid, options]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event?: BaseSyntheticEvent): Promise<void> => {
      if (event?.preventDefault) {
        event.preventDefault();
      }
      if (submittingRef.current) {
        return;
      }

      submittingRef.current = true;
      setIsSubmitting(true);
      form.clearErrors('root.serverError');

      try {
        await form.handleSubmit(async (values) => {
          await onValidRef.current(values);
        })(event);
      } catch (error) {
        if (error instanceof ApiError) {
          applyServerErrorsToForm(form, error, optionsRef.current);
          return;
        }
        throw error;
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [form],
  );

  return {
    isSubmitting,
    handleSubmit,
  };
}

export interface UnsavedChangesGuardOptions {
  readonly message?: string;
}

export interface UnsavedChangesGuardResult {
  readonly isDirty: boolean;
  readonly confirmNavigation: () => boolean;
}

/**
 * Protects a form with unsaved changes from accidental browser tab closure
 * (`beforeunload`) and exposes `confirmNavigation()` for in-app transitions
 * (`rules/forms-and-validation.md`).
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  options: UnsavedChangesGuardOptions = {},
): UnsavedChangesGuardResult {
  const message = options.message ?? formMessages.unsavedChangesConfirm;

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const confirmNavigation = useCallback((): boolean => {
    if (!isDirty) {
      return true;
    }
    return window.confirm(message);
  }, [isDirty, message]);

  return {
    isDirty,
    confirmNavigation,
  };
}
