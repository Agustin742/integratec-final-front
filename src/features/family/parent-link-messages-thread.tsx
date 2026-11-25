import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createParentLinkMessagesPredicate,
  familyLinksQueryKey,
  parentLinkMessagesQueryKey,
  staffFamilyThreadsQueryKey,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LiveRegion,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useZodForm,
} from '@/components/forms/form-primitives';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import {
  PARENT_LINK_MESSAGE_MAX_LENGTH,
  sendParentLinkMessageFormSchema,
  type ParentLinkMessageAuthorRole,
  type ParentLinkMessageDto,
  type SendParentLinkMessageFormInput,
  type SendParentLinkMessageFormOutput,
} from './family-schema';
import {
  isAbortError,
  isFamilyServiceError,
  isUncertainFamilyWriteError,
  listParentLinkMessages,
  sendParentLinkMessage,
} from './family-service';
import { familyMessages } from './messages';

export const PARENT_LINK_MESSAGES_PAGE_SIZE = 30;

export interface ParentLinkMessagesThreadProps {
  readonly userId: string;
  readonly linkId: string;
  readonly viewerRole: ParentLinkMessageAuthorRole;
  readonly headingLevel?: 'h2' | 'h3';
  readonly title?: string;
  readonly subtitle?: string;
  readonly hideHeader?: boolean;
}

function formatMessageInstant(iso: string): string {
  try {
    return formatInstant(iso);
  } catch {
    return iso;
  }
}

function MessageListItem({
  message,
  viewerRole,
}: {
  readonly message: ParentLinkMessageDto;
  readonly viewerRole: ParentLinkMessageAuthorRole;
}) {
  const isOwnRole = message.authorRole === viewerRole;

  return (
    <li className="min-w-0">
      <article
        className={cn(
          'min-w-0 rounded-2xl border p-3.5 text-card-foreground shadow-inset',
          isOwnRole
            ? 'border-primary/30 bg-primary/5'
            : 'border-edge bg-tray/70',
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold text-foreground wrap-anywhere">
              {message.authorDisplayName}
            </span>
            <Badge
              variant={message.authorRole === 'STAFF' ? 'info' : 'secondary'}
            >
              {familyMessages.messaging.roleBadges[message.authorRole]}
            </Badge>
          </div>
          <time
            dateTime={message.createdAt}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {formatMessageInstant(message.createdAt)}
          </time>
        </div>
        <p className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">
          {message.body}
        </p>
      </article>
    </li>
  );
}

/**
 * Reusable private Parent <-> Teacher messaging thread bound to one active
 * `ParentLink`. Scoped by `userId` and `linkId` so switching children, dialogs,
 * or accounts isolates cache and composer state cleanly.
 */
export function ParentLinkMessagesThread({
  userId,
  linkId,
  viewerRole,
  headingLevel = 'h3',
  title,
  subtitle,
  hideHeader = false,
}: ParentLinkMessagesThreadProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [terminalWriteError, setTerminalWriteError] = useState<
    'adult-mode' | 'not-found' | null
  >(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const isMountedRef = useRef(true);
  const sendAbortRef = useRef<AbortController | null>(null);
  const reconciledErrorRef = useRef<unknown>(null);
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly linkId: string;
  } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sendAbortRef.current?.abort();
    };
  }, []);

  const messagesQuery = useQuery({
    queryKey: parentLinkMessagesQueryKey(userId, linkId, {
      page,
      pageSize: PARENT_LINK_MESSAGES_PAGE_SIZE,
    }),
    queryFn: ({ signal }) =>
      listParentLinkMessages(
        client,
        linkId,
        { page, pageSize: PARENT_LINK_MESSAGES_PAGE_SIZE },
        { signal },
      ),
  });

  const queryDomainError = isFamilyServiceError(messagesQuery.error)
    ? messagesQuery.error
    : null;
  const isAdultModeError =
    terminalWriteError === 'adult-mode' ||
    (messagesQuery.isError && queryDomainError?.kind === 'adult-mode');
  const isNotFoundError =
    terminalWriteError === 'not-found' ||
    (messagesQuery.isError && queryDomainError?.kind === 'not-found');
  const isTerminalAccessError = isAdultModeError || isNotFoundError;

  useEffect(() => {
    if (!isTerminalAccessError) {
      reconciledErrorRef.current = null;
      terminalCleanupRef.current = null;
      return;
    }
    terminalCleanupRef.current = { userId, linkId };
    queryClient.removeQueries({
      predicate: createParentLinkMessagesPredicate(userId, linkId),
      type: 'inactive',
    });
    const errorToken = terminalWriteError ?? messagesQuery.error;
    if (reconciledErrorRef.current !== errorToken) {
      reconciledErrorRef.current = errorToken;
      if (viewerRole === 'PARENT') {
        void queryClient.invalidateQueries({
          queryKey: familyLinksQueryKey(userId),
          exact: true,
        });
      } else {
        void queryClient.invalidateQueries({
          queryKey: staffFamilyThreadsQueryKey(userId),
          exact: true,
        });
      }
    }
  }, [
    isTerminalAccessError,
    linkId,
    messagesQuery.error,
    queryClient,
    terminalWriteError,
    userId,
    viewerRole,
  ]);

  useEffect(() => {
    return () => {
      const cleanup = terminalCleanupRef.current;
      if (cleanup !== null) {
        queryClient.removeQueries({
          predicate: createParentLinkMessagesPredicate(
            cleanup.userId,
            cleanup.linkId,
          ),
        });
      }
    };
  }, [queryClient]);

  const form = useZodForm<
    SendParentLinkMessageFormInput,
    SendParentLinkMessageFormOutput
  >({
    schema: sendParentLinkMessageFormSchema,
    defaultValues: {
      body: '',
    },
  });

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      const controller = new AbortController();
      sendAbortRef.current?.abort();
      sendAbortRef.current = controller;

      try {
        await sendParentLinkMessage(
          client,
          linkId,
          { body: values.body },
          { signal: controller.signal },
        );
        if (!isMountedRef.current || controller.signal.aborted) {
          return;
        }

        form.reset({ body: '' });
        setLiveAnnouncement(familyMessages.messaging.composer.sentAnnouncement);

        const currentData = messagesQuery.data;
        if (
          currentData !== undefined &&
          currentData.total + 1 > page * PARENT_LINK_MESSAGES_PAGE_SIZE
        ) {
          setPage(
            Math.ceil((currentData.total + 1) / PARENT_LINK_MESSAGES_PAGE_SIZE),
          );
        }

        void queryClient.invalidateQueries({
          predicate: createParentLinkMessagesPredicate(userId, linkId),
        });
        if (viewerRole === 'STAFF') {
          void queryClient.invalidateQueries({
            queryKey: staffFamilyThreadsQueryKey(userId),
            exact: true,
          });
        }
      } catch (error) {
        if (
          isAbortError(error) ||
          controller.signal.aborted ||
          !isMountedRef.current
        ) {
          return;
        }

        if (isFamilyServiceError(error)) {
          if (error.kind === 'adult-mode') {
            setTerminalWriteError('adult-mode');
            return;
          }
          if (error.kind === 'not-found') {
            setTerminalWriteError('not-found');
            return;
          }
          if (error.kind === 'validation') {
            form.setError('body', {
              type: 'server',
              message: error.userMessage,
            });
            return;
          }
          form.setError('root.serverError', {
            type: 'server',
            message: error.userMessage,
          });
          if (isUncertainFamilyWriteError(error)) {
            void queryClient.invalidateQueries({
              predicate: createParentLinkMessagesPredicate(userId, linkId),
            });
            if (viewerRole === 'STAFF') {
              void queryClient.invalidateQueries({
                queryKey: staffFamilyThreadsQueryKey(userId),
                exact: true,
              });
            }
          }
          return;
        }

        form.setError('root.serverError', {
          type: 'server',
          message: familyMessages.messaging.errors.sendUnexpected,
        });
      } finally {
        if (sendAbortRef.current === controller) {
          sendAbortRef.current = null;
        }
      }
    },
    { knownFields: ['body'] },
  );

  const Heading = headingLevel;
  const subHeadingLevel = headingLevel === 'h2' ? 'h3' : 'h4';
  const resolvedTitle =
    title ??
    (viewerRole === 'PARENT'
      ? familyMessages.messaging.defaultTitle
      : familyMessages.messaging.staffTitle);
  const resolvedSubtitle =
    subtitle ??
    (viewerRole === 'PARENT'
      ? familyMessages.messaging.parentSubtitle
      : undefined);

  const data = messagesQuery.data;
  const isOutOfRangePage =
    data !== undefined && data.items.length === 0 && page > 1;
  const showComposer =
    !isTerminalAccessError && !messagesQuery.isPending && data !== undefined;

  return (
    <section
      className={cn(
        'min-w-0 space-y-4',
        !hideHeader &&
          'rounded-2xl border border-edge bg-card p-4 shadow-panel sm:p-5',
      )}
    >
      <LiveRegion message={liveAnnouncement} />

      {!hideHeader && (
        <header className="min-w-0 space-y-1">
          <Heading className="font-display text-lg font-semibold text-foreground wrap-anywhere">
            {resolvedTitle}
          </Heading>
          {resolvedSubtitle !== undefined && (
            <p className="text-sm text-pretty text-muted-foreground">
              {resolvedSubtitle}
            </p>
          )}
        </header>
      )}

      {messagesQuery.isPending && !isTerminalAccessError && (
        <LoadingState label={familyMessages.messaging.loading} />
      )}

      {isAdultModeError && (
        <Alert variant="warning" role="status">
          <AlertTitle as={subHeadingLevel}>
            {familyMessages.errors.adultModeTitle}
          </AlertTitle>
          <AlertDescription>
            {familyMessages.messaging.errors.sendAdultMode}
          </AlertDescription>
        </Alert>
      )}

      {!isAdultModeError && isNotFoundError && (
        <ErrorState
          headingLevel={subHeadingLevel}
          title={familyMessages.errors.notFoundTitle}
          description={familyMessages.messaging.errors.sendNotFound}
        />
      )}

      {!isTerminalAccessError &&
        messagesQuery.isError &&
        data === undefined && (
          <ErrorState
            headingLevel={subHeadingLevel}
            title={familyMessages.messaging.errors.loadTitle}
            description={
              queryDomainError?.userMessage ??
              familyMessages.messaging.errors.loadDescription
            }
            onRetry={() => void messagesQuery.refetch()}
            isRetrying={messagesQuery.isRefetching}
            retryLabel={familyMessages.errors.retryAction}
          />
        )}

      {!isTerminalAccessError &&
        messagesQuery.isError &&
        data !== undefined && (
          <StaleDataNotice
            headingLevel={subHeadingLevel}
            title={familyMessages.messaging.errors.staleTitle}
            description={familyMessages.messaging.errors.staleDescription}
            onRetry={() => void messagesQuery.refetch()}
            isRetrying={messagesQuery.isRefetching}
            retryLabel={familyMessages.errors.retryAction}
          />
        )}

      {!isTerminalAccessError && data !== undefined && (
        <div className="min-w-0 space-y-4">
          {data.items.length === 0 ? (
            <EmptyState
              headingLevel={subHeadingLevel}
              title={
                isOutOfRangePage
                  ? familyMessages.messaging.emptyPageTitle
                  : familyMessages.messaging.emptyTitle
              }
              description={
                isOutOfRangePage
                  ? familyMessages.messaging.emptyPageDescription
                  : viewerRole === 'PARENT'
                    ? familyMessages.messaging.emptyDescriptionParent
                    : familyMessages.messaging.emptyDescriptionStaff
              }
              action={
                isOutOfRangePage ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage(1)}
                    className="min-h-11"
                  >
                    {familyMessages.messaging.backToFirstPage}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="min-w-0 space-y-4">
              <ol
                aria-label={familyMessages.messaging.listLabel}
                className="min-w-0 space-y-3"
              >
                {data.items.map((message) => (
                  <MessageListItem
                    key={message.id}
                    message={message}
                    viewerRole={viewerRole}
                  />
                ))}
              </ol>

              {data.total > data.pageSize && (
                <PaginationControls
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  busy={messagesQuery.isFetching}
                  onPageChange={(nextPage) => setPage(nextPage)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {showComposer && (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="min-w-0 space-y-3 border-t border-edge/60 pt-4"
        >
          <FormRootError
            form={form}
            title={familyMessages.messaging.errors.sendTitle}
            headingLevel={subHeadingLevel}
          />

          <FormField
            control={form.control}
            name="body"
            label={familyMessages.messaging.composer.label}
            description={familyMessages.messaging.composer.description}
          >
            {({ id, name, value, onChange, onBlur, ref, ...controlProps }) => (
              <textarea
                {...controlProps}
                id={id}
                name={name}
                ref={ref}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                rows={3}
                maxLength={PARENT_LINK_MESSAGE_MAX_LENGTH}
                disabled={isSubmitting}
                placeholder={familyMessages.messaging.composer.placeholder}
                className="motion-field min-h-24 w-full min-w-0 resize-y rounded-xl border-2 border-field-border bg-card px-4 py-2.5 text-base text-card-foreground shadow-inset placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive"
              />
            )}
          </FormField>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="submit" busy={isSubmitting} className="min-h-11">
              {isSubmitting
                ? familyMessages.messaging.composer.submittingAction
                : familyMessages.messaging.composer.submitAction}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
