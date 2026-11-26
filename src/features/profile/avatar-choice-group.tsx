import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import {
  CHOICE_GRID_CLASS,
  choiceCardClass,
  CornerMark,
  LockGlyph,
} from './choice-card';
import type { AvatarOption } from './avatar-options';
import { profileMessages } from './messages';

const copy = profileMessages.avatar;

export interface AvatarChoiceGroupProps<TValue extends string> {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly AvatarOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly onBlur?: () => void;
  readonly error?: string;
  readonly disabled?: boolean;
  /** Picture of an option; without it the options are color swatches. */
  readonly renderPicture?: (option: AvatarOption<TValue>) => ReactNode;
  /** Where a locked option leads. */
  readonly shopHref?: string;
  readonly className?: string;
}

/**
 * Native radio group (arrow keys move and select, Tab enters and leaves) drawn
 * as picture cards or color swatches, always with a visible name. A locked
 * option stays a disabled radio and the whole card links to the shop.
 */
export function AvatarChoiceGroup<TValue extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  renderPicture,
  shopHref = '/',
  className,
}: AvatarChoiceGroupProps<TValue>) {
  const errorId = useId();
  const hasError = error !== undefined && error !== '';
  const swatches = renderPicture === undefined;

  const radio = (option: AvatarOption<TValue>, locked: boolean) => (
    <input
      type="radio"
      name={name}
      value={option.value}
      checked={option.value === value}
      onChange={() => onChange(option.value)}
      onBlur={onBlur}
      disabled={locked}
      className="sr-only"
    />
  );

  return (
    <fieldset
      className="grid min-w-0 gap-2 border-0 p-0"
      aria-describedby={hasError ? errorId : undefined}
      disabled={disabled}
    >
      <legend className="mb-2 font-display text-base font-semibold text-foreground">
        {legend}
      </legend>
      {hasError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm font-semibold text-destructive"
        >
          {error}
        </p>
      )}
      <div
        className={cn(
          swatches ? 'flex flex-wrap gap-1' : CHOICE_GRID_CLASS,
          disabled && 'opacity-60',
          className,
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;
          const locked = option.locked === true && !checked;

          if (swatches) {
            return (
              <label
                key={option.value}
                className={cn(
                  'relative flex w-16 cursor-pointer flex-col items-center gap-1 rounded-xl p-1 text-center text-xs text-foreground has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring',
                  checked && 'font-bold',
                  disabled && 'cursor-not-allowed',
                )}
              >
                {radio(option, locked)}
                <span
                  aria-hidden="true"
                  data-swatch={option.value}
                  className={cn(
                    'relative size-11 rounded-full border-2 border-foreground/70',
                    checked &&
                      'outline-3 outline-offset-2 outline-primary outline-solid',
                  )}
                  style={{ backgroundColor: option.value }}
                >
                  {checked && <CornerMark kind="selected" />}
                </span>
                <span className="mt-1">{option.label}</span>
              </label>
            );
          }

          return (
            <div
              key={option.value}
              className={cn(
                choiceCardClass({ selected: checked, locked }),
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              )}
            >
              <label
                className={cn(
                  'relative flex flex-1 cursor-pointer flex-col gap-1 p-1',
                  (disabled || locked) && 'cursor-not-allowed',
                )}
              >
                {radio(option, locked)}
                <span
                  aria-hidden="true"
                  className={cn('block', locked && 'opacity-55 grayscale')}
                >
                  {renderPicture(option)}
                </span>
                {checked && <CornerMark kind="selected" />}
                {locked && <CornerMark kind="locked" />}
                <span
                  className={cn(
                    'flex flex-1 items-center justify-center px-1 pb-1 text-sm leading-tight font-medium',
                    checked && 'font-bold',
                  )}
                >
                  {option.label}
                </span>
                {locked && (
                  <span className="sr-only">, {copy.styleLockedLabel}</span>
                )}
              </label>
              {checked && (
                <span
                  aria-hidden="true"
                  className="bg-primary py-1 text-xs font-bold text-primary-foreground"
                >
                  {copy.chosen}
                </span>
              )}
              {locked && (
                <Link
                  to={shopHref}
                  aria-label={copy.shopLinkLabel(option.label)}
                  className="absolute inset-0 flex items-end focus-visible:outline-none"
                >
                  <span className="flex w-full items-center justify-center gap-1 bg-tray py-1 text-xs font-bold text-foreground underline underline-offset-2">
                    <LockGlyph className="size-3" />
                    {copy.shopCta}
                  </span>
                </Link>
              )}
              {/* Keeps the name clear of the link strip laid over the card. */}
              {locked && <span aria-hidden="true" className="h-6" />}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
