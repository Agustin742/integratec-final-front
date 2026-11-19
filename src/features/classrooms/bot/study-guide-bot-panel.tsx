import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomBotStatusQueryKey,
  classroomDetailQueryKey,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSessionService } from '@/session/provider';
import { useClassroomContext } from '../use-classroom-capabilities';
import {
  BOT_MAX_QUESTION_LENGTH,
  askStudyGuideBotInputSchema,
  type BotAnswerDto,
  type BotStatusDto,
} from './bot-schema';
import {
  BotServiceError,
  askStudyGuideBot,
  fetchClassroomBotStatus,
} from './bot-service';
import { botMessages } from './messages';

interface BotTurn {
  readonly id: string;
  readonly question: string;
  readonly reply: BotAnswerDto;
}

interface BotNotice {
  readonly title: string;
  readonly description: string;
}

export function StudyGuideBotPanel() {
  const { classroomId } = useParams();
  if (!classroomId) {
    return (
      <ErrorState
        headingLevel="h3"
        title={botMessages.loadErrorTitle}
        description={botMessages.loadErrorDescription}
      />
    );
  }
  return <StudyGuideBotHost classroomId={classroomId} />;
}

function StudyGuideBotHost({ classroomId }: { readonly classroomId: string }) {
  const context = useClassroomContext(classroomId);

  if (context.status === 'error') {
    return (
      <ErrorState
        headingLevel="h3"
        title={botMessages.loadErrorTitle}
        description={context.error.userMessage}
        onRetry={context.retry}
      />
    );
  }

  if (context.status === 'pending') {
    return <LoadingState label={botMessages.loading} />;
  }

  if (context.classroom.myRole === 'PARENT') {
    return (
      <ErrorState
        headingLevel="h3"
        title={botMessages.parentDeniedTitle}
        description={botMessages.parentDeniedDescription}
      />
    );
  }

  return (
    <StudyGuideBotConversation
      key={`${context.userId}:${classroomId}`}
      userId={context.userId}
      classroomId={classroomId}
    />
  );
}

function StudyGuideBotConversation({
  userId,
  classroomId,
}: {
  readonly userId: string;
  readonly classroomId: string;
}) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();

  const [turns, setTurns] = useState<readonly BotTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<BotNotice | null>(null);
  const [isSending, setIsSending] = useState(false);

  const sendingRef = useRef(false);
  const activeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      activeAbortRef.current?.abort();
      activeAbortRef.current = null;
    };
  }, []);

  const statusQuery = useQuery({
    queryKey: classroomBotStatusQueryKey(userId, classroomId),
    queryFn: ({ signal }) =>
      fetchClassroomBotStatus(client, classroomId, { signal }),
  });

  if (statusQuery.isPending && statusQuery.data === undefined) {
    return <LoadingState label={botMessages.loading} />;
  }

  if (statusQuery.isError && statusQuery.data === undefined) {
    const description =
      statusQuery.error instanceof Error
        ? statusQuery.error.message
        : botMessages.loadErrorDescription;
    return (
      <ErrorState
        headingLevel="h3"
        title={botMessages.loadErrorTitle}
        description={description}
        onRetry={() => void statusQuery.refetch()}
      />
    );
  }

  const botStatus = statusQuery.data;
  if (!botStatus) {
    return <LoadingState label={botMessages.loading} />;
  }

  const isExamLocked =
    !botStatus.available && botStatus.reason === 'exam_in_progress';
  const isUnavailable = !botStatus.available;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current || isUnavailable) return;

    const trimmed = question.trim();
    if (trimmed.length === 0) {
      setFieldError(botMessages.emptyQuestionError);
      return;
    }
    if (trimmed.length > BOT_MAX_QUESTION_LENGTH) {
      setFieldError(botMessages.tooLongQuestionError(BOT_MAX_QUESTION_LENGTH));
      return;
    }

    const parsed = askStudyGuideBotInputSchema.safeParse({ question: trimmed });
    if (!parsed.success) {
      setFieldError(botMessages.emptyQuestionError);
      return;
    }

    setFieldError(null);
    setSendNotice(null);
    sendingRef.current = true;
    setIsSending(true);

    const controller = new AbortController();
    activeAbortRef.current = controller;

    try {
      const reply = await askStudyGuideBot(client, classroomId, parsed.data, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setTurns((prev) => [
        ...prev,
        {
          id: reply.id,
          question: parsed.data.question,
          reply,
        },
      ]);
      setQuestion('');
    } catch (error) {
      if (
        (error instanceof Error || error instanceof DOMException) &&
        error.name === 'AbortError'
      ) {
        return;
      }

      if (error instanceof BotServiceError) {
        if (error.category === 'exam_locked') {
          queryClient.setQueryData<BotStatusDto>(
            classroomBotStatusQueryKey(userId, classroomId),
            {
              available: false,
              reason: 'exam_in_progress',
              message: error.message,
            },
          );
          setSendNotice({
            title: botMessages.errors.examLockedTitle,
            description: error.message,
          });
          return;
        }
        if (error.category === 'rate_limited') {
          setSendNotice({
            title: botMessages.errors.rateLimitedTitle,
            description: error.message,
          });
          return;
        }
        if (error.category === 'provider_unavailable') {
          setSendNotice({
            title: botMessages.errors.providerUnavailableTitle,
            description: error.message,
          });
          return;
        }
        if (error.category === 'forbidden' || error.category === 'not_found') {
          setSendNotice({
            title: botMessages.errors.forbiddenTitle,
            description: error.message,
          });
          void queryClient.invalidateQueries({
            queryKey: classroomDetailQueryKey(userId, classroomId),
          });
          return;
        }
        setSendNotice({
          title: botMessages.errors.unexpectedTitle,
          description: error.message,
        });
        return;
      }

      setSendNotice({
        title: botMessages.errors.unexpectedTitle,
        description:
          error instanceof ApiError
            ? error.userMessage
            : botMessages.errors.unexpectedDescription,
      });
    } finally {
      sendingRef.current = false;
      if (activeAbortRef.current === controller) {
        activeAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setIsSending(false);
      }
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm text-muted-foreground">{botMessages.subtitle}</p>

      {statusQuery.isError && (
        <StaleDataNotice
          title={botMessages.staleTitle}
          description={botMessages.staleDescription}
          onRetry={() => void statusQuery.refetch()}
        />
      )}

      {isUnavailable && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            {isExamLocked
              ? botMessages.examLockedTitle
              : botMessages.loadErrorTitle}
          </AlertTitle>
          <AlertDescription>
            {botStatus.message ??
              (isExamLocked
                ? botMessages.examLockedDefault
                : botMessages.unavailableDefault)}
          </AlertDescription>
        </Alert>
      )}

      {sendNotice && !isExamLocked && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{sendNotice.title}</AlertTitle>
          <AlertDescription>{sendNotice.description}</AlertDescription>
        </Alert>
      )}

      <section aria-label={botMessages.conversationRegionLabel}>
        {turns.length === 0 ? (
          <EmptyState
            title={botMessages.emptyHistoryTitle}
            description={botMessages.emptyHistoryDescription}
          />
        ) : (
          <ul className="space-y-4">
            {turns.map((turn) => (
              <li
                key={turn.id}
                className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {botMessages.userAuthorLabel}
                  </p>
                  <p className="text-sm text-foreground wrap-anywhere">
                    {turn.question}
                  </p>
                </div>

                <div className="space-y-2 border-t border-border/60 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-primary">
                      {botMessages.botAuthorLabel}
                    </p>
                    {turn.reply.outcome === 'out_of_scope' && (
                      <Badge variant="outline">
                        {botMessages.outOfScopeBadge}
                      </Badge>
                    )}
                    {turn.reply.outcome === 'guided_only' && (
                      <Badge variant="secondary">
                        {botMessages.guidedOnlyBadge}
                      </Badge>
                    )}
                  </div>

                  <p className="whitespace-pre-line text-sm text-foreground wrap-anywhere">
                    {turn.reply.answer}
                  </p>

                  {turn.reply.citations.length > 0 && (
                    <div className="space-y-1.5 rounded-xl bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {botMessages.citationsLabel}
                      </p>
                      <ul className="space-y-1">
                        {turn.reply.citations.map((citation) => (
                          <li
                            key={`${turn.id}-${citation.materialId}`}
                            className="text-xs text-foreground wrap-anywhere"
                          >
                            <span className="font-medium">
                              {citation.filename}
                            </span>
                            {typeof citation.excerpt === 'string' &&
                              citation.excerpt.length > 0 && (
                                <span className="text-muted-foreground">
                                  {' — '}
                                  {citation.excerpt}
                                </span>
                              )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="space-y-3 rounded-2xl border border-border bg-card/70 p-4"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="study-guide-bot-question"
            className="text-sm font-medium text-foreground"
          >
            {botMessages.composerLabel}
          </label>
          <textarea
            id="study-guide-bot-question"
            rows={3}
            value={question}
            disabled={isUnavailable}
            aria-invalid={fieldError !== null || undefined}
            aria-describedby={
              fieldError !== null ? 'study-guide-bot-field-error' : undefined
            }
            placeholder={botMessages.composerPlaceholder}
            onChange={(event) => {
              setQuestion(event.target.value);
              if (fieldError !== null) setFieldError(null);
            }}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
          {fieldError !== null && (
            <p
              id="study-guide-bot-field-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {fieldError}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isUnavailable}
            aria-disabled={isSending || isUnavailable || undefined}
          >
            {isSending ? botMessages.sendingAction : botMessages.sendAction}
          </Button>
        </div>
      </form>
    </div>
  );
}
