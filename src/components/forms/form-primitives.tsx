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
> = Omit<ComponentProps<'div'>, 'children'> & {
  control: Control<TFieldValues, unknown, TFieldValues>;
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
}: FormFieldProps<TFieldValues, TName>) {
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

export type FormRootErrorProps<TFieldValues extends FieldValues> = Omit<
  ComponentProps<'div'>,
  'title'
> & {
  form?: Pick<UseFormReturn<TFieldValues>, 'formState'>;
  error?: ReactNode;
  title?: ReactNode;
  headingLevel?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

/**
 * Renders form-level or unmapped backend errors in an accessible `role="alert"` slot
 * so unknown server rejections are never silently discarded (`rules/forms-and-validation.md`).
 */
export function FormRootError<TFieldValues extends FieldValues>({
  form,
  error,
  title = formMessages.rootErrorTitle,
  headingLevel = 'h3',
  className,
  ...props
}: FormRootErrorProps<TFieldValues>) {
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

function resolveKnownFields<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  options?: ApplyServerErrorsOptions<TFieldValues>,
): ReadonlySet<string> {
  if (options?.knownFields) {
    return new Set<string>(options.knownFields);
  }
  const values = form.getValues();
  if (typeof values === 'object' && values !== null) {
    return new Set(Object.keys(values));
  }
  return new Set();
}

/**
 * Maps a backend `ApiError` onto React Hook Form fields (`error.fieldErrors`) and
 * routes any unknown field paths or general failure messages to `root.serverError`.
 */
export function applyServerErrorsToForm<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  error: unknown,
  options?: ApplyServerErrorsOptions<TFieldValues>,
): void {
  if (!(error instanceof ApiError)) {
    form.setError('root.serverError', {
      type: 'server',
      message: formMessages.rootErrorTitle,
    });
    return;
  }

  const knownFields = resolveKnownFields(form, options);
  const unmappedMessages: string[] = [];
  let mappedAnyField = false;

  for (const [fieldPath, messages] of Object.entries(error.fieldErrors)) {
    const joined = messages.filter(Boolean).join(' ');
    if (!joined) {
      continue;
    }
    if (knownFields.has(fieldPath)) {
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
          await onValid(values);
        })(event);
      } catch (error) {
        applyServerErrorsToForm(
          form as unknown as UseFormReturn<TFieldValues>,
          error,
          options,
        );
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [form, onValid, options],
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
