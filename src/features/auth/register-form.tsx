import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  buildAuthReturnHref,
  LOGIN_PATH,
  readReturnTarget,
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
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import { authMessages } from './messages';
import {
  REGISTRATION_CHOICES,
  registerFormSchema,
  toRegisterRequestDto,
  type RegisterFormInput,
  type RegisterFormOutput,
  type RegisterResponseDto,
  type RegistrationChoice,
} from './register-schema';
import { registerAccount } from './register-service';

const primaryCtaLinkClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 font-display text-base font-semibold text-primary-foreground [--key:var(--key-primary)] key-bevel motion-press focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

export interface RegisterFormProps {
  readonly title: string;
}

export function RegisterForm({ title }: RegisterFormProps) {
  const { client, controller } = useSessionService();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [confirmed, setConfirmed] = useState<RegisterResponseDto | null>(null);

  const legendDescId = useId();
  const pathGroupId = useId();
  const invitationHeadingId = useId();
  const confirmedHeadingId = useId();
  const confirmedHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (confirmed !== null) {
      confirmedHeadingRef.current?.focus();
    }
  }, [confirmed]);

  const safeReturnTarget = readReturnTarget(searchParams);
  const defaultRegistrationPath: RegistrationChoice =
    safeReturnTarget.startsWith('/invitations/accept')
      ? 'INVITEE'
      : 'INDEPENDENT_TEACHER';

  const form = useZodForm<RegisterFormInput, RegisterFormOutput>({
    schema: registerFormSchema,
    defaultValues: {
      path: defaultRegistrationPath,
      displayName: '',
      email: '',
      password: '',
      schoolName: '',
    },
  });

  const selectedPath = useWatch({
    control: form.control,
    name: 'path',
  });

  const dirtyFields = form.formState.dirtyFields;
  const hasUnsavedInputs = Boolean(
    dirtyFields.displayName ||
    dirtyFields.email ||
    dirtyFields.password ||
    (selectedPath === 'SCHOOL' && dirtyFields.schoolName),
  );

  const { confirmNavigation } = useUnsavedChangesGuard(
    hasUnsavedInputs && confirmed === null,
    { message: authMessages.actions.unsavedChanges },
  );

  const loginHref = buildAuthReturnHref(LOGIN_PATH, searchParams);

  const onValid = async (values: RegisterFormOutput): Promise<void> => {
    const dto = toRegisterRequestDto(values);
    try {
      const response = await registerAccount(client, dto);
      form.setValue('password', '', {
        shouldDirty: true,
        shouldTouch: false,
        shouldValidate: false,
      });
      if (response.session) {
        const result = await controller.adoptSession(response.session);
        if (result.ok) {
          const destination = readReturnTarget(searchParams);
          navigate(destination, { replace: true });
          return;
        }
      }
      setConfirmed(response);
    } catch (error) {
      // Never retain plaintext passwords in React state after any failure.
      form.setValue('password', '', {
        shouldDirty: true,
        shouldTouch: false,
        shouldValidate: false,
      });
      throw error;
    }
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(form, onValid, {
    knownFields: ['displayName', 'email', 'password', 'path', 'schoolName'],
  });

  const handleLeaveWithGuard = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!confirmNavigation()) {
      event.preventDefault();
    }
  };

  if (confirmed !== null) {
    return (
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {authMessages.page.subtitle}
          </p>
        </div>

        <div
          role="status"
          aria-live="polite"
          data-registration-confirmed="true"
          className="space-y-5"
        >
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
              {authMessages.confirmed.title}
            </AlertTitle>
            <AlertDescription>
              {authMessages.confirmed.subtitle}
            </AlertDescription>
          </Alert>

          <div className="space-y-4 rounded-2xl border border-edge bg-tray/60 p-4">
            <Badge variant="success">{authMessages.confirmed.badge}</Badge>
            <dl className="space-y-3 text-sm">
              <div className="space-y-0.5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {authMessages.confirmed.accountLabel}
                </dt>
                <dd className="font-semibold text-foreground">
                  {confirmed.displayName}
                </dd>
                <dd className="text-muted-foreground">{confirmed.email}</dd>
              </div>
              <div className="space-y-0.5 border-t border-edge/70 pt-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {authMessages.confirmed.structureLabel}
                </dt>
                {confirmed.path === 'SCHOOL' && confirmed.school ? (
                  <>
                    <dd className="font-semibold text-foreground">
                      {`${authMessages.confirmed.schoolTitlePrefix} ${confirmed.school.name}`}
                    </dd>
                    <dd className="text-muted-foreground">
                      {`${authMessages.confirmed.schoolTimeZonePrefix} ${confirmed.school.timeZone}`}
                    </dd>
                  </>
                ) : confirmed.path === 'INVITEE' ? (
                  <>
                    <dd className="font-semibold text-foreground">
                      {authMessages.paths.options.INVITEE.title}
                    </dd>
                    <dd className="text-muted-foreground">
                      {authMessages.paths.options.INVITEE.description}
                    </dd>
                  </>
                ) : (
                  <>
                    <dd className="font-semibold text-foreground">
                      {authMessages.confirmed.independentTitle}
                    </dd>
                    <dd className="text-muted-foreground">
                      {authMessages.confirmed.independentDetail}
                    </dd>
                  </>
                )}
              </div>
            </dl>
          </div>

          <Link to={loginHref} className={primaryCtaLinkClass}>
            {authMessages.confirmed.loginCta}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {authMessages.page.subtitle}
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        <fieldset aria-describedby={legendDescId} className="space-y-2.5">
          <legend className="text-sm font-semibold text-foreground">
            {authMessages.paths.legend}
          </legend>
          <p id={legendDescId} className="text-sm text-muted-foreground">
            {authMessages.paths.description}
          </p>

          <Controller
            control={form.control}
            name="path"
            render={({ field }) => (
              <div className="space-y-2.5 pt-1">
                {REGISTRATION_CHOICES.map((choice: RegistrationChoice) => {
                  const option = authMessages.paths.options[choice];
                  const isSelected = field.value === choice;
                  const radioId = `${pathGroupId}-${choice}`;
                  const radioTitleId = `${radioId}-title`;
                  const radioDescId = `${radioId}-desc`;
                  return (
                    <div key={choice} className="relative">
                      <input
                        id={radioId}
                        type="radio"
                        name={field.name}
                        value={choice}
                        checked={isSelected}
                        aria-labelledby={radioTitleId}
                        aria-describedby={radioDescId}
                        onBlur={field.onBlur}
                        onChange={() => {
                          field.onChange(choice);
                          form.clearErrors('root.serverError');
                          form.clearErrors('schoolName');
                        }}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor={radioId}
                        className={cn(
                          'block min-h-11 cursor-pointer rounded-2xl border-2 p-3.5 motion-safe:transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ring',
                          isSelected
                            ? 'border-primary bg-tray/80 shadow-[0_3px_0_var(--key-sand)]'
                            : 'border-edge bg-card hover:bg-tray/45',
                        )}
                      >
                        <span
                          id={radioTitleId}
                          className="flex flex-wrap items-center gap-2.5 font-display text-base font-semibold text-foreground"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                              isSelected
                                ? 'border-primary bg-card'
                                : 'border-muted-foreground/50 bg-card',
                            )}
                          >
                            {isSelected && (
                              <span className="size-2.5 rounded-full bg-primary" />
                            )}
                          </span>
                          {option.title}
                          <Badge
                            variant={isSelected ? 'default' : 'outline'}
                            className="ml-auto shrink-0 px-2.5 py-0.5 text-xs"
                          >
                            {option.badge}
                          </Badge>
                        </span>
                        <span
                          id={radioDescId}
                          className="mt-1.5 block pl-7 text-sm text-pretty text-muted-foreground"
                        >
                          {option.description}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          />
        </fieldset>

        <div className="space-y-4">
          {selectedPath === 'INVITEE' && (
            <Alert
              variant="info"
              role="region"
              aria-labelledby={invitationHeadingId}
            >
              <AlertTitle as="h3" id={invitationHeadingId}>
                {authMessages.invitationNotice.heading}
              </AlertTitle>
              <AlertDescription>
                {authMessages.invitationNotice.body}
              </AlertDescription>
            </Alert>
          )}

          <FormRootError
            form={form}
            headingLevel="h3"
            title={authMessages.errors.rootTitle}
          />

          <FormField
            control={form.control}
            name="displayName"
            label={authMessages.fields.displayName.label}
            description={authMessages.fields.displayName.description}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="text"
                autoComplete="name"
                placeholder={authMessages.fields.displayName.placeholder}
              />
            )}
          </FormField>

          <FormField
            control={form.control}
            name="email"
            label={authMessages.fields.email.label}
            description={authMessages.fields.email.description}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={authMessages.fields.email.placeholder}
              />
            )}
          </FormField>

          <FormField
            control={form.control}
            name="password"
            label={authMessages.fields.password.label}
            description={authMessages.fields.password.description}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="password"
                autoComplete="new-password"
                placeholder={authMessages.fields.password.placeholder}
              />
            )}
          </FormField>

          {selectedPath === 'SCHOOL' && (
            <FormField
              control={form.control}
              name="schoolName"
              label={authMessages.fields.schoolName.label}
              description={authMessages.fields.schoolName.description}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="text"
                  autoComplete="organization"
                  placeholder={authMessages.fields.schoolName.placeholder}
                />
              )}
            </FormField>
          )}

          <Button type="submit" busy={isSubmitting} className="w-full">
            {isSubmitting
              ? authMessages.actions.submitting
              : authMessages.actions.submit}
          </Button>
        </div>
      </form>

      <p className="border-t border-edge pt-4 text-center text-sm text-muted-foreground">
        {authMessages.actions.alreadyHaveAccount}{' '}
        <Link
          to={loginHref}
          onClick={handleLeaveWithGuard}
          className="inline-flex min-h-11 items-center rounded-sm px-1 font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
        >
          {authMessages.actions.loginLink}
        </Link>
      </p>
    </section>
  );
}
