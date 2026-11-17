import type { MouseEvent } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ApiError, type ApiErrorInit } from '@/api/errors';
import {
  buildAuthReturnHref,
  hasValidReturnTarget,
  PASSWORD_RESET_PATH,
  REGISTER_PATH,
  readReturnTarget,
} from '@/app/router/return-target';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useUnsavedChangesGuard,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LoginFailureReason } from '@/session/controller';
import { useSessionService } from '@/session/provider';
import {
  loginFormSchema,
  type LoginFormInput,
  type LoginFormOutput,
} from './login-schema';
import { authMessages } from './messages';

const LOGIN_ERROR_BY_REASON: Record<LoginFailureReason, ApiErrorInit> = {
  'invalid-credentials': {
    kind: 'unauthenticated',
    status: 401,
    code: 'UNAUTHENTICATED',
    userMessage: authMessages.login.errors.invalidCredentials,
  },
  'rate-limited': {
    kind: 'rate-limited',
    status: 429,
    code: 'TOO_MANY_REQUESTS',
    userMessage: authMessages.login.errors.rateLimited,
  },
  network: {
    kind: 'network',
    status: null,
    code: null,
    userMessage: authMessages.login.errors.network,
  },
  unexpected: {
    kind: 'unexpected',
    status: null,
    code: null,
    userMessage: authMessages.login.errors.unexpected,
  },
};

export interface LoginFormProps {
  readonly title: string;
}

export function LoginForm({ title }: LoginFormProps) {
  const { controller } = useSessionService();
  const [searchParams] = useSearchParams();

  const form = useZodForm<LoginFormInput, LoginFormOutput>({
    schema: loginFormSchema,
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const dirtyFields = form.formState.dirtyFields;
  const { confirmNavigation } = useUnsavedChangesGuard(
    Boolean(dirtyFields.email || dirtyFields.password),
  );

  const showReturnNotice =
    hasValidReturnTarget(searchParams) &&
    readReturnTarget(searchParams) !== '/';
  const forgotPasswordHref = buildAuthReturnHref(
    PASSWORD_RESET_PATH,
    searchParams,
  );
  const registerHref = buildAuthReturnHref(REGISTER_PATH, searchParams);

  const handleLeaveWithGuard = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmNavigation()) {
      event.preventDefault();
    }
  };

  const clearPasswordField = () => {
    form.setValue('password', '', {
      shouldDirty: true,
      shouldTouch: false,
      shouldValidate: false,
    });
  };

  const onValid = async (values: LoginFormOutput): Promise<void> => {
    try {
      const result = await controller.login(values);
      if (!result.ok) {
        throw new ApiError({
          ...LOGIN_ERROR_BY_REASON[result.reason],
          ...(result.reason !== 'invalid-credentials'
            ? {
                fieldErrors: result.fieldErrors,
                correlationId: result.correlationId,
              }
            : {}),
        });
      }
    } finally {
      clearPasswordField();
    }
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(form, onValid);

  return (
    <section className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {authMessages.login.subtitle}
        </p>
      </div>

      {showReturnNotice && (
        <Alert variant="info">
          <AlertDescription>
            {authMessages.login.returnContextNotice}
          </AlertDescription>
        </Alert>
      )}

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <FormRootError
          form={form}
          headingLevel="h3"
          title={authMessages.login.errors.rootTitle}
        />

        <FormField
          control={form.control}
          name="email"
          label={authMessages.login.fields.email.label}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={authMessages.login.fields.email.placeholder}
            />
          )}
        </FormField>

        <FormField
          control={form.control}
          name="password"
          label={authMessages.login.fields.password.label}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              autoComplete="current-password"
              placeholder={authMessages.login.fields.password.placeholder}
            />
          )}
        </FormField>

        <div className="flex justify-end">
          <Link
            to={forgotPasswordHref}
            onClick={handleLeaveWithGuard}
            className="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            {authMessages.login.actions.forgotPasswordLink}
          </Link>
        </div>

        <Button type="submit" busy={isSubmitting} className="w-full">
          {isSubmitting
            ? authMessages.login.actions.submitting
            : authMessages.login.actions.submit}
        </Button>
      </form>

      <p className="border-t border-edge pt-4 text-center text-sm text-muted-foreground">
        {authMessages.login.actions.noAccountPrompt}{' '}
        <Link
          to={registerHref}
          onClick={handleLeaveWithGuard}
          className="inline-flex min-h-11 items-center rounded-sm px-1 font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
        >
          {authMessages.login.actions.registerLink}
        </Link>
      </p>
    </section>
  );
}
