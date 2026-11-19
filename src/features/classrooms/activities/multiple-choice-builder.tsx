import { useId } from 'react';
import {
  useFieldArray,
  useFormState,
  useWatch,
  type FieldErrors,
  type UseFormReturn,
} from 'react-hook-form';
import { FormField } from '@/components/forms/form-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ActivityEditorFormInput } from './activity-editor-schema';
import { activityMessages } from './messages';

const messages = activityMessages.editor.questions;

/** Form API of the activity editor, independent of the create/edit output. */
export type ActivityEditorFormApi = UseFormReturn<
  ActivityEditorFormInput,
  unknown,
  unknown
>;

function blankQuestion() {
  return {
    prompt: '',
    options: [
      { label: '', isCorrect: false },
      { label: '', isCorrect: false },
    ],
  };
}

interface MultipleChoiceBuilderProps {
  readonly form: ActivityEditorFormApi;
  readonly disabled?: boolean;
}

/**
 * Accessible multiple-choice builder (`HU-ACT-001`): add/remove/reorder
 * questions and options with buttons only (no drag dependency), visible labels
 * on every control, and a native radio group per question that makes
 * single-correct selection obvious. Correct answers exist only inside this
 * teacher-gated dialog; the "exactly one correct option" contract rule stays
 * owned by the payload schema and is surfaced here per question.
 */
export function MultipleChoiceBuilder({
  form,
  disabled = false,
}: MultipleChoiceBuilderProps) {
  const { control } = form;
  const { errors } = useFormState({ control });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'questions',
  });

  const questionsError = rootQuestionsError(errors);

  return (
    <section className="min-w-0 space-y-3" aria-label={messages.heading}>
      <h3 className="font-display text-base font-semibold text-foreground">
        {messages.heading}
      </h3>
      <p className="text-sm text-pretty text-muted-foreground">
        {messages.description}
      </p>

      {questionsError !== null && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {questionsError}
        </p>
      )}

      <ol className="min-w-0 space-y-4">
        {fields.map((question, index) => (
          <li key={question.id} className="min-w-0">
            <QuestionFields
              key={question.id}
              form={form}
              index={index}
              disabled={disabled}
              onRemove={() => remove(index)}
              onMoveUp={index > 0 ? () => move(index, index - 1) : undefined}
              onMoveDown={
                index < fields.length - 1
                  ? () => move(index, index + 1)
                  : undefined
              }
            />
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => append(blankQuestion())}
        className="min-h-11"
      >
        {messages.addQuestion}
      </Button>
    </section>
  );
}

/** Root-level `questions` error (required for MCQ, forbidden for FILE). */
function rootQuestionsError(
  errors: FieldErrors<ActivityEditorFormInput>,
): string | null {
  const questionErrors = errors.questions;
  if (questionErrors === undefined || questionErrors === null) {
    return null;
  }
  const message = (questionErrors as { message?: string }).message;
  return typeof message === 'string' && message !== '' ? message : null;
}

/** Per-question `options` error: option count bounds or exactly-one-correct rule. */
function questionOptionsError(
  errors: FieldErrors<ActivityEditorFormInput>,
  index: number,
): string | null {
  const questionErrors = errors.questions;
  if (questionErrors === undefined || questionErrors === null) {
    return null;
  }
  // React Hook Form nests array-field errors as an object with numeric keys
  // (not a real array), and an array-level error lands under a `root` key
  // beside the element errors.
  const options = (questionErrors as Record<number, unknown>)[index] as
    | { options?: { root?: { message?: unknown }; message?: unknown } }
    | undefined;
  const message = options?.options?.root?.message ?? options?.options?.message;
  return typeof message === 'string' && message !== '' ? message : null;
}

interface QuestionFieldsProps {
  readonly form: ActivityEditorFormApi;
  readonly index: number;
  readonly disabled?: boolean;
  readonly onRemove: () => void;
  readonly onMoveUp?: () => void;
  readonly onMoveDown?: () => void;
}

function QuestionFields({
  form,
  index,
  disabled = false,
  onRemove,
  onMoveUp,
  onMoveDown,
}: QuestionFieldsProps) {
  const { control } = form;
  const position = index + 1;
  const groupId = useId();
  const hintId = `${groupId}-hint`;
  const optionsErrorId = `${groupId}-options-error`;

  const { errors } = useFormState({ control });
  // Nested field array on `questions.<index>.options`; `field.id` keys keep a
  // stable row identity across reordering, and `useWatch` mirrors the live
  // label/correct values into the rows.
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `questions.${index}.options`,
  });
  const options = useWatch({
    control,
    name: `questions.${index}.options`,
  });

  const optionsError = questionOptionsError(errors, index);

  /** Selecting one option unmarks every other option of the question. */
  const markCorrect = (optionIndex: number): void => {
    const next = (options ?? []).map((option, otherIndex) => ({
      label: option?.label ?? '',
      isCorrect: otherIndex === optionIndex,
    }));
    form.setValue(`questions.${index}.options`, next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3 rounded-2xl border border-edge bg-tray/30 p-3.5"
    >
      <legend className="font-display text-sm font-semibold text-foreground">
        {messages.questionLegend(position)}
      </legend>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={messages.moveQuestionUp(position)}
          disabled={disabled || onMoveUp === undefined}
          onClick={onMoveUp}
        >
          <span aria-hidden="true">↑</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={messages.moveQuestionDown(position)}
          disabled={disabled || onMoveDown === undefined}
          onClick={onMoveDown}
        >
          <span aria-hidden="true">↓</span>
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label={messages.removeQuestion(position)}
          disabled={disabled}
          onClick={onRemove}
        >
          <span aria-hidden="true">✕</span>
        </Button>
      </div>

      <FormField
        control={control}
        name={`questions.${index}.prompt`}
        label={messages.prompt.label}
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="text"
            placeholder={messages.prompt.placeholder}
          />
        )}
      </FormField>

      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-foreground">
          {messages.optionsLegend(position)}
        </p>
        <ol className="min-w-0 space-y-2">
          {fields.map((optionField, optionIndex) => {
            const optionPosition = optionIndex + 1;
            const isCorrect = options?.[optionIndex]?.isCorrect === true;
            return (
              <li
                key={optionField.id}
                className="flex min-w-0 flex-wrap items-start gap-2"
              >
                <div className="min-w-[min(100%,14rem)] flex-1">
                  <FormField
                    control={control}
                    name={`questions.${index}.options.${optionIndex}.label`}
                    label={messages.optionLabel(optionPosition)}
                  >
                    {(fieldProps) => (
                      <Input
                        {...fieldProps}
                        type="text"
                        placeholder={messages.optionPlaceholder}
                      />
                    )}
                  </FormField>
                </div>
                <label
                  className={cn(
                    'flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold text-foreground focus-within:border-primary focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ring',
                    isCorrect ? 'border-primary bg-tray/60' : 'border-edge',
                  )}
                >
                  <input
                    type="radio"
                    name={groupId}
                    checked={isCorrect}
                    aria-label={messages.markCorrect(optionPosition)}
                    aria-describedby={`${hintId} ${
                      optionsError ? optionsErrorId : ''
                    }`.trim()}
                    onChange={() => markCorrect(optionIndex)}
                  />
                  <span>{messages.correctOptionLabel}</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={messages.removeOption(optionPosition)}
                  disabled={disabled}
                  onClick={() => remove(optionIndex)}
                >
                  <span aria-hidden="true">✕</span>
                </Button>
                <div className="flex min-h-11 shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={messages.moveOptionUp(optionPosition)}
                    disabled={disabled || optionIndex === 0}
                    onClick={() => move(optionIndex, optionIndex - 1)}
                  >
                    <span aria-hidden="true">↑</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={messages.moveOptionDown(optionPosition)}
                    disabled={disabled || optionIndex === fields.length - 1}
                    onClick={() => move(optionIndex, optionIndex + 1)}
                  >
                    <span aria-hidden="true">↓</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        <p id={hintId} className="text-sm text-muted-foreground">
          {messages.correctHint}
        </p>
        {optionsError !== null && (
          <p
            id={optionsErrorId}
            role="alert"
            className="text-sm font-semibold text-destructive"
          >
            {optionsError}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => append({ label: '', isCorrect: false })}
          className="min-h-11"
        >
          {messages.addOption}
        </Button>
      </div>
    </fieldset>
  );
}
