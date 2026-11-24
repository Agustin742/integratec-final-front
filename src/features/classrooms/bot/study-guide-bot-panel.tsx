import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
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
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const sendingRef = useRef(false);
  const activeAbortRef = useRef<AbortController | null>(null);
  const terminalReconciledRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeAbortRef.current?.abort();
      activeAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView?.({ block: 'end' });
  }, [turns.length, pendingQuestion]);

  const statusQuery = useQuery({
    queryKey: classroomBotStatusQueryKey(userId, classroomId),
    queryFn: ({ signal }) =>
      fetchClassroomBotStatus(client, classroomId, { signal }),
    staleTime: 0,
    gcTime: 0,
  });

  const isTerminalStatusError =
    statusQuery.isError &&
    statusQuery.error instanceof BotServiceError &&
    (statusQuery.error.category === 'forbidden' ||
      statusQuery.error.category === 'not_found');

  const isExamLocked =
    statusQuery.data !== undefined &&
    !statusQuery.data.available &&
    statusQuery.data.reason === 'exam_in_progress';

  const composerId = useId();
  const fieldErrorId = useId();

  useEffect(() => {
    if (isExamLocked || isTerminalStatusError) {
      activeAbortRef.current?.abort();
      activeAbortRef.current = null;
      sendingRef.current = false;
    }
  }, [isExamLocked, isTerminalStatusError]);

  useEffect(() => {
    if (!isTerminalStatusError) {
      terminalReconciledRef.current = false;
      return;
    }
    if (!terminalReconciledRef.current) {
      terminalReconciledRef.current = true;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
      });
    }
  }, [classroomId, isTerminalStatusError, queryClient, userId]);

  if (isTerminalStatusError) {
    const terminalError = statusQuery.error as BotServiceError;
    return (
      <ErrorState
        headingLevel="h3"
        title={
          terminalError.category === 'forbidden'
            ? botMessages.errors.forbiddenTitle
            : botMessages.errors.notFoundTitle
        }
        description={terminalError.message}
      />
    );
  }

  if (statusQuery.isPending && statusQuery.data === undefined) {
    return <LoadingState label={botMessages.loading} />;
  }

  if (statusQuery.isError && statusQuery.data === undefined) {
    const description =
      statusQuery.error instanceof BotServiceError ||
      statusQuery.error instanceof ApiError
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

  const isUnavailable = !botStatus.available;
  const effectiveIsSending = isSending && !isUnavailable;
  const statusMessage =
    typeof botStatus.message === 'string' && botStatus.message.trim().length > 0
      ? botStatus.message.trim()
      : null;

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
    setPendingQuestion(parsed.data.question);

    const controller = new AbortController();
    activeAbortRef.current = controller;

    try {
      const reply = await askStudyGuideBot(client, classroomId, parsed.data, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const latestStatus = queryClient.getQueryData<BotStatusDto>(
        classroomBotStatusQueryKey(userId, classroomId),
      );
      if (latestStatus && !latestStatus.available) {
        return;
      }

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
          setSendNotice(null);
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
            title:
              error.category === 'forbidden'
                ? botMessages.errors.forbiddenTitle
                : botMessages.errors.notFoundTitle,
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
      if (isMountedRef.current) {
        setPendingQuestion(null);
        setIsSending(false);
      }
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-edge bg-tray/60 px-4 py-3 shadow-inset">
        <BotAvatar />
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {botMessages.headerTitle}
          </h3>
          <p className="text-sm text-pretty text-muted-foreground">
            {botMessages.subtitle}
          </p>
        </div>
        <Badge variant={isUnavailable ? 'secondary' : 'success'}>
          {isUnavailable
            ? botMessages.statusUnavailable
            : botMessages.statusAvailable}
        </Badge>
      </header>

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
              : botMessages.unavailableTitle}
          </AlertTitle>
          <AlertDescription>
            {statusMessage ??
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

      {!isExamLocked &&
        (turns.length === 0 && pendingQuestion === null ? (
          <div className="min-w-0 space-y-4">
            <EmptyState
              title={botMessages.emptyHistoryTitle}
              description={botMessages.emptyHistoryDescription}
            />
            <div
              role="group"
              aria-label={botMessages.suggestionsLabel}
              className="flex flex-wrap justify-center gap-2"
            >
              {botMessages.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUnavailable || effectiveIsSending}
                  onClick={() => {
                    setQuestion(suggestion);
                    setFieldError(null);
                  }}
                  className="h-auto min-h-11 text-left whitespace-normal"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div
            role="log"
            aria-label={botMessages.conversationRegionLabel}
            className="max-h-[50vh] min-h-48 min-w-0 space-y-5 overflow-y-auto rounded-2xl border border-edge bg-tray/40 p-3 sm:p-4"
          >
            {turns.map((turn) => (
              <div key={turn.id} className="min-w-0 space-y-4">
                <UserBubble text={turn.question} />
                <div className="flex min-w-0 items-start gap-2.5">
                  <BotAvatar size="sm" />
                  <div className="min-w-0 max-w-[92%] space-y-2 rounded-2xl rounded-tl-md border border-edge bg-card px-4 py-3 text-card-foreground shadow-panel">
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

                    <p className="text-sm whitespace-pre-line text-foreground wrap-anywhere">
                      {turn.reply.answer}
                    </p>

                    {turn.reply.citations.length > 0 && (
                      <div className="space-y-1.5 border-t border-edge/60 pt-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {botMessages.citationsLabel}
                        </p>
                        <ul className="space-y-1.5">
                          {turn.reply.citations.map((citation, index) => (
                            <li
                              key={`${turn.id}-${citation.materialId}-${index}`}
                              className="rounded-xl bg-tray/60 px-3 py-2 text-xs text-foreground wrap-anywhere"
                            >
                              <span className="font-semibold">
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
                </div>
              </div>
            ))}
            {pendingQuestion !== null && (
              <div className="min-w-0 space-y-4">
                <UserBubble text={pendingQuestion} />
                <div className="flex items-start gap-2.5">
                  <BotAvatar size="sm" />
                  <div
                    role="status"
                    className="rounded-2xl rounded-tl-md border border-edge bg-card px-4 py-3 text-sm text-muted-foreground shadow-panel motion-safe:animate-pulse"
                  >
                    {botMessages.thinking}
                  </div>
                </div>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        ))}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="space-y-1.5 rounded-2xl border border-edge bg-card p-2 shadow-panel"
      >
        <label htmlFor={composerId} className="sr-only">
          {botMessages.composerLabel}
        </label>
        <div className="flex min-w-0 items-end gap-2">
          <textarea
            id={composerId}
            rows={2}
            value={question}
            disabled={isUnavailable || effectiveIsSending}
            aria-invalid={fieldError !== null || undefined}
            aria-describedby={fieldError !== null ? fieldErrorId : undefined}
            placeholder={botMessages.composerPlaceholder}
            onChange={(event) => {
              setQuestion(event.target.value);
              if (fieldError !== null) setFieldError(null);
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="min-w-0 flex-1 resize-none rounded-xl bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <Button
            type="submit"
            disabled={isUnavailable}
            busy={effectiveIsSending}
            className="shrink-0"
          >
            {effectiveIsSending
              ? botMessages.sendingAction
              : botMessages.sendAction}
          </Button>
        </div>
        {fieldError !== null && (
          <p
            id={fieldErrorId}
            role="alert"
            className="px-3 text-xs text-destructive"
          >
            {fieldError}
          </p>
        )}
      </form>
    </div>
  );
}

function BotAvatar({ size = 'md' }: { readonly size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-inset ${
        size === 'sm' ? 'size-8' : 'size-11'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={size === 'sm' ? 'size-4' : 'size-6'}
        fill="currentColor"
      >
        <path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7L12 2zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
      </svg>
    </span>
  );
}

function UserBubble({ text }: { readonly text: string }) {
  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <p className="text-xs font-semibold text-muted-foreground">
        {botMessages.userAuthorLabel}
      </p>
      <p className="max-w-[88%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm whitespace-pre-line text-primary-foreground wrap-anywhere">
        {text}
      </p>
    </div>
  );
}
