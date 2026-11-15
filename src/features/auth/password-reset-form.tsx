import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  buildAuthReturnHref,
  LOGIN_PATH,
  PASSWORD_RESET_PATH,
} from '@/app/router/return-target';
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
import { useSessionService } from '@/session/provider';
import { authMessages } from './messages';
import {
  passwordResetConfirmFormSchema,
  passwordResetRequestFormSchema,
  resetTokenSchema,
  type PasswordResetConfirmFormInput,
  type PasswordResetConfirmFormOutput,
  type PasswordResetRequestFormInput,
  type PasswordResetRequestFormOutput,
} from './password-reset-schema';
import {
  confirmPasswordReset,
  requestPasswordReset,
} from './password-reset-service';

const primaryCtaLinkClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 font-display text-base font-semibold text-primary-foreground [--key:var(--key-primary)] key-bevel motion-press focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

const secondaryTextLinkClass =
  'inline-flex min-h-11 items-center rounded-sm px-1 font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

function SectionHeader({
  title,
  subtitle,
}: {
  readonly title: string;
  readonly subtitle: string;
}) {
  return (
    <div className="space-y-1.5">
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="text-sm text-pretty text-muted-foreground">{subtitle}</p>
    </div>
  );
}

interface ModeViewProps {
  readonly title: string;
  readonly searchParams: URLSearchParams;
}

interface TokenModeViewProps extends ModeViewProps {
  readonly onRequestNewLink: (event: MouseEvent<HTMLAnchorElement>) => void;
}

function PasswordResetRequestView({ title, searchParams }: ModeViewProps) {
  const { client } = useSessionService();
  const [requested, setRequested] = useState(false);
  const confirmedHeadingId = useId();
  const confirmedHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (requested) {
      confirmedHeadingRef.current?.focus();
    }
  }, [requested]);

  const form = useZodForm<
    PasswordResetRequestFormInput,
    PasswordResetRequestFormOutput
  >({
    schema: passwordResetRequestFormSchema,
    defaultValues: { email: '' },
  });

  useUnsavedChangesGuard(
    Boolean(form.formState.dirtyFields.email) && !requested,
  );

  const loginHref = buildAuthReturnHref(LOGIN_PATH, searchParams);
  const copy = authMessages.passwordReset.request;

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      await requestPasswordReset(client, values);
      setRequested(true);
    },
    { knownFields: ['email'] },
  );

  if (requested) {
    return (
      <section className="space-y-6">
        <SectionHeader title={title} subtitle={copy.subtitle} />

        <div role="status" aria-live="polite" className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-edge bg-tray/60 p-4">
            <Badge variant="success">{copy.confirmation.badge}</Badge>
            <Alert
              variant="info"
              role="group"
              aria-labelledby={confirmedHeadingId}
            >
              <AlertTitle
                as="h3"
                id={confirmedHeadingId}
                ref={confirmedHeadingRef}
                tabIndex={-1}
                className="outline-none"
              >
                {copy.confirmation.title}
              </AlertTitle>
              <AlertDescription>{copy.confirmation.body}</AlertDescription>
            </Alert>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              form.reset({ email: '' });
              setRequested(false);
            }}
          >
            {copy.actions.sendAnother}
          </Button>
        </div>

        <p className="border-t border-edge pt-4 text-center text-sm text-muted-foreground">
          <Link to={loginHref} className={secondaryTextLinkClass}>
            {copy.actions.backToLogin}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader title={title} subtitle={copy.subtitle} />

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <FormRootError
          form={form}
          headingLevel="h3"
          title={copy.errors.rootTitle}
        />

        <FormField
          control={form.control}
          name="email"
          label={copy.fields.email.label}
          description={copy.fields.email.description}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={copy.fields.email.placeholder}
            />
          )}
        </FormField>

        <Button type="submit" busy={isSubmitting} className="w-full">
          {isSubmitting ? copy.actions.submitting : copy.actions.submit}
        </Button>
      </form>

      <p className="border-t border-edge pt-4 text-center text-sm text-muted-foreground">
        <Link to={loginHref} className={secondaryTextLinkClass}>
          {copy.actions.backToLogin}
        </Link>
      </p>
    </section>
  );
}

function InvalidResetTokenView({
  title,
  searchParams,
  onRequestNewLink,
}: TokenModeViewProps) {
  const copy = authMessages.passwordReset.confirm;
  const headingId = useId();
  const requestNewHref = buildAuthReturnHref(PASSWORD_RESET_PATH, searchParams);
  const loginHref = buildAuthReturnHref(LOGIN_PATH, searchParams);

  return (
    <section className="space-y-6">
      <SectionHeader title={title} subtitle={copy.subtitle} />

      <Alert variant="destructive" role="alert" aria-labelledby={headingId}>
        <AlertTitle as="h3" id={headingId}>
          {copy.invalidToken.title}
        </AlertTitle>
        <AlertDescription>{copy.invalidToken.body}</AlertDescription>
      </Alert>

      <Link
        to={requestNewHref}
        className={primaryCtaLinkClass}
        onClick={onRequestNewLink}
      >
        {copy.actions.requestNewLink}
      </Link>

      <p className="border-t border-edge pt-4 text-center text-sm text-muted-foreground">
        <Link to={loginHref} className={secondaryTextLinkClass}>
          {copy.actions.goToLogin}
        </Link>
      </p>
    </section>
  );
}

function PasswordResetConfirmView({
  title,
  token,
  searchParams,
  onRequestNewLink,
}: TokenModeViewProps & { readonly token: string }) {
  const { client } = useSessionService();
  const [confirmed, setConfirmed] = useState(false);
  const [tokenRejected, setTokenRejected] = useState(false);
  const confirmedHeadingId = useId();
  const confirmedHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (confirmed) {
      confirmedHeadingRef.current?.focus();
    }
  }, [confirmed]);

  const form = useZodForm<
    PasswordResetConfirmFormInput,
    PasswordResetConfirmFormOutput
  >({
    schema: passwordResetConfirmFormSchema,
    defaultValues: { newPassword: '' },
  });

  useUnsavedChangesGuard(
    Boolean(form.formState.dirtyFields.newPassword) && !confirmed,
  );

  const loginHref = buildAuthReturnHref(LOGIN_PATH, searchParams);
  const requestNewHref = buildAuthReturnHref(PASSWORD_RESET_PATH, searchParams);
  const copy = authMessages.passwordReset.confirm;

  const clearNewPassword = () => {
    form.setValue('newPassword', '', {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      setTokenRejected(false);
      try {
        await confirmPasswordReset(client, {
          token,
          newPassword: values.newPassword,
        });
        clearNewPassword();
        setConfirmed(true);
      } catch (error) {
        clearNewPassword();
        if (error instanceof ApiError && error.kind === 'bad-request') {
          setTokenRejected(true);
        }
        throw error;
      }
    },
    { knownFields: ['newPassword'] },
  );

  if (confirmed) {
    return (
      <section className="space-y-6">
        <SectionHeader title={title} subtitle={copy.subtitle} />

        <div role="status" aria-live="polite" className="space-y-5">
          <div className="space-y-3 rounded-2xl border border-edge bg-tray/60 p-4">
            <Badge variant="success">{copy.confirmed.badge}</Badge>
            <Alert
              variant="success"
              role="group"
              aria-labelledby={confirmedHeadingId}
            >
              <AlertTitle
                as="h3"
                id={confirmedHeadingId}
                ref={confirmedHeadingRef}
                tabIndex={-1}
                className="outline-none"
              >
                {copy.confirmed.title}
              </AlertTitle>
              <AlertDescription>{copy.confirmed.body}</AlertDescription>
            </Alert>
          </div>

          <Link to={loginHref} className={primaryCtaLinkClass}>
            {copy.actions.goToLogin}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader title={title} subtitle={copy.subtitle} />

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <FormRootError
          form={form}
          headingLevel="h3"
          title={copy.errors.rootTitle}
        />

        <FormField
          control={form.control}
          name="newPassword"
          label={copy.fields.newPassword.label}
          description={copy.fields.newPassword.description}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              autoComplete="new-password"
              placeholder={copy.fields.newPassword.placeholder}
            />
          )}
        </FormField>

        <Button type="submit" busy={isSubmitting} className="w-full">
          {isSubmitting ? copy.actions.submitting : copy.actions.submit}
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-edge pt-4 text-sm text-muted-foreground">
        <Link
          to={requestNewHref}
          className={
            tokenRejected ? primaryCtaLinkClass : secondaryTextLinkClass
          }
          onClick={onRequestNewLink}
        >
          {copy.actions.requestNewLink}
        </Link>
        <Link to={loginHref} className={secondaryTextLinkClass}>
          {copy.actions.goToLogin}
        </Link>
      </div>
    </section>
  );
}

type ResetRouteState =
  | { readonly mode: 'request' }
  | { readonly mode: 'invalid' }
  | { readonly mode: 'confirm'; readonly token: string };

function parseResetRouteState(searchParams: URLSearchParams): ResetRouteState {
  if (!searchParams.has('token')) {
    return { mode: 'request' };
  }
  const rawTokens = searchParams.getAll('token');
  const parsedToken =
    rawTokens.length === 1 ? resetTokenSchema.safeParse(rawTokens[0]) : null;
  if (!parsedToken?.success) {
    return { mode: 'invalid' };
  }
  return { mode: 'confirm', token: parsedToken.data };
}

function areResetRouteStatesEqual(
  left: ResetRouteState,
  right: ResetRouteState,
): boolean {
  if (left.mode !== right.mode) {
    return false;
  }
  if (left.mode === 'confirm' && right.mode === 'confirm') {
    return left.token === right.token;
  }
  return true;
}

export interface PasswordResetFormProps {
  readonly title: string;
}

export function PasswordResetForm({ title }: PasswordResetFormProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Latch ?token= into component state before removing it from the URL so the
  // secret does not persist in location history or Referer headers (TM-006).
  // Key latching to location.key ensures an explicit reset back to request mode
  // is not overwritten while the replace-navigation transition is still settling.
  const [latchedLocationKey, setLatchedLocationKey] = useState(location.key);
  const [routeState, setRouteState] = useState<ResetRouteState>(() =>
    parseResetRouteState(searchParams),
  );

  if (location.key !== latchedLocationKey) {
    setLatchedLocationKey(location.key);
    if (searchParams.has('token')) {
      const incomingState = parseResetRouteState(searchParams);
      if (!areResetRouteStatesEqual(routeState, incomingState)) {
        setRouteState(incomingState);
      }
    }
  }

  useEffect(() => {
    if (!searchParams.has('token')) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('token');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleRequestNewLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    setRouteState({ mode: 'request' });
  };

  if (routeState.mode === 'request') {
    return (
      <PasswordResetRequestView
        key="request"
        title={title}
        searchParams={searchParams}
      />
    );
  }

  if (routeState.mode === 'invalid') {
    return (
      <InvalidResetTokenView
        key="invalid-token"
        title={title}
        searchParams={searchParams}
        onRequestNewLink={handleRequestNewLink}
      />
    );
  }

  return (
    <PasswordResetConfirmView
      key={routeState.token}
      title={title}
      token={routeState.token}
      searchParams={searchParams}
      onRequestNewLink={handleRequestNewLink}
    />
  );
}
