import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomDetailQueryKey,
  classroomInvitationsQueryKey,
  createClassroomInvitationsPredicate,
  type InvitationStateFilter,
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
import { DEFAULT_PAGE_SIZE } from '@/components/pagination/pagination';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { formatInstant } from '@/lib/dates';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import {
  INVITATION_EMAIL_MAX_LENGTH,
  generateJoinCodeFormSchema,
  sendInvitationFormSchema,
  toCreateJoinCodePayload,
  type ClassroomInvitationDto,
  type CreatedClassroomInvitationDto,
  type GenerateJoinCodeFormInput,
  type GenerateJoinCodeFormOutput,
  type InvitationState,
  type JoinCodeDto,
  type JoinCodeExpiresPreset,
  type SendInvitationFormInput,
  type SendInvitationFormOutput,
} from './invitation-schema';
import {
  createClassroomInvitation,
  generateClassroomJoinCode,
  isAbortError,
  isUncertainWriteError,
  listClassroomInvitations,
  revokeClassroomInvitation,
  revokeClassroomJoinCode,
} from './invitation-service';
import { classroomMessages } from './messages';
import { useClassroomCapabilities } from './use-classroom-capabilities';

const STATE_FILTER_OPTIONS: readonly InvitationStateFilter[] = [
  'PENDING',
  'USED',
  'REVOKED',
  'EXPIRED',
  'ALL',
];

const EXPIRES_PRESET_OPTIONS: readonly JoinCodeExpiresPreset[] = [
  'default',
  '1h',
  '24h',
  '7d',
  '30d',
];

const STATE_BADGE_VARIANT: Readonly<
  Record<InvitationState, 'info' | 'secondary' | 'destructive' | 'warning'>
> = {
  PENDING: 'info',
  USED: 'secondary',
  REVOKED: 'destructive',
  EXPIRED: 'warning',
};

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

function isBadRequestApiError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === 'bad-request' ||
      error.kind === 'validation' ||
      error.status === 400)
  );
}

function buildInvitationAcceptUrl(token: string): string {
  const path = `/invitations/accept?token=${encodeURIComponent(token)}`;
  if (
    typeof window !== 'undefined' &&
    typeof window.location?.origin === 'string' &&
    window.location.origin !== '' &&
    window.location.origin !== 'null'
  ) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    navigator.clipboard === undefined ||
    typeof navigator.clipboard.writeText !== 'function'
  ) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function getInvitationLabel(invitation: ClassroomInvitationDto): string {
  if (invitation.kind === 'EMAIL' && invitation.targetEmail !== null) {
    return invitation.targetEmail;
  }
  return classroomMessages.invitations.list.targetJoinCodeFallback;
}

export interface ClassroomInvitationsPanelProps {
  readonly classroomId?: string;
}

/**
 * Staff-only classroom invitations and join-code management (`HU-AUL-002`)
 * mounted inside the `members` workspace panel when the server grants
 * `invite_members`.
 */
export function ClassroomInvitationsPanel({
  classroomId: propClassroomId,
}: ClassroomInvitationsPanelProps = {}) {
  const params = useParams<{ classroomId: string }>();
  const resolvedClassroomId = propClassroomId ?? params.classroomId ?? '';
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const capabilities = useClassroomCapabilities(resolvedClassroomId);
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

  if (capabilities.status === 'pending') {
    return <LoadingState label={messages.list.loading} skeletonLines={3} />;
  }

  if (capabilities.status === 'error') {
    if (isNotFoundApiError(capabilities.error)) {
      return (
        <ErrorState
          headingLevel="h3"
          title={messages.notFoundTitle}
          description={messages.notFoundDescription}
        />
      );
    }
    if (isForbiddenApiError(capabilities.error)) {
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

  if (!capabilities.can('invite_members')) {
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.forbiddenTitle}
        description={messages.forbiddenDescription}
      />
    );
  }

  return (
    <ClassroomInvitationsContent
      key={`${userId}:${resolvedClassroomId}`}
      userId={userId}
      classroomId={resolvedClassroomId}
    />
  );
}

interface ClassroomInvitationsContentProps {
  readonly userId: string;
  readonly classroomId: string;
}

function ClassroomInvitationsContent({
  userId,
  classroomId,
}: ClassroomInvitationsContentProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const messages = classroomMessages.invitations;

  const joinCodeHeadingId = useId();
  const emailHeadingId = useId();
  const listHeadingId = useId();
  const filterGroupLabelId = useId();

  // Join code local one-time state (never persisted outside component state).
  const [activeJoinCode, setActiveJoinCode] = useState<JoinCodeDto | null>(
    null,
  );
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [codeCopyFailed, setCodeCopyFailed] = useState(false);
  const [isRevokingCode, setIsRevokingCode] = useState(false);
  const [revokeCodeError, setRevokeCodeError] = useState<string | null>(null);

  // Email invitation local one-time state (never persisted outside component state).
  const [createdInvitation, setCreatedInvitation] =
    useState<CreatedClassroomInvitationDto | null>(null);
  const [linkCopyFailed, setLinkCopyFailed] = useState(false);
  const [tokenCopyFailed, setTokenCopyFailed] = useState(false);

  // Invitation list & inline revoke state.
  const [statusFilter, setStatusFilter] =
    useState<InvitationStateFilter>('PENDING');
  const [page, setPage] = useState(1);
  const [confirmRevokeTarget, setConfirmRevokeTarget] =
    useState<ClassroomInvitationDto | null>(null);
  const [isRevokingInvitation, setIsRevokingInvitation] = useState(false);
  const [revokeInvitationError, setRevokeInvitationError] = useState<
    string | null
  >(null);

  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const isMountedRef = useRef(true);
  const isRevokingCodeRef = useRef(false);
  const isRevokingInvitationRef = useRef(false);
  const joinCodeAbortRef = useRef<AbortController | null>(null);
  const revokeCodeAbortRef = useRef<AbortController | null>(null);
  const createInviteAbortRef = useRef<AbortController | null>(null);
  const revokeInviteAbortRef = useRef<AbortController | null>(null);
  const reconciledContextErrorRef = useRef<unknown>(null);

  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRegenerateHeadingRef = useRef<HTMLHeadingElement>(null);
  const restoreGenerateFocusRef = useRef(false);

  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmRevokeHeadingRef = useRef<HTMLHeadingElement>(null);
  const revokeButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const restoreRevokeTriggerIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      joinCodeAbortRef.current?.abort();
      revokeCodeAbortRef.current?.abort();
      createInviteAbortRef.current?.abort();
      revokeInviteAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (confirmRegenerate) {
      confirmRegenerateHeadingRef.current?.focus();
      return;
    }
    if (restoreGenerateFocusRef.current) {
      restoreGenerateFocusRef.current = false;
      generateButtonRef.current?.focus();
    }
  }, [confirmRegenerate]);

  useEffect(() => {
    if (confirmRevokeTarget !== null) {
      confirmRevokeHeadingRef.current?.focus();
      return;
    }
    const triggerId = restoreRevokeTriggerIdRef.current;
    if (triggerId !== null) {
      restoreRevokeTriggerIdRef.current = null;
      revokeButtonRefs.current.get(triggerId)?.focus();
    }
  }, [confirmRevokeTarget]);

  const queryParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    status: statusFilter,
  };

  const invitationsQuery = useQuery({
    queryKey: classroomInvitationsQueryKey(userId, classroomId, queryParams),
    queryFn: ({ signal }) =>
      listClassroomInvitations(client, classroomId, queryParams, { signal }),
    staleTime: 0,
  });

  useEffect(() => {
    if (!invitationsQuery.isError) {
      return;
    }
    if (
      isNotFoundApiError(invitationsQuery.error) &&
      reconciledContextErrorRef.current !== invitationsQuery.error
    ) {
      reconciledContextErrorRef.current = invitationsQuery.error;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }
  }, [
    classroomId,
    invitationsQuery.error,
    invitationsQuery.isError,
    queryClient,
    userId,
  ]);

  const joinCodeForm = useZodForm<
    GenerateJoinCodeFormInput,
    GenerateJoinCodeFormOutput
  >({
    schema: generateJoinCodeFormSchema,
    defaultValues: {
      maxUses: '',
      expiresPreset: 'default',
    },
  });

  const emailForm = useZodForm<
    SendInvitationFormInput,
    SendInvitationFormOutput
  >({
    schema: sendInvitationFormSchema,
    defaultValues: {
      email: '',
    },
  });

  const hasKnownActiveJoinCode =
    activeJoinCode !== null ||
    (invitationsQuery.data?.items.some(
      (item) => item.kind === 'JOIN_CODE' && item.state === 'PENDING',
    ) ??
      false);

  const { isSubmitting: isGeneratingCode, handleSubmit: handleJoinCodeSubmit } =
    useProtectedSubmit(
      joinCodeForm,
      async (values) => {
        if (hasKnownActiveJoinCode && !confirmRegenerate) {
          restoreGenerateFocusRef.current = false;
          setRevokeCodeError(null);
          setConfirmRegenerate(true);
          return;
        }

        const controller = new AbortController();
        joinCodeAbortRef.current?.abort();
        joinCodeAbortRef.current = controller;
        setRevokeCodeError(null);

        try {
          const generated = await generateClassroomJoinCode(
            client,
            classroomId,
            toCreateJoinCodePayload(values),
            { signal: controller.signal },
          );
          if (!isMountedRef.current || controller.signal.aborted) {
            return;
          }

          restoreGenerateFocusRef.current = false;
          setConfirmRegenerate(false);
          setCodeCopyFailed(false);
          setActiveJoinCode(generated);
          setLiveAnnouncement(
            `${messages.joinCode.generatedTitle}. ${messages.joinCode.generatedDescription}`,
          );
          toast.success(messages.joinCode.generatedTitle, {
            description: messages.joinCode.generatedDescription,
          });
          void queryClient.invalidateQueries({
            predicate: createClassroomInvitationsPredicate(userId, classroomId),
          });
        } catch (error) {
          if (
            isAbortError(error) ||
            controller.signal.aborted ||
            !isMountedRef.current
          ) {
            return;
          }
          if (isNotFoundApiError(error)) {
            void queryClient.invalidateQueries({
              queryKey: classroomDetailQueryKey(userId, classroomId),
              exact: true,
            });
          } else if (isUncertainWriteError(error)) {
            void queryClient.invalidateQueries({
              predicate: createClassroomInvitationsPredicate(
                userId,
                classroomId,
              ),
            });
          }
          throw error;
        } finally {
          if (joinCodeAbortRef.current === controller) {
            joinCodeAbortRef.current = null;
          }
        }
      },
      { knownFields: ['maxUses', 'expiresPreset'] },
    );

  const { isSubmitting: isSendingEmail, handleSubmit: handleEmailSubmit } =
    useProtectedSubmit(
      emailForm,
      async (values) => {
        const controller = new AbortController();
        createInviteAbortRef.current?.abort();
        createInviteAbortRef.current = controller;

        try {
          const created = await createClassroomInvitation(
            client,
            classroomId,
            values.email,
            { signal: controller.signal },
          );
          if (!isMountedRef.current || controller.signal.aborted) {
            return;
          }

          setLinkCopyFailed(false);
          setTokenCopyFailed(false);
          setCreatedInvitation(created);
          emailForm.reset({ email: '' });
          setLiveAnnouncement(
            `${messages.email.createdTitle}. ${messages.email.createdDescription}`,
          );
          toast.success(messages.email.createdTitle, {
            description: messages.email.createdDescription,
          });
          void queryClient.invalidateQueries({
            predicate: createClassroomInvitationsPredicate(userId, classroomId),
          });
        } catch (error) {
          if (
            isAbortError(error) ||
            controller.signal.aborted ||
            !isMountedRef.current
          ) {
            return;
          }
          if (isNotFoundApiError(error)) {
            void queryClient.invalidateQueries({
              queryKey: classroomDetailQueryKey(userId, classroomId),
              exact: true,
            });
          } else if (isUncertainWriteError(error)) {
            void queryClient.invalidateQueries({
              predicate: createClassroomInvitationsPredicate(
                userId,
                classroomId,
              ),
            });
          }
          throw error;
        } finally {
          if (createInviteAbortRef.current === controller) {
            createInviteAbortRef.current = null;
          }
        }
      },
      { knownFields: ['email'] },
    );

  const handleRevokeJoinCode = async (): Promise<void> => {
    if (isRevokingCodeRef.current) {
      return;
    }
    isRevokingCodeRef.current = true;
    setIsRevokingCode(true);
    setRevokeCodeError(null);

    const controller = new AbortController();
    revokeCodeAbortRef.current?.abort();
    revokeCodeAbortRef.current = controller;

    try {
      await revokeClassroomJoinCode(client, classroomId, {
        signal: controller.signal,
      });
      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }

      setActiveJoinCode(null);
      setConfirmRegenerate(false);
      setCodeCopyFailed(false);
      setLiveAnnouncement(
        `${messages.joinCode.revokedTitle}. ${messages.joinCode.revokedDescription}`,
      );
      toast.success(messages.joinCode.revokedTitle, {
        description: messages.joinCode.revokedDescription,
      });
      void queryClient.invalidateQueries({
        predicate: createClassroomInvitationsPredicate(userId, classroomId),
      });
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
          : messages.joinCode.errors.unexpected;
      setRevokeCodeError(errorMessage);

      if (isNotFoundApiError(error)) {
        setActiveJoinCode(null);
        void queryClient.invalidateQueries({
          predicate: createClassroomInvitationsPredicate(userId, classroomId),
        });
        void queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
          exact: true,
        });
      } else if (isForbiddenApiError(error) || isUncertainWriteError(error)) {
        void queryClient.invalidateQueries({
          predicate: createClassroomInvitationsPredicate(userId, classroomId),
        });
      }
    } finally {
      if (revokeCodeAbortRef.current === controller) {
        revokeCodeAbortRef.current = null;
      }
      isRevokingCodeRef.current = false;
      if (isMountedRef.current) {
        setIsRevokingCode(false);
      }
    }
  };

  const handleCopyJoinCode = async (): Promise<void> => {
    if (activeJoinCode === null) {
      return;
    }
    const copied = await copyTextToClipboard(activeJoinCode.code);
    if (!isMountedRef.current) {
      return;
    }
    if (copied) {
      setCodeCopyFailed(false);
      setLiveAnnouncement(messages.joinCode.copiedAnnouncement);
    } else {
      setCodeCopyFailed(true);
    }
  };

  const handleCopyInviteLink = async (): Promise<void> => {
    if (createdInvitation === null) {
      return;
    }
    const url = buildInvitationAcceptUrl(createdInvitation.token);
    const copied = await copyTextToClipboard(url);
    if (!isMountedRef.current) {
      return;
    }
    if (copied) {
      setLinkCopyFailed(false);
      setLiveAnnouncement(messages.email.copiedLinkAnnouncement);
    } else {
      setLinkCopyFailed(true);
    }
  };

  const handleCopyInviteToken = async (): Promise<void> => {
    if (createdInvitation === null) {
      return;
    }
    const copied = await copyTextToClipboard(createdInvitation.token);
    if (!isMountedRef.current) {
      return;
    }
    if (copied) {
      setTokenCopyFailed(false);
      setLiveAnnouncement(messages.email.copiedTokenAnnouncement);
    } else {
      setTokenCopyFailed(true);
    }
  };

  const setRevokeButtonRef =
    (invitationId: string) =>
    (node: HTMLButtonElement | null): void => {
      if (node) {
        revokeButtonRefs.current.set(invitationId, node);
      } else {
        revokeButtonRefs.current.delete(invitationId);
      }
    };

  const handleStatusFilterChange = (
    nextStatus: InvitationStateFilter,
  ): void => {
    if (isRevokingInvitationRef.current || nextStatus === statusFilter) {
      return;
    }
    setConfirmRevokeTarget(null);
    setRevokeInvitationError(null);
    setStatusFilter(nextStatus);
    setPage(1);
  };

  const handleOpenRevokeConfirmation = (
    invitation: ClassroomInvitationDto,
  ): void => {
    if (isRevokingInvitationRef.current) {
      return;
    }
    restoreRevokeTriggerIdRef.current = null;
    setRevokeInvitationError(null);
    setConfirmRevokeTarget(invitation);
  };

  const handleCancelRevokeConfirmation = (): void => {
    if (isRevokingInvitationRef.current || confirmRevokeTarget === null) {
      return;
    }
    restoreRevokeTriggerIdRef.current = confirmRevokeTarget.id;
    setConfirmRevokeTarget(null);
    setRevokeInvitationError(null);
  };

  const handleConfirmRevokeInvitation = async (): Promise<void> => {
    if (isRevokingInvitationRef.current || confirmRevokeTarget === null) {
      return;
    }

    const target = confirmRevokeTarget;
    const label = getInvitationLabel(target);
    isRevokingInvitationRef.current = true;
    setIsRevokingInvitation(true);
    setRevokeInvitationError(null);

    const controller = new AbortController();
    revokeInviteAbortRef.current?.abort();
    revokeInviteAbortRef.current = controller;

    try {
      await revokeClassroomInvitation(client, classroomId, target.id, {
        signal: controller.signal,
      });
      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }

      restoreRevokeTriggerIdRef.current = null;
      setConfirmRevokeTarget(null);
      setRevokeInvitationError(null);
      const description = messages.list.revokedDescription(label);
      setLiveAnnouncement(`${messages.list.revokedTitle}: ${description}`);
      toast.success(messages.list.revokedTitle, { description });
      void queryClient.invalidateQueries({
        predicate: createClassroomInvitationsPredicate(userId, classroomId),
      });
      listHeadingRef.current?.focus();
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
          : messages.list.revokeUnexpected;
      setRevokeInvitationError(errorMessage);

      if (isNotFoundApiError(error)) {
        void queryClient.invalidateQueries({
          predicate: createClassroomInvitationsPredicate(userId, classroomId),
        });
        void queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
          exact: true,
        });
      } else if (
        isBadRequestApiError(error) ||
        isForbiddenApiError(error) ||
        isUncertainWriteError(error)
      ) {
        void queryClient.invalidateQueries({
          predicate: createClassroomInvitationsPredicate(userId, classroomId),
        });
      }
    } finally {
      if (revokeInviteAbortRef.current === controller) {
        revokeInviteAbortRef.current = null;
      }
      isRevokingInvitationRef.current = false;
      if (isMountedRef.current) {
        setIsRevokingInvitation(false);
      }
    }
  };

  const isListForbidden =
    invitationsQuery.isError && isForbiddenApiError(invitationsQuery.error);
  const isListNotFound =
    invitationsQuery.isError && isNotFoundApiError(invitationsQuery.error);
  const isRevokedAccess = isListForbidden || isListNotFound;
  const listData = isRevokedAccess ? undefined : invitationsQuery.data;
  const createdInviteUrl =
    createdInvitation !== null
      ? buildInvitationAcceptUrl(createdInvitation.token)
      : null;

  return (
    <div className="min-w-0 space-y-6 pt-2">
      <LiveRegion message={liveAnnouncement} visuallyHidden />

      {/* Section 1: Classroom Join Code */}
      <section
        aria-labelledby={joinCodeHeadingId}
        className="min-w-0 space-y-4 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel"
      >
        <div className="min-w-0 space-y-1.5">
          <h3
            id={joinCodeHeadingId}
            className="font-display text-lg font-semibold text-foreground"
          >
            {messages.joinCode.heading}
          </h3>
          <p className="text-sm text-pretty text-muted-foreground">
            {messages.joinCode.description}
          </p>
          <p className="text-sm text-pretty text-muted-foreground">
            {messages.joinCode.oneTimeNotice}
          </p>
        </div>

        <Alert variant="warning" role="status">
          <AlertTitle>{messages.joinCode.regenerateWarning}</AlertTitle>
        </Alert>

        <form
          onSubmit={(event) => void handleJoinCodeSubmit(event)}
          noValidate
          className="min-w-0 space-y-4"
        >
          <FormField
            control={joinCodeForm.control}
            name="maxUses"
            label={messages.joinCode.maxUsesLabel}
            description={messages.joinCode.maxUsesDescription}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="text"
                inputMode="numeric"
                placeholder={messages.joinCode.maxUsesPlaceholder}
                disabled={isGeneratingCode}
              />
            )}
          </FormField>

          <FormField
            control={joinCodeForm.control}
            name="expiresPreset"
            label={messages.joinCode.expiresLabel}
            description={messages.joinCode.expiresDescription}
          >
            {(fieldProps) => (
              <select
                {...fieldProps}
                disabled={isGeneratingCode}
                className="flex min-h-11 w-full rounded-xl border border-edge bg-card px-3.5 py-2 text-base text-foreground shadow-inset focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                {EXPIRES_PRESET_OPTIONS.map((preset) => (
                  <option key={preset} value={preset}>
                    {messages.joinCode.expiresOptions[preset]}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormRootError
            form={joinCodeForm}
            headingLevel="h4"
            title={messages.joinCode.errors.generateTitle}
          />

          {confirmRegenerate ? (
            <section
              aria-labelledby={`${joinCodeHeadingId}-confirm-regen`}
              className="min-w-0 space-y-3 rounded-2xl border-2 border-warning-edge bg-warning/15 p-3.5"
            >
              <h4
                id={`${joinCodeHeadingId}-confirm-regen`}
                ref={confirmRegenerateHeadingRef}
                tabIndex={-1}
                className="font-display text-base font-semibold text-foreground outline-none"
              >
                {messages.joinCode.confirmRegenerateTitle}
              </h4>
              <p className="text-sm text-pretty text-muted-foreground">
                {messages.joinCode.confirmRegenerateDescription}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGeneratingCode}
                  onClick={() => {
                    restoreGenerateFocusRef.current = true;
                    setConfirmRegenerate(false);
                  }}
                  className="min-h-11"
                >
                  {messages.joinCode.confirmRegenerateCancel}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  busy={isGeneratingCode}
                  disabled={isGeneratingCode}
                  onClick={() => void handleJoinCodeSubmit()}
                  className="min-h-11"
                >
                  {isGeneratingCode
                    ? messages.joinCode.generatingPending
                    : messages.joinCode.confirmRegenerateSubmit}
                </Button>
              </div>
            </section>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                ref={generateButtonRef}
                type="submit"
                busy={isGeneratingCode}
                disabled={isGeneratingCode || isRevokingCode}
                className="min-h-11"
              >
                {isGeneratingCode
                  ? messages.joinCode.generatingPending
                  : hasKnownActiveJoinCode
                    ? messages.joinCode.regenerateSubmit
                    : messages.joinCode.generateSubmit}
              </Button>
            </div>
          )}
        </form>

        {activeJoinCode !== null && (
          <div className="min-w-0 space-y-3 rounded-2xl border border-success-edge bg-success/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-base font-semibold text-foreground">
                {messages.joinCode.activeCardTitle}
              </h4>
              <Badge variant={STATE_BADGE_VARIANT[activeJoinCode.state]}>
                {messages.list.states[activeJoinCode.state]}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {messages.joinCode.codeLabel}
              </p>
              <code className="block rounded-xl border border-edge bg-card px-3 py-2 font-mono text-lg font-bold tracking-widest text-foreground break-all select-all">
                {activeJoinCode.code}
              </code>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {messages.joinCode.usesLabel(
                  activeJoinCode.useCount,
                  activeJoinCode.maxUses,
                )}
              </span>
              <span>
                {messages.joinCode.expiresAtLabel(
                  formatTimestamp(activeJoinCode.expiresAt),
                )}
              </span>
            </div>

            {codeCopyFailed && (
              <Alert variant="warning" role="status">
                <AlertDescription className="space-y-2">
                  <p>{messages.joinCode.copyFallbackInstruction}</p>
                  <code className="block rounded-lg bg-card px-2.5 py-1.5 font-mono text-sm font-semibold break-all select-all">
                    {activeJoinCode.code}
                  </code>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleCopyJoinCode()}
                className="min-h-11"
              >
                {messages.joinCode.copyAction}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                busy={isRevokingCode}
                disabled={isRevokingCode || isGeneratingCode}
                onClick={() => void handleRevokeJoinCode()}
                className="min-h-11"
              >
                {isRevokingCode
                  ? messages.joinCode.revokingPending
                  : messages.joinCode.revokeCurrentAction}
              </Button>
            </div>
          </div>
        )}

        {activeJoinCode === null && (
          <div className="min-w-0 space-y-2 border-t border-edge/60 pt-3">
            <p className="text-xs text-pretty text-muted-foreground">
              {messages.joinCode.revokeActiveHelp}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              busy={isRevokingCode}
              disabled={isRevokingCode || isGeneratingCode}
              onClick={() => void handleRevokeJoinCode()}
              className="min-h-11"
            >
              {isRevokingCode
                ? messages.joinCode.revokingPending
                : messages.joinCode.revokeActiveAction}
            </Button>
          </div>
        )}

        {revokeCodeError !== null && (
          <Alert variant="destructive" role="alert">
            <AlertTitle as="h4">
              {messages.joinCode.errors.revokeTitle}
            </AlertTitle>
            <AlertDescription>{revokeCodeError}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* Section 2: Email Invitations Form */}
      <section
        aria-labelledby={emailHeadingId}
        className="min-w-0 space-y-4 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel"
      >
        <div className="min-w-0 space-y-1.5">
          <h3
            id={emailHeadingId}
            className="font-display text-lg font-semibold text-foreground"
          >
            {messages.email.heading}
          </h3>
          <p className="text-sm text-pretty text-muted-foreground">
            {messages.email.description}
          </p>
        </div>

        <div className="min-w-0 space-y-2 rounded-xl bg-tray/50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-foreground">
              {messages.email.roleLabel}:
            </span>
            <Badge variant="secondary">{messages.email.roleValue}</Badge>
          </div>
          <p className="text-xs text-pretty text-muted-foreground">
            {messages.email.nonDisclosureNote}
          </p>
        </div>

        <form
          onSubmit={(event) => void handleEmailSubmit(event)}
          noValidate
          className="min-w-0 space-y-4"
        >
          <FormField
            control={emailForm.control}
            name="email"
            label={messages.email.emailLabel}
            description={messages.email.emailDescription}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="email"
                autoComplete="off"
                maxLength={INVITATION_EMAIL_MAX_LENGTH}
                placeholder={messages.email.emailPlaceholder}
                disabled={isSendingEmail}
              />
            )}
          </FormField>

          <FormRootError
            form={emailForm}
            headingLevel="h4"
            title={messages.email.errors.createTitle}
          />

          <Button
            type="submit"
            busy={isSendingEmail}
            disabled={isSendingEmail}
            className="min-h-11"
          >
            {isSendingEmail
              ? messages.email.submitPending
              : messages.email.submitAction}
          </Button>
        </form>

        {createdInvitation !== null && createdInviteUrl !== null && (
          <div className="min-w-0 space-y-3 rounded-2xl border border-success-edge bg-success/10 p-4">
            <div className="space-y-1">
              <h4 className="font-display text-base font-semibold text-foreground">
                {messages.email.createdTitle}
              </h4>
              <p className="text-sm text-pretty text-muted-foreground">
                {messages.email.createdDescription}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {messages.email.inviteLinkLabel}
              </p>
              <code className="block rounded-xl border border-edge bg-card px-3 py-2 font-mono text-xs text-foreground break-all select-all">
                {createdInviteUrl}
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {messages.email.tokenLabel}
              </p>
              <code className="block rounded-xl border border-edge bg-card px-3 py-2 font-mono text-xs text-foreground break-all select-all">
                {createdInvitation.token}
              </code>
            </div>

            {linkCopyFailed && (
              <Alert variant="warning" role="status">
                <AlertDescription className="space-y-2">
                  <p>{messages.email.copyLinkFallbackInstruction}</p>
                  <code className="block rounded-lg bg-card px-2.5 py-1.5 font-mono text-xs break-all select-all">
                    {createdInviteUrl}
                  </code>
                </AlertDescription>
              </Alert>
            )}

            {tokenCopyFailed && (
              <Alert variant="warning" role="status">
                <AlertDescription className="space-y-2">
                  <p>{messages.email.copyTokenFallbackInstruction}</p>
                  <code className="block rounded-lg bg-card px-2.5 py-1.5 font-mono text-xs break-all select-all">
                    {createdInvitation.token}
                  </code>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleCopyInviteLink()}
                className="min-h-11"
              >
                {messages.email.copyLinkAction}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopyInviteToken()}
                className="min-h-11"
              >
                {messages.email.copyTokenAction}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Invitations History & Revocation */}
      <section aria-labelledby={listHeadingId} className="min-w-0 space-y-4">
        <h3
          id={listHeadingId}
          ref={listHeadingRef}
          tabIndex={-1}
          className="font-display text-lg font-semibold text-foreground outline-none"
        >
          {messages.list.heading}
        </h3>

        {!isRevokedAccess && (
          <div
            role="group"
            aria-labelledby={filterGroupLabelId}
            className="min-w-0 space-y-1.5 rounded-2xl border border-edge bg-tray/40 p-3.5"
          >
            <p
              id={filterGroupLabelId}
              className="text-sm font-medium text-foreground"
            >
              {messages.list.filterLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {STATE_FILTER_OPTIONS.map((option) => {
                const pressed = statusFilter === option;
                return (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={pressed ? 'default' : 'outline'}
                    aria-pressed={pressed}
                    disabled={isRevokingInvitation}
                    onClick={() => handleStatusFilterChange(option)}
                    className="min-h-11"
                  >
                    {messages.list.filters[option]}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {invitationsQuery.isPending && listData === undefined && (
          <LoadingState label={messages.list.loading} skeletonLines={4} />
        )}

        {isListForbidden && (
          <ErrorState
            headingLevel="h4"
            title={messages.forbiddenTitle}
            description={messages.forbiddenDescription}
          />
        )}

        {isListNotFound && (
          <ErrorState
            headingLevel="h4"
            title={messages.notFoundTitle}
            description={messages.notFoundDescription}
          />
        )}

        {invitationsQuery.isError &&
          !isRevokedAccess &&
          listData === undefined && (
            <ErrorState
              headingLevel="h4"
              title={messages.list.errorTitle}
              description={messages.list.errorDescription}
              onRetry={() => void invitationsQuery.refetch()}
              isRetrying={invitationsQuery.isRefetching}
            />
          )}

        {invitationsQuery.isError &&
          !isRevokedAccess &&
          listData !== undefined && (
            <StaleDataNotice
              headingLevel="h4"
              title={messages.list.staleTitle}
              description={messages.list.staleDescription}
              onRetry={() => void invitationsQuery.refetch()}
              isRetrying={invitationsQuery.isRefetching}
            />
          )}

        {listData !== undefined && listData.items.length === 0 && (
          <EmptyState
            headingLevel="h4"
            title={
              listData.total > 0 && page > 1
                ? messages.list.emptyPageTitle
                : messages.list.emptyTitle
            }
            description={
              listData.total > 0 && page > 1
                ? messages.list.emptyPageDescription
                : messages.list.emptyDescription
            }
          />
        )}

        {listData !== undefined && listData.items.length > 0 && (
          <ul className="min-w-0 space-y-3" aria-label={messages.list.heading}>
            {listData.items.map((invitation) => {
              const label = getInvitationLabel(invitation);
              const isPending = invitation.state === 'PENDING';
              const isConfirmingThis =
                confirmRevokeTarget?.id === invitation.id;
              const confirmHeadingId = `${listHeadingId}-confirm-${invitation.id}`;
              const confirmDescId = `${listHeadingId}-desc-${invitation.id}`;

              return (
                <li
                  key={invitation.id}
                  className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-semibold text-foreground wrap-anywhere">
                          {label}
                        </span>
                        <Badge variant={STATE_BADGE_VARIANT[invitation.state]}>
                          {messages.list.states[invitation.state]}
                        </Badge>
                        <Badge variant="outline">
                          {messages.list.kinds[invitation.kind]}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{classroomMessages.roles[invitation.role]}</span>
                        <span>
                          {messages.list.usesLabel(
                            invitation.useCount,
                            invitation.maxUses,
                          )}
                        </span>
                        <span>
                          {messages.list.createdAtLabel(
                            formatTimestamp(invitation.createdAt),
                          )}
                        </span>
                        <span>
                          {messages.list.expiresAtLabel(
                            formatTimestamp(invitation.expiresAt),
                          )}
                        </span>
                      </div>
                    </div>

                    {isPending && (
                      <Button
                        ref={setRevokeButtonRef(invitation.id)}
                        type="button"
                        variant="destructive"
                        size="sm"
                        aria-label={messages.list.revokeAriaLabel(label)}
                        aria-expanded={isConfirmingThis}
                        disabled={isRevokingInvitation || isConfirmingThis}
                        onClick={() => handleOpenRevokeConfirmation(invitation)}
                        className="min-h-11 shrink-0"
                      >
                        {messages.list.revokeAction}
                      </Button>
                    )}
                  </div>

                  {isConfirmingThis && (
                    <section
                      aria-labelledby={confirmHeadingId}
                      aria-describedby={confirmDescId}
                      className="min-w-0 space-y-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3.5"
                    >
                      <h4
                        id={confirmHeadingId}
                        ref={confirmRevokeHeadingRef}
                        tabIndex={-1}
                        className="font-display text-base font-semibold text-foreground outline-none wrap-anywhere"
                      >
                        {messages.list.confirmRevokeTitle(label)}
                      </h4>
                      <p
                        id={confirmDescId}
                        className="text-sm text-pretty text-muted-foreground"
                      >
                        {messages.list.confirmRevokeDescription}
                      </p>

                      {revokeInvitationError !== null && (
                        <Alert variant="destructive" role="alert">
                          <AlertTitle>
                            {messages.list.revokeErrorTitle}
                          </AlertTitle>
                          <AlertDescription>
                            {revokeInvitationError}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isRevokingInvitation}
                          onClick={handleCancelRevokeConfirmation}
                          className="min-h-11"
                        >
                          {messages.list.confirmRevokeCancel}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          busy={isRevokingInvitation}
                          onClick={() => void handleConfirmRevokeInvitation()}
                          className="min-h-11"
                        >
                          {isRevokingInvitation
                            ? messages.list.confirmRevokePending
                            : messages.list.confirmRevokeSubmit}
                        </Button>
                      </div>
                    </section>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {listData !== undefined && listData.total > 0 && (
          <PaginationControls
            page={listData.page}
            pageSize={listData.pageSize}
            total={listData.total}
            onPageChange={(nextPage) => {
              if (isRevokingInvitationRef.current) {
                return;
              }
              setConfirmRevokeTarget(null);
              setRevokeInvitationError(null);
              setPage(nextPage);
            }}
            busy={invitationsQuery.isFetching}
            disabled={isRevokingInvitation}
          />
        )}
      </section>
    </div>
  );
}
