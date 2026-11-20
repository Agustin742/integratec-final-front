import { useEffect, useRef, useState, type RefObject } from 'react';
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
type AnswerState = ReturnType<typeof useAnswerDailyReviewQuestion>;

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
  const answerState = useAnswerDailyReviewQuestion();
  const [dismissed, setDismissed] = useState(false);

  if (snapshot.status !== 'authenticated') {
    return null;
  }

  const due =
    review.data?.status === 'due' ? (review.data as DueDailyReview) : null;
  const open = due !== null && !dismissed;
  // An unanswered daily question must not be lost to a stray Escape or click
  // outside; only the explicit close button dismisses the dialog meanwhile.
  const questionPending =
    due !== null &&
    due.audience === 'STUDENT' &&
    due.dailyQuestion !== null &&
    answerState.data === null &&
    answerState.error?.category !== 'already_answered';
  const keepOpen = (event: Event) => {
    if (questionPending) {
      event.preventDefault();
    }
  };

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
        <DialogContent onEscapeKeyDown={keepOpen} onInteractOutside={keepOpen}>
          <DailyReviewContent review={due} answerState={answerState} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DailyReviewContent({
  review,
  answerState,
}: {
  readonly review: DueDailyReview;
  readonly answerState: AnswerState;
}) {
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
        <DailyQuestionCard
          question={review.dailyQuestion}
          answerState={answerState}
        />
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
        <section
          key={section.kind}
          aria-labelledby={`daily-review-section-${section.kind}`}
        >
          <h3
            id={`daily-review-section-${section.kind}`}
            className="font-display text-lg font-semibold"
          >
            {sectionTitle(section.kind)}
          </h3>
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {section.kind === 'pending'
                ? m.dialog.sections.emptyPending
                : m.dialog.sections.emptyNews}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {/* Static list: the index only disambiguates identical items. */}
              {section.items.map((item, index) => (
                <li
                  key={`${item.kind}|${item.classroomName ?? ''}|${item.dueAt ?? ''}|${item.title}|${String(index)}`}
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
    parts.push(`${m.dialog.sections.duePrefix} ${formatDeadline(item.dueAt)}`);
  }
  if (item.detail !== null) {
    parts.push(item.detail);
  }
  return parts.join(' · ');
}

function DailyQuestionCard({
  question,
  answerState,
}: {
  readonly question: DailyQuestionDto;
  readonly answerState: AnswerState;
}) {
  const { answer, isPending, data, error } = answerState;
  const [selected, setSelected] = useState<string | null>(null);
  // Two clicks in the same tick can both pass before `isPending` re-renders.
  const inFlight = useRef(false);
  // A 409 means the server already holds today's answer: lock like a success.
  const answered = data !== null || error?.category === 'already_answered';
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const lockMessageRef = useRef<HTMLParagraphElement>(null);

  // The submit button unmounts once answered, so focus would fall to the page
  // body; move it to the result (or the lock message) instead.
  useEffect(() => {
    if (answered) {
      (resultHeadingRef.current ?? lockMessageRef.current)?.focus();
    }
  }, [answered]);

  return (
    <section
      aria-labelledby="daily-review-question-heading"
      className="rounded-2xl border border-edge bg-card p-4"
    >
      <h3
        id="daily-review-question-heading"
        className="font-display text-lg font-semibold"
      >
        {m.dialog.question.title}
      </h3>
      <p className="text-sm text-muted-foreground">
        {m.dialog.question.description}
      </p>
      {question.materialTitle !== null ? (
        <p className="text-sm text-muted-foreground">
          {m.dialog.question.materialPrefix} {question.materialTitle}
        </p>
      ) : null}

      <fieldset disabled={answered || isPending} className="mt-2">
        <legend className="font-medium text-foreground">
          {question.prompt}
        </legend>
        <div className="mt-2 flex flex-col gap-2">
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
              if (selected !== null && !inFlight.current) {
                inFlight.current = true;
                void answer({
                  questionId: question.id,
                  answer: selected,
                })
                  .catch(() => {
                    // Failures surface through the hook's `error` field.
                  })
                  .finally(() => {
                    inFlight.current = false;
                  });
              }
            }}
          >
            {isPending
              ? m.dialog.question.submitting
              : m.dialog.question.submit}
          </Button>
        </div>
      ) : null}

      {/* Persistent live region: content injected into it gets announced. */}
      <div role="status" aria-live="polite">
        {data !== null ? (
          <AnswerResult result={data} headingRef={resultHeadingRef} />
        ) : null}
      </div>

      {error !== null ? (
        <p
          ref={lockMessageRef}
          tabIndex={-1}
          role="alert"
          className="mt-2 text-sm text-destructive outline-none"
        >
          {error.category === 'already_answered'
            ? m.dialog.question.alreadyAnswered
            : m.dialog.question.submitFailed}
        </p>
      ) : null}
    </section>
  );
}

function AnswerResult({
  result,
  headingRef,
}: {
  readonly result: DailyQuestionAnswerResultDto;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="mt-3 rounded-xl border border-edge p-3">
      <h4
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-base font-semibold outline-none"
      >
        {result.correct
          ? m.dialog.question.correctTitle
          : m.dialog.question.incorrectTitle}
      </h4>
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
