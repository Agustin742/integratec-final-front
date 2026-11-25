import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface ChoiceOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  /** Shown but not selectable; see `lockedLabel`. */
  readonly locked?: boolean;
}

export interface ChoiceGroupProps<TValue extends string> {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly ChoiceOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly onBlur?: () => void;
  /** Renders a color chip next to the label; the label is always visible. */
  readonly swatch?: boolean;
  readonly error?: string;
  readonly disabled?: boolean;
  /** Accessible explanation read after the label of a locked option. */
  readonly lockedLabel?: string;
}

/**
 * Native radio group (arrow keys move and select, Tab enters and leaves) with
 * a visible text label for every choice, so selection never relies on color
 * alone (`rules/ui-and-accessibility.md`). The legend names the group and a
 * server or validation error is announced and linked to it.
 */
export function ChoiceGroup<TValue extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  onBlur,
  swatch = false,
  error,
  disabled = false,
  lockedLabel,
}: ChoiceGroupProps<TValue>) {
  const errorId = useId();
  const hasError = error !== undefined && error !== '';

  return (
    <fieldset
      className="grid min-w-0 gap-2 border-0 p-0"
      aria-describedby={hasError ? errorId : undefined}
      disabled={disabled}
    >
      <legend className="mb-1 font-display text-sm font-semibold text-foreground">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option.value === value;
          const locked = option.locked === true && !checked;
          return (
            <label
              key={option.value}
              className={cn(
                'relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium text-foreground has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-ring',
                checked
                  ? 'border-primary bg-card font-semibold shadow-raised'
                  : 'border-edge bg-tray/60 hover:bg-tray-hover',
                locked &&
                  'cursor-not-allowed border-dashed bg-tray/30 text-muted-foreground hover:bg-tray/30',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                onBlur={onBlur}
                disabled={locked}
                className="sr-only"
              />
              {swatch && (
                <span
                  aria-hidden="true"
                  data-swatch={option.value}
                  className="size-5 shrink-0 rounded-full border-2 border-foreground/70"
                  style={{ backgroundColor: option.value }}
                />
              )}
              <span>{option.label}</span>
              {locked && (
                <>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="size-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                  </svg>
                  {lockedLabel !== undefined && (
                    <span className="sr-only">, {lockedLabel}</span>
                  )}
                </>
              )}
              {checked && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-4 shrink-0 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3 8.5 3.2 3.2L13 4.8" />
                </svg>
              )}
            </label>
          );
        })}
      </div>
      {hasError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm font-semibold text-destructive"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}
