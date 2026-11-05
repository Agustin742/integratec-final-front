import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Label } from './label';

export type FieldControlProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
};

export type FieldProps = Omit<ComponentProps<'div'>, 'children'> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  describedBy?: string;
  children: (controlProps: FieldControlProps) => ReactNode;
};

export function Field({
  id,
  label,
  description,
  error,
  describedBy,
  children,
  className,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hasDescription =
    description != null && description !== false && description !== '';
  const hasError = error != null && error !== false && error !== '';
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;
  const descriptionIds =
    [
      describedBy,
      hasDescription ? descriptionId : undefined,
      hasError ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div {...props} className={cn('grid min-w-0 gap-2', className)}>
      <Label htmlFor={controlId}>{label}</Label>
      {children({
        id: controlId,
        'aria-describedby': descriptionIds,
        'aria-invalid': hasError ? true : undefined,
      })}
      {hasDescription && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {hasError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
