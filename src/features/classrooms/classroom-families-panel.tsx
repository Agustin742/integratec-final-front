import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomDetailQueryKey,
  classroomParentLinksQueryKey,
  createClassroomParentLinksPredicate,
  createClassroomRosterPredicate,
  staffFamilyThreadsQueryKey,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LiveRegion,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { ParentLinkMessagesThread } from '@/features/family/parent-link-messages-thread';
import { formatInstant } from '@/lib/dates';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type { ClassroomParentLinkDto } from './invitation-schema';
import {
  isAbortError,
  isUncertainWriteError,
  listClassroomParentLinks,
  removeClassroomParentLink,
} from './invitation-service';
import { classroomMessages } from './messages';
import { useClassroomContext } from './use-classroom-capabilities';

function formatTimestamp(isoInstant: string): string {
  try {
    return formatInstant(isoInstant);
  } catch {
    return isoInstant;
  }
}

function isForbiddenApiError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === 'forbidden' || error.status === 403)
  );
}

function isNotFoundApiError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === 'not-found' || error.status === 404)
  );
}

export interface ClassroomFamiliesPanelProps {
  readonly classroomId?: string;
}

/**
 * Staff-only classroom families tab (`Familias`) mounted inside the `members`
 * workspace panel when the server grants `invite_members`. Lists active
 * guardian links, lets staff open private parent-teacher messaging dialogs
 * (when not in `adultMode`), and supports inline unlink confirmation with
 * focus restoration.
 */
export function ClassroomFamiliesPanel({
  classroomId: propClassroomId,
}: ClassroomFamiliesPanelProps = {}) {
  const params = useParams<{ classroomId: string }>();
  const resolvedClassroomId = propClassroomId ?? params.classroomId ?? '';
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const context = useClassroomContext(resolvedClassroomId);
  const messages = classroomMessages.invitations;

  if (resolvedClassroomId.trim() === '' || userId === null) {
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.forbiddenTitle}
        description={messages.forbiddenDescription}
      />
    );
  }

  if (context.status === 'pending') {
    return (
      <LoadingState label={messages.parentLinks.loading} skeletonLines={3} />
    );
  }

  if (context.status === 'error') {
    if (isNotFoundApiError(context.error)) {
      return (
        <ErrorState
          headingLevel="h3"
          title={messages.notFoundTitle}
          description={messages.notFoundDescription}
        />
      );
    }
    if (isForbiddenApiError(context.error)) {
      return (
        <ErrorState
          headingLevel="h3"
          title={messages.forbiddenTitle}
          description={messages.forbiddenDescription}
        />
      );
    }
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.errorTitle}
        description={messages.errorDescription}
      />
    );
  }

  if (!context.classroom.capabilities.includes('invite_members')) {
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.forbiddenTitle}
        description={messages.forbiddenDescription}
      />
    );
  }

  return (
    <ClassroomFamiliesContent
      key={`${userId}:${resolvedClassroomId}`}
      userId={userId}
      classroomId={resolvedClassroomId}
      adultMode={context.classroom.adultMode}
    />
  );
}

interface ClassroomFamiliesContentProps {
  readonly userId: string;
  readonly classroomId: string;
  readonly adultMode: boolean;
}

function ClassroomFamiliesContent({
  userId,
  classroomId,
  adultMode,
}: ClassroomFamiliesContentProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const messages = classroomMessages.invitations;

  const parentLinksHeadingId = useId();

  const [confirmUnlinkTarget, setConfirmUnlinkTarget] =
    useState<ClassroomParentLinkDto | null>(null);
  const [activeMessageLink, setActiveMessageLink] =
    useState<ClassroomParentLinkDto | null>(null);
  const [isUnlinkingParentLink, setIsUnlinkingParentLink] = useState(false);
  const [unlinkParentLinkError, setUnlinkParentLinkError] = useState<
    string | null
  >(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const isMountedRef = useRef(true);
  const isUnlinkingParentLinkRef = useRef(false);
  const unlinkParentAbortRef = useRef<AbortController | null>(null);
  const reconciledContextErrorRef = useRef<unknown>(null);

  const parentLinksHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmUnlinkHeadingRef = useRef<HTMLHeadingElement>(null);
  const unlinkButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const restoreUnlinkTriggerIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      unlinkParentAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (confirmUnlinkTarget !== null) {
      confirmUnlinkHeadingRef.current?.focus();
      return;
    }
    const triggerId = restoreUnlinkTriggerIdRef.current;
    if (triggerId !== null) {
      restoreUnlinkTriggerIdRef.current = null;
      unlinkButtonRefs.current.get(triggerId)?.focus();
    }
  }, [confirmUnlinkTarget]);

  const parentLinksQuery = useQuery({
    queryKey: classroomParentLinksQueryKey(userId, classroomId),
    queryFn: ({ signal }) =>
      listClassroomParentLinks(client, classroomId, { signal }),
    staleTime: 0,
  });

  useEffect(() => {
    if (!parentLinksQuery.isError) {
      return;
    }
    if (
      isNotFoundApiError(parentLinksQuery.error) &&
      reconciledContextErrorRef.current !== parentLinksQuery.error
    ) {
      reconciledContextErrorRef.current = parentLinksQuery.error;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }
  }, [
    classroomId,
    parentLinksQuery.error,
    parentLinksQuery.isError,
    queryClient,
    userId,
  ]);

  const setUnlinkButtonRef =
    (linkId: string) =>
    (node: HTMLButtonElement | null): void => {
      if (node) {
        unlinkButtonRefs.current.set(linkId, node);
      } else {
        unlinkButtonRefs.current.delete(linkId);
      }
    };

  const handleOpenUnlinkConfirmation = (link: ClassroomParentLinkDto): void => {
    if (isUnlinkingParentLinkRef.current) {
      return;
    }
    restoreUnlinkTriggerIdRef.current = null;
    setUnlinkParentLinkError(null);
    setConfirmUnlinkTarget(link);
  };

  const handleCancelUnlinkConfirmation = (): void => {
    if (isUnlinkingParentLinkRef.current || confirmUnlinkTarget === null) {
      return;
    }
    restoreUnlinkTriggerIdRef.current = confirmUnlinkTarget.id;
    setConfirmUnlinkTarget(null);
    setUnlinkParentLinkError(null);
  };

  const handleConfirmUnlinkParentLink = async (): Promise<void> => {
    if (isUnlinkingParentLinkRef.current || confirmUnlinkTarget === null) {
      return;
    }

    const target = confirmUnlinkTarget;
    isUnlinkingParentLinkRef.current = true;
    setIsUnlinkingParentLink(true);
    setUnlinkParentLinkError(null);

    const controller = new AbortController();
    unlinkParentAbortRef.current?.abort();
    unlinkParentAbortRef.current = controller;

    try {
      await removeClassroomParentLink(client, classroomId, target.id, {
        signal: controller.signal,
      });
      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }

      restoreUnlinkTriggerIdRef.current = null;
      setConfirmUnlinkTarget(null);
      setActiveMessageLink((current) =>
        current?.id === target.id ? null : current,
      );
      setUnlinkParentLinkError(null);
      const description = messages.parentLinks.unlinkedDescription(
        target.parentDisplayName,
        target.childDisplayName,
      );
      setLiveAnnouncement(
        `${messages.parentLinks.unlinkedTitle}: ${description}`,
      );
      toast.success(messages.parentLinks.unlinkedTitle, { description });
      void queryClient.invalidateQueries({
        predicate: createClassroomParentLinksPredicate(userId, classroomId),
      });
      void queryClient.invalidateQueries({
        predicate: createClassroomRosterPredicate(userId, classroomId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffFamilyThreadsQueryKey(userId),
        exact: true,
      });
      parentLinksHeadingRef.current?.focus();
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        !isMountedRef.current
      ) {
        return;
      }

      const errorMessage =
        error instanceof ApiError
          ? error.userMessage
          : messages.parentLinks.unlinkUnexpected;
      setUnlinkParentLinkError(errorMessage);

      if (isNotFoundApiError(error)) {
        void queryClient.invalidateQueries({
          predicate: createClassroomParentLinksPredicate(userId, classroomId),
        });
        void queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
          exact: true,
        });
        void queryClient.invalidateQueries({
          queryKey: staffFamilyThreadsQueryKey(userId),
          exact: true,
        });
      } else if (isForbiddenApiError(error) || isUncertainWriteError(error)) {
        void queryClient.invalidateQueries({
          predicate: createClassroomParentLinksPredicate(userId, classroomId),
        });
      }
    } finally {
      if (unlinkParentAbortRef.current === controller) {
        unlinkParentAbortRef.current = null;
      }
      isUnlinkingParentLinkRef.current = false;
      if (isMountedRef.current) {
        setIsUnlinkingParentLink(false);
      }
    }
  };

  const isParentLinksForbidden =
    parentLinksQuery.isError && isForbiddenApiError(parentLinksQuery.error);
  const isParentLinksNotFound =
    parentLinksQuery.isError && isNotFoundApiError(parentLinksQuery.error);
  const isParentLinksRevoked = isParentLinksForbidden || isParentLinksNotFound;
  const parentLinksData = isParentLinksRevoked
    ? undefined
    : parentLinksQuery.data;
  const activeParentLinks =
    parentLinksData?.items.filter((link) => link.state === 'ACTIVE') ?? [];

  return (
    <div className="min-w-0 space-y-6 pt-2">
      <LiveRegion message={liveAnnouncement} visuallyHidden />

      <section
        aria-labelledby={parentLinksHeadingId}
        className="min-w-0 space-y-4"
      >
        <div className="min-w-0 space-y-1.5">
          <h3
            id={parentLinksHeadingId}
            ref={parentLinksHeadingRef}
            tabIndex={-1}
            className="font-display text-lg font-semibold text-foreground outline-none"
          >
            {messages.parentLinks.heading}
          </h3>
          <p className="text-sm text-pretty text-muted-foreground">
            {messages.parentLinks.description}
          </p>
        </div>

        {adultMode && (
          <Alert variant="warning" role="status">
            <AlertTitle as="h4">
              {messages.parentLinks.adultModeTitle}
            </AlertTitle>
            <AlertDescription>
              {messages.parentLinks.adultModeNote}
            </AlertDescription>
          </Alert>
        )}

        {parentLinksQuery.isPending && parentLinksData === undefined && (
          <LoadingState
            label={messages.parentLinks.loading}
            skeletonLines={3}
          />
        )}

        {isParentLinksForbidden && (
          <ErrorState
            headingLevel="h4"
            title={messages.forbiddenTitle}
            description={messages.forbiddenDescription}
          />
        )}

        {isParentLinksNotFound && (
          <ErrorState
            headingLevel="h4"
            title={messages.notFoundTitle}
            description={messages.notFoundDescription}
          />
        )}

        {parentLinksQuery.isError &&
          !isParentLinksRevoked &&
          parentLinksData === undefined && (
            <ErrorState
              headingLevel="h4"
              title={messages.parentLinks.errorTitle}
              description={messages.parentLinks.errorDescription}
              onRetry={() => void parentLinksQuery.refetch()}
              isRetrying={parentLinksQuery.isRefetching}
            />
          )}

        {parentLinksQuery.isError &&
          !isParentLinksRevoked &&
          parentLinksData !== undefined && (
            <StaleDataNotice
              headingLevel="h4"
              title={messages.parentLinks.staleTitle}
              description={messages.parentLinks.staleDescription}
              onRetry={() => void parentLinksQuery.refetch()}
              isRetrying={parentLinksQuery.isRefetching}
            />
          )}

        {!adultMode &&
          parentLinksData !== undefined &&
          activeParentLinks.length === 0 && (
            <EmptyState
              headingLevel="h4"
              title={messages.parentLinks.emptyTitle}
              description={messages.parentLinks.emptyDescription}
            />
          )}

        {parentLinksData !== undefined && activeParentLinks.length > 0 && (
          <ul
            className="min-w-0 space-y-3"
            aria-label={messages.parentLinks.heading}
          >
            {activeParentLinks.map((link) => {
              const isConfirmingThis = confirmUnlinkTarget?.id === link.id;
              const confirmHeadingId = `${parentLinksHeadingId}-confirm-${link.id}`;
              const confirmDescId = `${parentLinksHeadingId}-desc-${link.id}`;

              return (
                <li
                  key={link.id}
                  className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-semibold text-foreground wrap-anywhere">
                          {link.parentDisplayName}
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-sm text-muted-foreground"
                        >
                          →
                        </span>
                        <span className="text-sm font-medium text-foreground wrap-anywhere">
                          {link.childDisplayName}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {messages.parentLinks.linkedToLabel(
                            link.childDisplayName,
                          )}
                        </span>
                        <span>
                          {messages.parentLinks.createdAtLabel(
                            formatTimestamp(link.createdAt),
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {!adultMode && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={messages.parentLinks.messagesAriaLabel(
                            link.parentDisplayName,
                            link.childDisplayName,
                          )}
                          disabled={isUnlinkingParentLink}
                          onClick={() => setActiveMessageLink(link)}
                          className="min-h-11 shrink-0"
                        >
                          {messages.parentLinks.messagesAction}
                        </Button>
                      )}
                      <Button
                        ref={setUnlinkButtonRef(link.id)}
                        type="button"
                        variant="destructive"
                        size="sm"
                        aria-label={messages.parentLinks.unlinkAriaLabel(
                          link.parentDisplayName,
                          link.childDisplayName,
                        )}
                        aria-expanded={isConfirmingThis}
                        disabled={isUnlinkingParentLink || isConfirmingThis}
                        onClick={() => handleOpenUnlinkConfirmation(link)}
                        className="min-h-11 shrink-0"
                      >
                        {messages.parentLinks.unlinkAction}
                      </Button>
                    </div>
                  </div>

                  {isConfirmingThis && (
                    <section
                      aria-labelledby={confirmHeadingId}
                      aria-describedby={confirmDescId}
                      className="min-w-0 space-y-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3.5"
                    >
                      <h4
                        id={confirmHeadingId}
                        ref={confirmUnlinkHeadingRef}
                        tabIndex={-1}
                        className="font-display text-base font-semibold text-foreground outline-none wrap-anywhere"
                      >
                        {messages.parentLinks.confirmUnlinkTitle(
                          link.parentDisplayName,
                          link.childDisplayName,
                        )}
                      </h4>
                      <p
                        id={confirmDescId}
                        className="text-sm text-pretty text-muted-foreground"
                      >
                        {messages.parentLinks.confirmUnlinkDescription}
                      </p>

                      {unlinkParentLinkError !== null && (
                        <Alert variant="destructive" role="alert">
                          <AlertTitle>
                            {messages.parentLinks.unlinkErrorTitle}
                          </AlertTitle>
                          <AlertDescription>
                            {unlinkParentLinkError}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUnlinkingParentLink}
                          onClick={handleCancelUnlinkConfirmation}
                          className="min-h-11"
                        >
                          {messages.parentLinks.confirmUnlinkCancel}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          busy={isUnlinkingParentLink}
                          onClick={() => void handleConfirmUnlinkParentLink()}
                          className="min-h-11"
                        >
                          {isUnlinkingParentLink
                            ? messages.parentLinks.confirmUnlinkPending
                            : messages.parentLinks.confirmUnlinkSubmit}
                        </Button>
                      </div>
                    </section>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={!adultMode && activeMessageLink !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveMessageLink(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl">
          {!adultMode && activeMessageLink !== null && (
            <div className="min-w-0 space-y-4">
              <div className="min-w-0 space-y-1">
                <DialogTitle className="wrap-anywhere">
                  {messages.parentLinks.messagesDialogTitle(
                    activeMessageLink.parentDisplayName,
                  )}
                </DialogTitle>
                <DialogDescription className="wrap-anywhere">
                  {messages.parentLinks.messagesDialogDescription(
                    activeMessageLink.childDisplayName,
                  )}
                </DialogDescription>
              </div>
              <ParentLinkMessagesThread
                key={`${userId}:${activeMessageLink.id}`}
                userId={userId}
                linkId={activeMessageLink.id}
                viewerRole="STAFF"
                headingLevel="h3"
                hideHeader
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
