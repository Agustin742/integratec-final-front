import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDeadline } from '@/lib/dates';
import { useSessionSnapshot } from '@/session/provider';
import type {
  DailyQuestionAnswerResultDto,
  DailyQuestionDto,
  DailyReviewResponseDto,
  DailyReviewSectionDto,
} from './daily-review-schema';
import { dailyReviewMessages as m } from './messages';
import {
  useAnswerDailyReviewQuestion,
  useOwnDailyReview,
} from './use-daily-review';

type DueDailyReview = Extract<DailyReviewResponseDto, { status: 'due' }>;

/**
 * Once-per-day daily review dialog (`HU-BOT-003`, #55). Mounted once in the
 * authenticated app shell; the server decides eligibility and delivery, so the
 * dialog opens only while the server answer says `due` and stays closed on
 * reloads, other tabs, and for parents. A pending or failed eligibility check
 * never blocks the application: the dialog simply stays closed.
 */
export function DailyReviewDialog() {
  const snapshot = useSessionSnapshot();
  const review = useOwnDailyReview();
  const [dismissed, setDismissed] = useState(false);

  if (snapshot.status !== 'authenticated') {
    return null;
  }

  const due =
    review.data?.status === 'due'
      ? (review.data as DueDailyReview)
      : null;
  const open = due !== null && !dismissed;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDismissed(true);
        }
      }}
    >
      {open && due !== null ? (
        <DialogContent aria-describedby={undefined}>
          <DailyReviewContent review={due} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DailyReviewContent({ review }: { readonly review: DueDailyReview }) {
  const isStudent = review.audience === 'STUDENT';

  return (
    <>
      <DialogTitle>{m.dialog.title}</DialogTitle>
      <DialogDescription>{m.dialog.description}</DialogDescription>

      {review.contentKind === 'structured' ? (
        <p className="rounded-2xl border border-edge bg-secondary/40 p-3 text-sm text-secondary-foreground">
          {m.dialog.structuredNotice}
        </p>
      ) : (
        review.summary !== null && (
          <p className="text-base leading-relaxed text-foreground">
            {review.summary}
          </p>
        )
      )}

      <DailyReviewSections sections={review.sections} />

      {isStudent && review.dailyQuestion !== null ? (
        <DailyQuestionCard question={review.dailyQuestion} />
      ) : null}
    </>
  );
}

function DailyReviewSections({
  sections,
}: {
  readonly sections: readonly DailyReviewSectionDto[];
}) {
  const hasAnyItem = sections.some((section) => section.items.length > 0);

  if (!hasAnyItem) {
    return (
      <div className="rounded-2xl border border-edge p-4">
        <p className="font-display text-lg font-semibold">
          {m.dialog.sections.emptyTitle}
        </p>
        <p className="text-sm text-muted-foreground">
          {m.dialog.sections.emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <section key={section.kind} aria-label={sectionTitle(section.kind)}>
          <h2 className="font-display text-lg font-semibold">
            {sectionTitle(section.kind)}
          </h2>
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {m.dialog.sections.emptyTitle}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {section.items.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-edge bg-card p-3"
                >
                  <p className="font-medium text-foreground">{item.title}</p>
                  {itemMetadata(item) !== '' ? (
                    <p className="text-sm text-muted-foreground">
                      {itemMetadata(item)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function sectionTitle(kind: DailyReviewSectionDto['kind']): string {
  return kind === 'pending'
    ? m.dialog.sections.pending
    : m.dialog.sections.news;
}

function itemMetadata(item: DailyReviewSectionDto['items'][number]): string {
  const parts: string[] = [];
  if (item.classroomName !== null) {
    parts.push(item.classroomName);
  }
  if (item.dueAt !== null) {
    // Deadlines arrive as UTC instants and are displayed in the school time
    // zone (FD11); the browser time zone never decides the shown value.
    parts.push(
      `${m.dialog.sections.duePrefix} ${formatDeadline(item.dueAt)}`,
    );
  }
  if (item.detail !== null) {
    parts.push(item.detail);
  }
  return parts.join(' · ');
}

function DailyQuestionCard({
  question,
}: {
  readonly question: DailyQuestionDto;
}) {
  const { answer, isPending, data, error } = useAnswerDailyReviewQuestion();
  const [selected, setSelected] = useState<string | null>(null);
  const answered = data !== null;

  return (
    <section
      aria-labelledby="daily-review-question-heading"
      className="rounded-2xl border border-edge bg-card p-4"
    >
      <h2
        id="daily-review-question-heading"
        className="font-display text-lg font-semibold"
      >
        {m.dialog.question.title}
      </h2>
      <p className="text-sm text-muted-foreground">
        {m.dialog.question.description}
      </p>
      {question.materialTitle !== null ? (
        <p className="text-sm text-muted-foreground">
          {m.dialog.question.materialPrefix} {question.materialTitle}
        </p>
      ) : null}
      <p className="mt-2 font-medium text-foreground">{question.prompt}</p>

      <fieldset disabled={answered || isPending} className="mt-2">
        <legend className="sr-only">{m.dialog.question.optionsLegend}</legend>
        <div
          role="radiogroup"
          aria-label={question.prompt}
          className="flex flex-col gap-2"
        >
          {question.options.map((option) => (
            <label
              key={option}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-edge px-3 py-2 text-foreground"
            >
              <input
                type="radio"
                name="daily-review-question-option"
                value={option}
                checked={selected === option}
                onChange={() => {
                  setSelected(option);
                }}
                className="size-4 accent-[var(--primary)]"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {!answered ? (
        <div className="mt-3">
          <Button
            type="button"
            disabled={selected === null || isPending}
            busy={isPending}
            onClick={() => {
              if (selected !== null) {
                void answer({
                  questionId: question.id,
                  answer: selected,
                }).catch(() => {
                  // Failures surface through the hook's `error` field.
                });
              }
            }}
          >
            {isPending ? m.dialog.question.submitting : m.dialog.question.submit}
          </Button>
        </div>
      ) : null}

      {answered && data !== null ? <AnswerResult result={data} /> : null}

      {error !== null ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error.category === 'already_answered'
            ? m.dialog.question.alreadyAnswered
            : `${m.errors.unexpected} ${m.dialog.question.retryHint}`}
        </p>
      ) : null}
    </section>
  );
}

function AnswerResult({
  result,
}: {
  readonly result: DailyQuestionAnswerResultDto;
}) {
  return (
    <div role="status" className="mt-3 rounded-xl border border-edge p-3">
      <h3 className="font-display text-base font-semibold">
        {result.correct
          ? m.dialog.question.correctTitle
          : m.dialog.question.incorrectTitle}
      </h3>
      {result.feedback !== null ? (
        <p className="text-sm text-foreground">{result.feedback}</p>
      ) : null}
      {result.correct && result.streak !== null ? (
        <p className="text-sm font-medium text-primary">
          {m.dialog.question.streakFeedback(result.streak.currentStreak)}
        </p>
      ) : null}
    </div>
  );
}
