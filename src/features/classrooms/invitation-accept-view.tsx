import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  classroomDetailQueryKey,
  createUserScopePredicate,
} from '@/api/query-keys';
import { messages } from '@/app/messages';
import { useDocumentTitle } from '@/app/router/document-title';
import {
  REGISTER_PATH,
  buildAuthReturnHref,
  buildLoginRedirect,
} from '@/app/router/return-target';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useUnsavedChangesGuard,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { joinMessages } from './join-messages';
import {
  joinClassroomByCodeSchema,
  validateInvitationQueryToken,
  type InvitationQueryTokenState,
  type JoinClassroomByCodeInput,
  type JoinClassroomByCodeOutput,
  type JoinClassroomResponse,
} from './join-schema';
import {
  acceptClassroomInvitation,
  isJoinCancellation,
  joinClassroomWithCode,
  resolveInvitationAcceptError,
} from './join-service';

type ActiveJoinMode = 'invitation' | 'code';

const primaryCtaLinkClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 font-display text-base font-semibold text-primary-foreground [--key:var(--key-primary)] key-bevel motion-press focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

const outlineCtaLinkClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-edge bg-card px-5 py-2 font-display text-base font-semibold text-card-foreground [--key:var(--key-sand)] key-bevel motion-press focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

const secondaryTextLinkClass =
  'inline-flex min-h-11 items-center rounded-sm px-1 font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

function isScrubbedInvitationState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'invitationTokenScrubbed' in state &&
    (state as { invitationTokenScrubbed?: unknown }).invitationTokenScrubbed ===
      true
  );
}

function useJoinSubmissionSignal() {
  const { controller } = useSessionService();
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    const cancel = () => pending.current?.abort();
    const unregister = controller.registerCleanup(cancel);
    return () => {
      cancel();
      unregister();
    };
  }, [controller]);

  return () => {
    pending.current?.abort();
    const submission = new AbortController();
    pending.current = submission;
    return submission.signal;
  };
}

function PageHeader({ subtitle }: { readonly subtitle?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="font-display text-xs font-semibold tracking-wider text-primary uppercase">
        {joinMessages.eyebrow}
      </p>
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {messages.pages.invitationAccept.title}
      </h2>
      {subtitle && (
        <p className="text-sm text-pretty text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function UnauthenticatedGate({
  tokenState,
}: {
  readonly tokenState: InvitationQueryTokenState;
}) {
  const invalidTokenAlertId = useId();
  // Rebuild only the approved destination, including a validated in-memory token
  // after authenticated URL scrubbing. Never forward arbitrary query parameters.
  const loginHref = buildLoginRedirect({
    pathname: '/invitations/accept',
    search:
      tokenState.status === 'valid'
        ? `?${new URLSearchParams({ token: tokenState.token }).toString()}`
        : '',
    hash: '',
  });
  const queryStart = loginHref.indexOf('?');
  const loginSearchParams = new URLSearchParams(
    queryStart >= 0 ? loginHref.slice(queryStart + 1) : '',
  );
  const registerHref = buildAuthReturnHref(REGISTER_PATH, loginSearchParams);

  return (
    <section className="space-y-6">
      <PageHeader subtitle={joinMessages.gate.subtitle} />

      {tokenState.status === 'invalid' && (
        <Alert
          variant="destructive"
          role="alert"
          aria-labelledby={invalidTokenAlertId}
        >
          <AlertTitle as="h3" id={invalidTokenAlertId}>
            {joinMessages.invitation.invalidTokenTitle}
          </AlertTitle>
          <AlertDescription>
            {joinMessages.invitation.invalidTokenDescription}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3 rounded-2xl border border-edge bg-tray/60 p-4">
        <Badge variant="info">{joinMessages.gate.badge}</Badge>
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold text-foreground">
            {joinMessages.gate.title}
          </h3>
          <p className="text-sm text-pretty text-muted-foreground">
            {joinMessages.gate.body}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Link to={loginHref} className={primaryCtaLinkClass}>
          {joinMessages.gate.loginCta}
        </Link>
        <Link to={registerHref} className={outlineCtaLinkClass}>
          {joinMessages.gate.registerCta}
        </Link>
      </div>

      <p className="border-t border-edge pt-4 text-center text-sm text-muted-foreground">
        <Link to="/" className={secondaryTextLinkClass}>
          {joinMessages.gate.backHomeCta}
        </Link>
      </p>
    </section>
  );
}

async function completeJoinNavigation(
  queryClient: ReturnType<typeof useQueryClient>,
  navigate: ReturnType<typeof useNavigate>,
  userId: string,
  result: JoinClassroomResponse,
): Promise<void> {
  const matchesUser = createUserScopePredicate(userId);
  await queryClient.invalidateQueries({
    queryKey: classroomDetailQueryKey(userId, result.classroomId),
    exact: true,
  });
  await queryClient.invalidateQueries({
    predicate: (query) => {
      if (!matchesUser(query)) return false;
      const first = query.queryKey[0] as { domain?: unknown } | undefined;
      return first?.domain === 'classrooms';
    },
  });
  void navigate(`/classrooms/${encodeURIComponent(result.classroomId)}`, {
    replace: true,
    state: { joinOutcome: result },
  });
}

function InvitationTokenSection({
  tokenState,
  userId,
  userEmail,
  onSwitchToCode,
}: {
  readonly tokenState: Exclude<InvitationQueryTokenState, { status: 'absent' }>;
  readonly userId: string;
  readonly userEmail: string;
  readonly onSwitchToCode: () => void;
}) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const beginSubmission = useJoinSubmissionSignal();
  const acceptingRef = useRef(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [parentConfirmation, setParentConfirmation] =
    useState<JoinClassroomResponse | null>(null);
  const invalidAlertId = useId();
  const readyCardId = useId();
  const parentConfirmedHeadingId = useId();
  const parentConfirmedHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (parentConfirmation !== null) {
      parentConfirmedHeadingRef.current?.focus();
    }
  }, [parentConfirmation]);

  const handleAccept = async () => {
    if (tokenState.status !== 'valid' || acceptingRef.current) {
      return;
    }
    acceptingRef.current = true;
    setIsAccepting(true);
    setAcceptError(null);
    const signal = beginSubmission();
    try {
      const result = await acceptClassroomInvitation(
        client,
        { token: tokenState.token },
        { signal },
      );
      signal.throwIfAborted();
      if (result.role === 'PARENT') {
        const matchesUser = createUserScopePredicate(userId);
        await queryClient.invalidateQueries({
          predicate: (query) => {
            if (!matchesUser(query)) return false;
            const first = query.queryKey[0] as { domain?: unknown } | undefined;
            return first?.domain === 'classrooms';
          },
        });
        setParentConfirmation(result);
        return;
      }
      await completeJoinNavigation(queryClient, navigate, userId, result);
    } catch (error) {
      if (isJoinCancellation(error)) {
        return;
      }
      setAcceptError(resolveInvitationAcceptError(error).userMessage);
    } finally {
      acceptingRef.current = false;
      setIsAccepting(false);
    }
  };

  if (parentConfirmation !== null) {
    return (
      <section className="space-y-6">
        <PageHeader subtitle={joinMessages.invitation.subtitle} />

        <div
          role="status"
          aria-live="polite"
          data-testid="parent-invitation-outcome"
          className="space-y-5"
        >
          <Alert
            variant={parentConfirmation.alreadyMember ? 'info' : 'success'}
            role="group"
            aria-labelledby={parentConfirmedHeadingId}
          >
            <AlertTitle
              as="h3"
              id={parentConfirmedHeadingId}
              ref={parentConfirmedHeadingRef}
              tabIndex={-1}
              className="outline-none"
            >
              {parentConfirmation.alreadyMember
                ? joinMessages.outcome.parentAlreadyMemberTitle
                : joinMessages.outcome.parentJoinedTitle}
            </AlertTitle>
            <AlertDescription>
              {parentConfirmation.alreadyMember
                ? joinMessages.outcome.parentAlreadyMemberBody
                : joinMessages.outcome.parentJoinedBody}
            </AlertDescription>
          </Alert>

          <div className="space-y-3 rounded-2xl border border-edge bg-tray/60 p-4">
            <Badge variant="success">{joinMessages.outcome.parentBadge}</Badge>
            <p className="text-sm text-foreground">
              <span className="font-medium">
                {joinMessages.invitation.signedInAccountPrefix}
              </span>{' '}
              <span className="font-semibold wrap-anywhere">{userEmail}</span>
            </p>
          </div>

          <Link to="/" className={primaryCtaLinkClass}>
            {joinMessages.outcome.parentContinueCta}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader subtitle={joinMessages.invitation.subtitle} />

      {tokenState.status === 'invalid' ? (
        <Alert
          variant="destructive"
          role="alert"
          aria-labelledby={invalidAlertId}
        >
          <AlertTitle as="h3" id={invalidAlertId}>
            {joinMessages.invitation.invalidTokenTitle}
          </AlertTitle>
          <AlertDescription>
            {joinMessages.invitation.invalidTokenDescription}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          <FormRootError
            error={acceptError}
            headingLevel="h3"
            title={joinMessages.errors.rootTitle}
          />

          <div
            role="group"
            aria-labelledby={readyCardId}
            className="space-y-3 rounded-2xl border border-edge bg-tray/60 p-4"
          >
            <Badge variant="info">{joinMessages.invitation.badge}</Badge>
            <div className="space-y-1.5">
              <h3
                id={readyCardId}
                className="font-display text-base font-semibold text-foreground"
              >
                {joinMessages.invitation.readyTitle}
              </h3>
              <p className="text-sm text-pretty text-muted-foreground">
                {joinMessages.invitation.readyDescription}
              </p>
              <p className="text-sm text-foreground">
                <span className="font-medium">
                  {joinMessages.invitation.signedInAccountPrefix}
                </span>{' '}
                <span className="font-semibold wrap-anywhere">{userEmail}</span>
              </p>
              <p className="text-xs text-pretty text-muted-foreground">
                {joinMessages.invitation.emailMismatchHint}
              </p>
            </div>
          </div>

          <Button
            type="button"
            busy={isAccepting}
            className="w-full"
            onClick={() => void handleAccept()}
          >
            {isAccepting
              ? joinMessages.invitation.acceptingAction
              : joinMessages.invitation.acceptAction}
          </Button>
        </div>
      )}

      <div className="space-y-3 border-t border-edge pt-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isAccepting}
          onClick={onSwitchToCode}
        >
          {joinMessages.invitation.switchToCodeAction}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/" className={secondaryTextLinkClass}>
            {joinMessages.gate.backHomeCta}
          </Link>
        </p>
      </div>
    </section>
  );
}

function JoinByCodeSection({
  userId,
  canReturnToInvitation,
  onReturnToInvitation,
}: {
  readonly userId: string;
  readonly canReturnToInvitation: boolean;
  readonly onReturnToInvitation: () => void;
}) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const beginSubmission = useJoinSubmissionSignal();

  const form = useZodForm<JoinClassroomByCodeInput, JoinClassroomByCodeOutput>({
    schema: joinClassroomByCodeSchema,
    defaultValues: { code: '' },
  });

  const { confirmNavigation } = useUnsavedChangesGuard(
    Boolean(form.formState.dirtyFields.code),
    { message: joinMessages.code.unsavedChangesConfirm },
  );

  const handleLeaveWithGuard = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmNavigation()) {
      event.preventDefault();
    }
  };

  const handleSwitchBack = () => {
    if (!confirmNavigation()) {
      return;
    }
    onReturnToInvitation();
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      const signal = beginSubmission();
      try {
        const result = await joinClassroomWithCode(client, values, { signal });
        signal.throwIfAborted();
        form.reset({ code: '' });
        await completeJoinNavigation(queryClient, navigate, userId, result);
      } catch (error) {
        if (isJoinCancellation(error)) {
          return;
        }
        throw error;
      }
    },
    { knownFields: ['code'] },
  );

  return (
    <section className="space-y-6">
      <PageHeader subtitle={joinMessages.code.subtitle} />

      <div>
        <Badge variant="secondary">{joinMessages.code.badge}</Badge>
      </div>

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <FormRootError
          form={form}
          headingLevel="h3"
          title={joinMessages.errors.rootTitle}
        />

        <FormField
          control={form.control}
          name="code"
          label={joinMessages.code.fieldLabel}
          description={joinMessages.code.fieldDescription}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={joinMessages.code.fieldPlaceholder}
            />
          )}
        </FormField>

        <Button type="submit" busy={isSubmitting} className="w-full">
          {isSubmitting
            ? joinMessages.code.submittingAction
            : joinMessages.code.submitAction}
        </Button>

        <p className="text-xs text-pretty text-muted-foreground">
          {joinMessages.code.privacyHint}
        </p>
      </form>

      <div className="space-y-3 border-t border-edge pt-4">
        {canReturnToInvitation && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isSubmitting}
            onClick={handleSwitchBack}
          >
            {joinMessages.code.switchToInvitationAction}
          </Button>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/"
            onClick={handleLeaveWithGuard}
            className={secondaryTextLinkClass}
          >
            {joinMessages.gate.backHomeCta}
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * Landing view for `/invitations/accept` handling both email invitation tokens
 * and student join-by-code enrollment. Unauthenticated visitors are gated behind
 * explicit login/register links carrying a validated `?next=` target, and any
 * `?token=` query parameter is latched into React memory and scrubbed from the URL
 * once authenticated.
 */
export function InvitationAcceptView() {
  useDocumentTitle(messages.pages.invitationAccept.title);

  const snapshot = useSessionSnapshot();
  const { controller } = useSessionService();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [latchedLocationKey, setLatchedLocationKey] = useState(location.key);
  const [tokenState, setTokenState] = useState<InvitationQueryTokenState>(() =>
    validateInvitationQueryToken(searchParams),
  );
  const [activeMode, setActiveMode] = useState<ActiveJoinMode>(() =>
    searchParams.has('token') ? 'invitation' : 'code',
  );

  if (location.key !== latchedLocationKey) {
    setLatchedLocationKey(location.key);
    if (searchParams.has('token')) {
      setTokenState(validateInvitationQueryToken(searchParams));
      setActiveMode('invitation');
    } else if (
      !isScrubbedInvitationState(location.state) &&
      tokenState.status !== 'absent'
    ) {
      setTokenState({ status: 'absent' });
      setActiveMode('code');
    }
  }

  useEffect(() => {
    if (snapshot.status !== 'authenticated' || !searchParams.has('token')) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('token');
    setSearchParams(nextParams, {
      replace: true,
      state: { invitationTokenScrubbed: true },
    });
  }, [snapshot.status, searchParams, setSearchParams]);

  if (snapshot.status !== 'authenticated') {
    if (snapshot.status === 'initializing') {
      return (
        <section className="space-y-6">
          <PageHeader />
          <LoadingState label={messages.session.verifying} />
        </section>
      );
    }

    if (snapshot.status === 'unable-to-verify') {
      return (
        <section className="space-y-6">
          <PageHeader />
          <ErrorState
            headingLevel="h3"
            title={messages.session.unableTitle}
            description={messages.session.unableDescription}
            onRetry={() => void controller.initialize()}
          />
        </section>
      );
    }

    return <UnauthenticatedGate tokenState={tokenState} />;
  }

  if (activeMode === 'invitation' && tokenState.status !== 'absent') {
    return (
      <InvitationTokenSection
        key={
          tokenState.status === 'valid'
            ? `inv:${tokenState.token}`
            : 'inv:invalid'
        }
        tokenState={tokenState}
        userId={snapshot.user.id}
        userEmail={snapshot.user.email}
        onSwitchToCode={() => setActiveMode('code')}
      />
    );
  }

  return (
    <JoinByCodeSection
      userId={snapshot.user.id}
      canReturnToInvitation={tokenState.status === 'valid'}
      onReturnToInvitation={() => setActiveMode('invitation')}
    />
  );
}
