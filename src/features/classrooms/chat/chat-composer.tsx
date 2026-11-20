import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useWatch } from 'react-hook-form';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  chatMentionDirectoryQueryKey,
  classroomDetailQueryKey,
  createClassroomChatHistoryPredicate,
  createClassroomChatPredicate,
} from '@/api/query-keys';
import { LiveRegion } from '@/components/feedback/states';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import { classroomMessages as messages } from '../messages';
import {
  useClassroomContext,
  type ClassroomRole,
} from '../use-classroom-capabilities';
import { chatMessages } from './chat-messages';
import { useChatScroll } from './chat-scroll-context';
import {
  CHAT_MESSAGE_BODY_MAX_LENGTH,
  chatComposerSchema,
  type ChatComposerInput,
  type ChatDirectoryMemberDto,
  type PaginatedChatHistoryDto,
} from './chat-schema';
import {
  chatRetryAfterSeconds,
  isAbortError,
  isUncertainChatWriteError,
  listClassroomChatMembers,
  sendClassroomChatMessage,
} from './chat-service';

const MENTION_SUGGESTIONS_PAGE_SIZE = 20;
const MENTION_QUERY_DEBOUNCE_MS = 200;
/** Cooldown after a `429` whose `Retry-After` header is not exposed. */
const RATE_LIMIT_FALLBACK_COOLDOWN_SECONDS = 5;
const RATE_LIMIT_MAX_COOLDOWN_SECONDS = 60;
/** Tolerated difference between the browser clock and the server `createdAt`. */
const CLOCK_SKEW_TOLERANCE_MS = 5_000;

/**
 * The `@token` currently being typed at the caret: `tokenStart` points at the
 * `@`, `tokenEnd` at the caret, so a selection can replace the exact range.
 */
interface ActiveMentionToken {
  readonly query: string;
  readonly tokenStart: number;
  readonly tokenEnd: number;
}

function findActiveMentionToken(
  value: string,
  caret: number,
): ActiveMentionToken | null {
  const upToCaret = value.slice(0, caret);
  const match = /(?:^|\s)@([^\s@]+)$/.exec(upToCaret);
  if (match === null) {
    return null;
  }
  return {
    query: match[1],
    tokenStart: caret - match[1].length - 1,
    tokenEnd: caret,
  };
}

/** Case- and accent-insensitive form used to compare a name with a prefix. */
function foldForPrefixMatch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** A send whose outcome is unknown: what to look for in the history. */
interface UncertainSend {
  readonly body: string;
  readonly startedAt: number;
}

/**
 * Send side of the classroom chat (`HU-COM-002`, issue #51, S2/S6/S11).
 *
 * The composer rides the read panel's `composer` slot: it reuses the same
 * classroom context query the panel already consumes, so `chatMuted` and the
 * caller's role come from the server-confirmed context, never from a 403 body.
 *
 * Mentions stay server-authoritative: selecting a suggestion only inserts
 * `@DisplayName ` as plain text and only `body` is sent; the server resolves
 * or ignores it (`rules/communication-and-notifications.md`). The picker is a
 * listbox popup driven from the textarea: focus never leaves it.
 */
export function ChatComposer() {
  const { classroomId } = useParams();
  if (!classroomId) {
    return null;
  }
  return <ChatComposerHost classroomId={classroomId.trim()} />;
}

function ChatComposerHost({ classroomId }: { readonly classroomId: string }) {
  const context = useClassroomContext(classroomId);
  // The read panel gates this slot: without a server-confirmed classroom
  // context there is no authorized send context to render (S5 parents are
  // denied before the composer ever mounts).
  if (context.status !== 'ready') {
    return null;
  }
  return (
    <ChatComposerForm
      key={`${context.userId}:${classroomId}`}
      classroomId={classroomId}
      userId={context.userId}
      myRole={context.classroom.myRole}
      chatMuted={context.classroom.chatMuted}
      canListDirectory={context.classroom.capabilities.includes(
        'list_directory',
      )}
    />
  );
}

function ChatComposerForm({
  classroomId,
  userId,
  myRole,
  chatMuted,
  canListDirectory,
}: {
  readonly classroomId: string;
  readonly userId: string;
  readonly myRole: ClassroomRole;
  readonly chatMuted: boolean;
  readonly canListDirectory: boolean;
}) {
  const chat = messages.chat;
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const listboxId = useId();
  const mutedTextareaId = useId();
  const mutedDescriptionId = useId();
  const { scrollToLatest } = useChatScroll();

  const form = useZodForm<ChatComposerInput, { body: string }>({
    schema: chatComposerSchema,
    defaultValues: { body: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const bodyValue = useWatch({ control: form.control, name: 'body' });
  const [activeMention, setActiveMention] = useState<ActiveMentionToken | null>(
    null,
  );
  const [debouncedMentionQuery, setDebouncedMentionQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState('');
  const [uncertainSend, setUncertainSend] = useState<UncertainSend | null>(
    null,
  );
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      if (cooldownTimerRef.current !== null) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  // The muted state is server-owned context (`chatMuted` on the classroom
  // detail): while muted, only students lose the send path (S11). The
  // disabled control is never the enforcement; a send that still reaches the
  // server is rejected and that outcome is presented below.
  const isMutedForMe = chatMuted && myRole === 'STUDENT';
  const hasMentionPicker = canListDirectory && !isMutedForMe;

  const rawMentionQuery = activeMention?.query ?? null;

  // The lookup follows the typing with a short pause: one request per burst
  // of keystrokes instead of one per character.
  useEffect(() => {
    if (rawMentionQuery === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setDebouncedMentionQuery(rawMentionQuery);
    }, MENTION_QUERY_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [rawMentionQuery]);

  const mentionParams = useMemo(
    () => ({
      q: debouncedMentionQuery,
      page: 1,
      pageSize: MENTION_SUGGESTIONS_PAGE_SIZE,
    }),
    [debouncedMentionQuery],
  );

  // Suggestion source is the backend member directory with the `q`
  // case-insensitive display-name prefix filter (backend decision D12):
  // classroom roster only, and only the fields the server returns. Its key
  // lives outside the `chat` domain, so chat reconciliation never refetches it.
  const mentionQuery = useQuery({
    queryKey: chatMentionDirectoryQueryKey(userId, classroomId, mentionParams),
    queryFn: ({ signal }) =>
      listClassroomChatMembers(client, classroomId, mentionParams, { signal }),
    enabled:
      activeMention !== null &&
      debouncedMentionQuery !== '' &&
      hasMentionPicker,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
    retry: false,
  });

  // While the debounce is pending the previous answer is still on screen:
  // keep only the entries that match what is typed right now, so a stale list
  // can never insert someone the current prefix does not name.
  const suggestions = useMemo<readonly ChatDirectoryMemberDto[]>(() => {
    if (rawMentionQuery === null) {
      return [];
    }
    const prefix = foldForPrefixMatch(rawMentionQuery);
    return (mentionQuery.data?.items ?? []).filter((member) =>
      foldForPrefixMatch(member.displayName).startsWith(prefix),
    );
  }, [mentionQuery.data, rawMentionQuery]);
  const isMentionOpen = hasMentionPicker && suggestions.length > 0;
  const activeIndex =
    isMentionOpen && highlightedIndex < suggestions.length
      ? highlightedIndex
      : -1;
  const optionId = (index: number) => `${listboxId}-option-${String(index)}`;

  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    document
      .getElementById(`${listboxId}-option-${String(activeIndex)}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, listboxId]);

  // A mention insertion re-renders the controlled textarea asynchronously;
  // restore the caret right after the new value is committed.
  useEffect(() => {
    if (pendingCaretRef.current !== null && textareaRef.current !== null) {
      const caret = pendingCaretRef.current;
      pendingCaretRef.current = null;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(caret, caret);
    }
  });

  const updateActiveMention = useCallback((next: ActiveMentionToken | null) => {
    setActiveMention(next);
    setHighlightedIndex(-1);
    if (next === null) {
      setDebouncedMentionQuery('');
    }
  }, []);

  const insertMention = useCallback(
    (displayName: string) => {
      if (activeMention === null) {
        return;
      }
      const inserted = `@${displayName} `;
      const nextBody =
        bodyValue.slice(0, activeMention.tokenStart) +
        inserted +
        bodyValue.slice(activeMention.tokenEnd);
      form.setValue('body', nextBody, {
        shouldDirty: true,
        shouldValidate: true,
      });
      pendingCaretRef.current = activeMention.tokenStart + inserted.length;
      updateActiveMention(null);
    },
    [activeMention, bodyValue, form, updateActiveMention],
  );

  const reconcileChat = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: createClassroomChatPredicate(userId, classroomId),
    });
  }, [classroomId, queryClient, userId]);

  // The send has no idempotency key, so an uncertain write is only ever
  // resolved by looking: is the message already in the newest loaded history
  // (REST refetch or live delivery) as the current user's, created since the
  // send began (small tolerance for clock skew)?
  const wasDelivered = useCallback(
    ({ body, startedAt }: UncertainSend): boolean => {
      const trimmed = body.trim();
      const entries = queryClient.getQueriesData<
        InfiniteData<PaginatedChatHistoryDto, number>
      >({
        predicate: createClassroomChatHistoryPredicate(userId, classroomId),
      });
      return entries.some(([, data]) =>
        (data?.pages[0]?.items ?? []).some(
          (message) =>
            message.authorId === userId &&
            message.body.trim() === trimmed &&
            Date.parse(message.createdAt) >=
              startedAt - CLOCK_SKEW_TOLERANCE_MS,
        ),
      );
    },
    [classroomId, queryClient, userId],
  );

  const completeSend = useCallback(() => {
    form.reset({ body: '' });
    updateActiveMention(null);
    // One confirmation channel (the live region, no toast), then follow
    // the conversation and keep typing without reaching for the mouse.
    setAnnouncement(chat.composer.sentToast);
    scrollToLatest();
    textareaRef.current?.focus();
  }, [chat.composer.sentToast, form, scrollToLatest, updateActiveMention]);

  // The uncertain message can still arrive (live delivery, a later refetch):
  // once it does, the draft is the sent message and must not be sent again.
  useEffect(() => {
    if (uncertainSend === null) {
      return undefined;
    }
    return queryClient.getQueryCache().subscribe(() => {
      if (!wasDelivered(uncertainSend)) {
        return;
      }
      setUncertainSend(null);
      form.clearErrors('root.serverError');
      if (form.getValues('body').trim() === uncertainSend.body.trim()) {
        completeSend();
      }
    });
  }, [completeSend, form, queryClient, uncertainSend, wasDelivered]);

  const startCooldown = useCallback((seconds: number) => {
    if (cooldownTimerRef.current !== null) {
      clearTimeout(cooldownTimerRef.current);
    }
    const bounded = Math.min(
      Math.max(seconds, 1),
      RATE_LIMIT_MAX_COOLDOWN_SECONDS,
    );
    setIsCoolingDown(true);
    cooldownTimerRef.current = setTimeout(() => {
      cooldownTimerRef.current = null;
      if (isMountedRef.current) {
        setIsCoolingDown(false);
      }
    }, bounded * 1000);
  }, []);

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setUncertainSend(null);
      const startedAt = Date.now();

      try {
        await sendClassroomChatMessage(client, classroomId, values.body, {
          signal: controller.signal,
        });
        if (!isMountedRef.current) {
          return;
        }
        // Confirmed by the server: only now does the draft clear, and the
        // message becomes visible by reconciling the history query (S6/S9).
        completeSend();
        reconcileChat();
      } catch (error) {
        if (isAbortError(error) || !isMountedRef.current) {
          return;
        }
        if (isUncertainChatWriteError(error)) {
          // Transport-uncertain: never retry blindly. Reconcile against the
          // server while send stays disabled (this handler is still pending),
          // then decide from what the history shows.
          await queryClient.invalidateQueries({
            predicate: createClassroomChatPredicate(userId, classroomId),
          });
          if (!isMountedRef.current) {
            return;
          }
          const pending: UncertainSend = { body: values.body, startedAt };
          if (wasDelivered(pending)) {
            completeSend();
            return;
          }
          setUncertainSend(pending);
          form.setError('root.serverError', {
            type: 'server',
            message: chatMessages.errors.uncertain,
          });
          return;
        }
        if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          // A rejected send is presented, and the classroom context is
          // reconciled: the 403 body cannot explain why (parent vs muted
          // student), so the muted explanation must come from `chatMuted` on
          // the revalidated context (S11), never from the 403 body.
          void queryClient.invalidateQueries({
            queryKey: classroomDetailQueryKey(userId, classroomId),
            exact: true,
          });
          reconcileChat();
        }
        if (error instanceof ApiError && error.kind === 'rate-limited') {
          startCooldown(
            chatRetryAfterSeconds(error) ??
              RATE_LIMIT_FALLBACK_COOLDOWN_SECONDS,
          );
        }
        // Definite rejections (400/401/403/404/429) keep the draft and map
        // onto the form via `useProtectedSubmit`.
        throw error;
      }
    },
    { knownFields: ['body'] },
  );

  if (isMutedForMe) {
    return (
      <div className="space-y-2">
        <Alert role="status">
          <AlertTitle as="h4">{chat.composer.mutedTitle}</AlertTitle>
          <AlertDescription id={mutedDescriptionId}>
            {chat.composer.mutedDescription}
          </AlertDescription>
        </Alert>
        <label
          htmlFor={mutedTextareaId}
          className="block text-xs font-medium text-muted-foreground"
        >
          {chat.composer.bodyLabel}
        </label>
        <textarea
          id={mutedTextareaId}
          rows={3}
          disabled
          value={bodyValue}
          readOnly
          aria-describedby={mutedDescriptionId}
          className="w-full cursor-not-allowed rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground opacity-50 shadow-xs"
        />
      </div>
    );
  }

  const sendBlocked = isSubmitting || isCoolingDown;

  return (
    <form
      onSubmit={(event) => {
        if (isCoolingDown) {
          event.preventDefault();
          return;
        }
        void handleSubmit(event);
      }}
      noValidate
      aria-label={chat.composer.regionLabel}
      className="space-y-3"
    >
      <LiveRegion message={announcement} visuallyHidden />

      <h4 className="sr-only">{chat.composer.heading}</h4>

      {uncertainSend !== null ? (
        <Alert role="status">
          <AlertDescription>{chatMessages.errors.uncertain}</AlertDescription>
        </Alert>
      ) : (
        <FormRootError form={form} headingLevel="h5" />
      )}

      <FormField
        control={form.control}
        name="body"
        label={chat.composer.bodyLabel}
        description={chat.composer.charCounter(
          bodyValue.trim().length,
          CHAT_MESSAGE_BODY_MAX_LENGTH,
        )}
      >
        {(field) => {
          const selectSuggestion = (index: number): void => {
            const member = suggestions[index];
            if (member !== undefined) {
              insertMention(member.displayName);
            }
          };

          const handleKeyDown = (
            event: KeyboardEvent<HTMLTextAreaElement>,
          ): void => {
            if (!isMentionOpen) {
              // Enter sends, Shift+Enter keeps the native newline. Enter that
              // confirms an IME composition must never send.
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (!sendBlocked) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
              return;
            }
            // Combobox keys: the textarea keeps focus and only the
            // highlighted option (aria-activedescendant) moves.
            const count = suggestions.length;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlightedIndex((activeIndex + 1) % count);
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlightedIndex(
                activeIndex <= 0 ? count - 1 : activeIndex - 1,
              );
              return;
            }
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              // While the list is open Enter picks, it never sends.
              event.preventDefault();
              selectSuggestion(activeIndex >= 0 ? activeIndex : 0);
              return;
            }
            if (event.key === 'Tab' && !event.shiftKey && activeIndex >= 0) {
              event.preventDefault();
              selectSuggestion(activeIndex);
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              updateActiveMention(null);
            }
          };

          return (
            <div className="space-y-2">
              <textarea
                {...field}
                rows={2}
                maxLength={CHAT_MESSAGE_BODY_MAX_LENGTH}
                placeholder={chat.composer.bodyPlaceholder}
                // Read-only (not disabled) while sending: a disabled control
                // drops focus, and the author keeps typing the next message.
                readOnly={isSubmitting}
                aria-busy={isSubmitting}
                // Stays a native textbox (`combobox` is not allowed on a
                // textarea): only textbox-valid attributes link the popup.
                {...(hasMentionPicker
                  ? {
                      'aria-autocomplete': 'list' as const,
                      'aria-controls': isMentionOpen ? listboxId : undefined,
                      'aria-activedescendant':
                        activeIndex >= 0 ? optionId(activeIndex) : undefined,
                    }
                  : {})}
                ref={(element) => {
                  field.ref(element);
                  textareaRef.current = element;
                }}
                onChange={(event) => {
                  field.onChange(event);
                  const target = event.currentTarget;
                  updateActiveMention(
                    hasMentionPicker
                      ? findActiveMentionToken(
                          target.value,
                          target.selectionStart ?? target.value.length,
                        )
                      : null,
                  );
                }}
                onKeyDown={handleKeyDown}
                className={cn(
                  'w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isSubmitting && 'opacity-70',
                  field['aria-invalid'] && 'border-destructive',
                )}
              />

              {isMentionOpen ? (
                <ul
                  id={listboxId}
                  role="listbox"
                  aria-label={chat.composer.mentionListboxLabel}
                  className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-edge bg-card p-2 shadow-xs"
                >
                  {suggestions.map((member, index) => (
                    <li
                      key={member.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === activeIndex}
                      tabIndex={-1}
                      // Mouse selection must not pull focus out of the
                      // textarea: the default of `mousedown` is what blurs it.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        insertMention(member.displayName);
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground',
                        index === activeIndex && 'bg-accent',
                      )}
                    >
                      <span>{member.displayName}</span>
                      {member.role === 'TEACHER' ? (
                        <Badge variant="outline">{chat.roleTeacherBadge}</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="text-xs text-muted-foreground">
                {chat.composer.sendHint}
              </p>

              {/* Screen-reader notice: suggestions exist and are reachable. */}
              <LiveRegion
                message={
                  isMentionOpen ? chat.composer.mentionAvailableNotice : ''
                }
                visuallyHidden
              />
            </div>
          );
        }}
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" className="min-h-11" disabled={sendBlocked}>
          {isSubmitting ? chat.composer.submitting : chat.composer.submit}
        </Button>
      </div>
    </form>
  );
}
