import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWatch } from 'react-hook-form';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomDetailQueryKey,
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
import { chatMentionDirectoryQueryKey } from '@/api/query-keys';
import {
  CHAT_MESSAGE_BODY_MAX_LENGTH,
  chatComposerSchema,
  type ChatComposerInput,
  type ChatDirectoryMemberDto,
} from './chat-schema';
import {
  isAbortError,
  isUncertainChatWriteError,
  listClassroomChatMembers,
  sendClassroomChatMessage,
} from './chat-service';

const MENTION_SUGGESTIONS_PAGE_SIZE = 20;

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

/**
 * Send side of the classroom chat (`HU-COM-002`, issue #51, S2/S6/S11).
 *
 * The composer rides the read panel's `composer` slot: it reuses the same
 * classroom context query the panel already consumes, so `chatMuted` and the
 * caller's role come from the server-confirmed context, never from a 403 body.
 *
 * Mentions stay server-authoritative: selecting a suggestion only inserts
 * `@DisplayName ` as plain text and only `body` is sent; the server resolves
 * or ignores it (`rules/communication-and-notifications.md`).
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
  const [announcement, setAnnouncement] = useState('');
  const [uncertainNotice, setUncertainNotice] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pendingCaretRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // The muted state is server-owned context (`chatMuted` on the classroom
  // detail): while muted, only students lose the send path (S11). The
  // disabled control is never the enforcement; a send that still reaches the
  // server is rejected and that outcome is presented below.
  const isMutedForMe = chatMuted && myRole === 'STUDENT';

  const mentionParams = useMemo(
    () => ({
      q: activeMention?.query ?? '',
      page: 1,
      pageSize: MENTION_SUGGESTIONS_PAGE_SIZE,
    }),
    [activeMention?.query],
  );

  // Suggestion source is the backend member directory with the `q`
  // case-insensitive display-name prefix filter (backend decision D12):
  // classroom roster only, and only the fields the server returns.
  const mentionQuery = useQuery({
    queryKey: chatMentionDirectoryQueryKey(userId, classroomId, mentionParams),
    queryFn: ({ signal }) =>
      listClassroomChatMembers(client, classroomId, mentionParams, { signal }),
    enabled: activeMention !== null && canListDirectory && !isMutedForMe,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
    retry: false,
  });

  const suggestions: readonly ChatDirectoryMemberDto[] =
    mentionQuery.data?.items ?? [];
  const isMentionOpen = activeMention !== null && suggestions.length > 0;

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
      setActiveMention(null);
    },
    [activeMention, bodyValue, form],
  );

  const reconcileChat = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: createClassroomChatPredicate(userId, classroomId),
    });
  }, [classroomId, queryClient, userId]);

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setUncertainNotice(false);

      try {
        await sendClassroomChatMessage(client, classroomId, values.body, {
          signal: controller.signal,
        });
        if (!isMountedRef.current) {
          return;
        }
        // Confirmed by the server: only now does the draft clear, and the
        // message becomes visible by reconciling the history query (S6/S9).
        form.reset({ body: '' });
        setActiveMention(null);
        // One confirmation channel (the live region, no toast), then follow
        // the conversation and keep typing without reaching for the mouse.
        setAnnouncement(chat.composer.sentToast);
        scrollToLatest();
        textareaRef.current?.focus();
        reconcileChat();
      } catch (error) {
        if (isAbortError(error) || !isMountedRef.current) {
          return;
        }
        if (isUncertainChatWriteError(error)) {
          // Transport-uncertain: never retry blindly. Keep the draft,
          // reconcile against the server and report the uncertainty.
          setUncertainNotice(true);
          await queryClient.invalidateQueries({
            predicate: createClassroomChatPredicate(userId, classroomId),
          });
          if (!isMountedRef.current) {
            return;
          }
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
          <AlertDescription>{chat.composer.mutedDescription}</AlertDescription>
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
          className="w-full cursor-not-allowed rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground opacity-50 shadow-xs"
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      noValidate
      aria-label={chat.composer.regionLabel}
      className="space-y-3"
    >
      <LiveRegion message={announcement} visuallyHidden />

      <h4 className="sr-only">{chat.composer.heading}</h4>

      {uncertainNotice ? (
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
                if (!isSubmitting) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              optionRefs.current[0]?.focus();
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setActiveMention(null);
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
                ref={(element) => {
                  field.ref(element);
                  textareaRef.current = element;
                }}
                onChange={(event) => {
                  field.onChange(event);
                  const target = event.currentTarget;
                  setActiveMention(
                    findActiveMentionToken(
                      target.value,
                      target.selectionStart ?? target.value.length,
                    ),
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
                  aria-label={chat.composer.mentionListboxLabel}
                  className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-edge bg-card p-2 shadow-xs"
                >
                  {suggestions.map((member, index) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        ref={(element) => {
                          optionRefs.current[index] = element;
                        }}
                        onClick={() => {
                          insertMention(member.displayName);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            insertMention(member.displayName);
                            return;
                          }
                          if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            optionRefs.current[index + 1]?.focus();
                            return;
                          }
                          if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            if (index === 0) {
                              textareaRef.current?.focus();
                            } else {
                              optionRefs.current[index - 1]?.focus();
                            }
                            return;
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setActiveMention(null);
                            textareaRef.current?.focus();
                          }
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span>{member.displayName}</span>
                        {member.role === 'TEACHER' ? (
                          <Badge variant="outline">
                            {chat.roleTeacherBadge}
                          </Badge>
                        ) : null}
                      </button>
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
        <Button type="submit" className="min-h-11" disabled={isSubmitting}>
          {isSubmitting ? chat.composer.submitting : chat.composer.submit}
        </Button>
      </div>
    </form>
  );
}
