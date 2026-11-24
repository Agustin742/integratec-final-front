import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface SettingsSwitchRowProps {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly onBlur?: () => void;
}

/**
 * One labelled on/off setting. Semantic `role="switch"` button; the label and
 * the consequence text are tied to it for assistive tech, and the control is a
 * 44px touch target.
 */
export function SettingsSwitchRow({
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
  onBlur,
}: SettingsSwitchRowProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-1">
        <p id={labelId} className="text-base font-semibold text-foreground">
          {label}
        </p>
        <p
          id={descriptionId}
          className="text-sm text-pretty text-muted-foreground"
        >
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onBlur={onBlur}
        onClick={() => onCheckedChange(!checked)}
        className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-flex h-7 w-12 items-center rounded-full border-2 motion-safe:transition-colors',
            checked
              ? 'border-primary bg-primary'
              : 'border-field-border bg-tray',
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block size-5 rounded-full shadow-sm motion-safe:transition-transform',
              checked
                ? 'translate-x-5 bg-primary-foreground'
                : 'translate-x-0.5 bg-input',
            )}
          />
        </span>
      </button>
    </div>
  );
}
