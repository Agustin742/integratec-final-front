import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { apiErrorMessages } from '@/api/messages';
import { fakeSession } from '@/app/router/fake-session';
import { createAppRoutes } from '@/app/router/routes';
import { SessionProvider } from '@/session/provider';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createErrorEnvelopeResponse,
  createRegisterHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import '@/app/pages/register-page';
import { authMessages } from './messages';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

function renderRegisterRoute(initialEntry = '/register') {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const { service } = fakeSession({ status: 'unauthenticated' }, client);
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [initialEntry],
  });

  return {
    router,
    ...render(
      <SessionProvider service={service}>
        <RouterProvider router={router} />
      </SessionProvider>,
    ),
  };
}

function findMainRegion() {
  return screen.findByRole('main');
}

describe('RegisterPage (/register)', () => {
  test('renders path choices and completes INDEPENDENT_TEACHER registration after server confirmation (preserving safe ?next=)', async () => {
    let resolveResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      resolveResponse = resolve;
    });
    let receivedBody: unknown;

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, async ({ request }) => {
        receivedBody = await request.json();
        await responseGate;
        return HttpResponse.json(
          {
            id: 'user-1',
            email: 'sofia@example.com',
            displayName: 'Sofía Martínez',
            path: 'INDEPENDENT_TEACHER',
            createdAt: '2026-11-14T12:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const { container } = renderRegisterRoute('/register?next=%2F');
    const main = await findMainRegion();

    await waitFor(() => {
      expect(
        within(main).getByRole('heading', { level: 2, name: 'Crear cuenta' }),
      ).toBeInTheDocument();
    });

    await expectAccessible(container);

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Sofía Martínez' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'Sofia@Example.com' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.password.label),
      { target: { value: 'ClaveSegura123' } },
    );

    const submitButton = within(main).getByRole('button', {
      name: authMessages.actions.submit,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const busyButton = within(main).getByRole('button', {
        name: authMessages.actions.submitting,
      });
      expect(busyButton).toHaveAttribute('aria-busy', 'true');
    });

    // Confirmation view MUST NOT appear before server returns 201 Created.
    expect(
      within(main).queryByText(authMessages.confirmed.independentTitle),
    ).not.toBeInTheDocument();

    resolveResponse();

    await waitFor(() => {
      const statusRegion = within(main).getByRole('status');
      expect(statusRegion).toBeInTheDocument();
      expect(
        within(statusRegion).getByText(authMessages.confirmed.independentTitle),
      ).toBeInTheDocument();
      expect(
        within(statusRegion).getByText('Sofía Martínez'),
      ).toBeInTheDocument();
      expect(
        within(statusRegion).getByText('sofia@example.com'),
      ).toBeInTheDocument();
      expect(
        within(statusRegion).getByRole('heading', {
          level: 3,
          name: authMessages.confirmed.title,
        }),
      ).toHaveFocus();
    });

    expect(window.sessionStorage.length).toBe(0);

    const loginCta = within(main).getByRole('link', {
      name: authMessages.confirmed.loginCta,
    });
    expect(loginCta).toHaveAttribute('href', '/login?next=%2F');
    expect(receivedBody).toEqual({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Sofía Martínez',
      email: 'sofia@example.com',
      password: 'ClaveSegura123',
    });

    await expectAccessible(container);
  });

  test('strips unsafe external ?next= parameter from login links', async () => {
    mswServer.use(createRegisterHandler());

    renderRegisterRoute('/register?next=https%3A%2F%2Fevil.example%2Fphish');
    const main = await findMainRegion();

    const footerLoginLink = within(main).getByRole('link', {
      name: authMessages.actions.loginLink,
    });
    expect(footerLoginLink).toHaveAttribute('href', '/login');

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Sofía Martínez' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'sofia@example.com' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.password.label),
      { target: { value: 'ClaveSegura123' } },
    );
    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      const loginCta = within(main).getByRole('link', {
        name: authMessages.confirmed.loginCta,
      });
      expect(loginCta).toHaveAttribute('href', '/login');
    });
  });

  test('requires schoolName when SCHOOL is selected and confirms created school only after 201', async () => {
    let submittedBody: unknown;

    mswServer.use(
      createRegisterHandler({
        onRequest: (_request, body) => {
          submittedBody = body;
        },
      }),
    );

    renderRegisterRoute('/register');
    const main = await findMainRegion();

    expect(
      within(main).queryByLabelText(authMessages.fields.schoolName.label),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(main).getByRole('radio', {
        name: new RegExp(authMessages.paths.options.SCHOOL.title, 'i'),
      }),
    );

    const schoolInput = within(main).getByLabelText(
      authMessages.fields.schoolName.label,
    );
    expect(schoolInput).toBeInTheDocument();

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Carlos Gómez' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'carlos@escuela.edu.ar' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.password.label),
      { target: { value: 'ClaveSegura123' } },
    );
    fireEvent.change(schoolInput, {
      target: { value: 'Escuela Técnica N.º 4' },
    });

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      const statusRegion = within(main).getByRole('status');
      expect(
        within(statusRegion).getByText(
          `${authMessages.confirmed.schoolTitlePrefix} Escuela Técnica N.º 4`,
        ),
      ).toBeInTheDocument();
    });

    expect(submittedBody).toEqual({
      path: 'SCHOOL',
      displayName: 'Carlos Gómez',
      email: 'carlos@escuela.edu.ar',
      password: 'ClaveSegura123',
      schoolName: 'Escuela Técnica N.º 4',
    });
  });

  test('shows field-level accessible errors and skips network call on invalid client input', async () => {
    let networkCalls = 0;
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () => {
        networkCalls += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { container } = renderRegisterRoute('/register');
    const main = await findMainRegion();

    fireEvent.click(
      within(main).getByRole('radio', {
        name: new RegExp(authMessages.paths.options.SCHOOL.title, 'i'),
      }),
    );

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'correo-invalido' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.password.label),
      { target: { value: 'corta' } },
    );

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      expect(
        within(main).getByText(authMessages.validation.displayNameRequired),
      ).toBeInTheDocument();
      expect(
        within(main).getByText(authMessages.validation.emailInvalid),
      ).toBeInTheDocument();
      expect(
        within(main).getByText(authMessages.validation.passwordMin),
      ).toBeInTheDocument();
      expect(
        within(main).getByText(authMessages.validation.schoolNameRequired),
      ).toBeInTheDocument();
    });

    expect(
      within(main).getByLabelText(authMessages.fields.email.label),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(within(main).getAllByRole('alert').length).toBeGreaterThanOrEqual(4);
    expect(networkCalls).toBe(0);

    await expectAccessible(container);
  });

  test('on 409 existing email shows clear non-duplicate error on email, preserves non-secret fields, and clears password', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(409, {
          code: 'CONFLICT',
          message: 'A user with this email address already exists',
          correlationId: 'corr-409',
        }),
      ),
    );

    const { container } = renderRegisterRoute('/register');
    const main = await findMainRegion();

    const nameInput = within(main).getByLabelText(
      authMessages.fields.displayName.label,
    ) as HTMLInputElement;
    const emailInput = within(main).getByLabelText(
      authMessages.fields.email.label,
    ) as HTMLInputElement;
    const passwordInput = within(main).getByLabelText(
      authMessages.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'Sofía Martínez' } });
    fireEvent.change(emailInput, { target: { value: 'sofia@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      expect(
        within(main).getByText(authMessages.errors.emailConflict),
      ).toBeInTheDocument();
    });

    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput.value).toBe('Sofía Martínez');
    expect(emailInput.value).toBe('sofia@example.com');
    expect(passwordInput.value).toBe('');
    expect(within(main).queryByRole('status')).not.toBeInTheDocument();

    await expectAccessible(container);
  });

  test('maps 400 VALIDATION_FAILED server field errors and clears password', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(400, {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          correlationId: 'corr-400',
          details: [
            {
              field: 'schoolName',
              messages: ['Ese nombre institucional requiere revisión.'],
            },
          ],
        }),
      ),
    );

    renderRegisterRoute('/register');
    const main = await findMainRegion();

    fireEvent.click(
      within(main).getByRole('radio', {
        name: new RegExp(authMessages.paths.options.SCHOOL.title, 'i'),
      }),
    );

    const schoolInput = within(main).getByLabelText(
      authMessages.fields.schoolName.label,
    ) as HTMLInputElement;
    const passwordInput = within(main).getByLabelText(
      authMessages.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Carlos Gómez' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'carlos@escuela.edu.ar' } },
    );
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });
    fireEvent.change(schoolInput, { target: { value: 'Escuela Central' } });

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      expect(
        within(main).getByText('Ese nombre institucional requiere revisión.'),
      ).toBeInTheDocument();
    });

    expect(schoolInput).toHaveAttribute('aria-invalid', 'true');
    expect(schoolInput.value).toBe('Escuela Central');
    expect(passwordInput.value).toBe('');
  });

  test('shows uncertainty-aware root error on 500 without claiming rollback or confirming creation, and clears password', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(500, {
          code: 'INTERNAL_ERROR',
          message: 'Database timeout',
          correlationId: 'corr-500',
        }),
      ),
    );

    renderRegisterRoute('/register');
    const main = await findMainRegion();

    const emailInput = within(main).getByLabelText(
      authMessages.fields.email.label,
    ) as HTMLInputElement;
    const passwordInput = within(main).getByLabelText(
      authMessages.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Lucía Fernández' } },
    );
    fireEvent.change(emailInput, { target: { value: 'lucia@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      const alertText = within(main).getByText(authMessages.errors.unexpected);
      expect(alertText).toBeInTheDocument();
      expect(alertText.textContent).toMatch(
        /No pudimos confirmar si se completó el registro/,
      );
    });

    expect(
      within(main).queryByText(/No se guardó ninguna estructura/i),
    ).not.toBeInTheDocument();
    expect(within(main).queryByRole('status')).not.toBeInTheDocument();
    expect(
      within(main).queryByText(authMessages.confirmed.independentTitle),
    ).not.toBeInTheDocument();
    expect(emailInput.value).toBe('lucia@example.com');
    expect(passwordInput.value).toBe('');
  });

  test('shows uncertainty-aware network error without claiming the write did not happen, keeps form editable, and clears password', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        HttpResponse.error(),
      ),
    );

    renderRegisterRoute('/register');
    const main = await findMainRegion();

    const emailInput = within(main).getByLabelText(
      authMessages.fields.email.label,
    ) as HTMLInputElement;
    const passwordInput = within(main).getByLabelText(
      authMessages.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Lucía Fernández' } },
    );
    fireEvent.change(emailInput, { target: { value: 'lucia@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      const alertText = within(main).getByText(
        authMessages.errors.networkUncertain,
      );
      expect(alertText).toBeInTheDocument();
      expect(alertText.textContent).toMatch(
        /No pudimos confirmar si se completó el registro/,
      );
      expect(alertText.textContent).toMatch(/probá iniciar sesión/i);
    });

    expect(
      within(main).queryByText(apiErrorMessages.network),
    ).not.toBeInTheDocument();
    expect(within(main).queryByRole('status')).not.toBeInTheDocument();
    expect(emailInput.value).toBe('lucia@example.com');
    expect(passwordInput.value).toBe('');
  });

  test('rejects malformed 201 response (SCHOOL without school object) without showing confirmed view and clears password', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        HttpResponse.json(
          {
            id: 'user-2',
            email: 'carlos@escuela.edu.ar',
            displayName: 'Carlos Gómez',
            path: 'SCHOOL',
            createdAt: '2026-11-14T12:00:00.000Z',
          },
          { status: 201 },
        ),
      ),
    );

    renderRegisterRoute('/register');
    const main = await findMainRegion();

    fireEvent.click(
      within(main).getByRole('radio', {
        name: new RegExp(authMessages.paths.options.SCHOOL.title, 'i'),
      }),
    );

    const passwordInput = within(main).getByLabelText(
      authMessages.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Carlos Gómez' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'carlos@escuela.edu.ar' } },
    );
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.schoolName.label),
      { target: { value: 'Escuela Técnica N.º 4' } },
    );

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      expect(
        within(main).getByText(authMessages.errors.invalidResponse),
      ).toBeInTheDocument();
    });

    expect(within(main).queryByRole('status')).not.toBeInTheDocument();
    expect(passwordInput.value).toBe('');
  });

  test('maps 409 school slug conflict to root conflict error, preserves schoolName, and clears password', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(409, {
          code: 'CONFLICT',
          message: 'School slug already reserved',
          correlationId: 'corr-409-slug',
        }),
      ),
    );

    renderRegisterRoute('/register');
    const main = await findMainRegion();

    fireEvent.click(
      within(main).getByRole('radio', {
        name: new RegExp(authMessages.paths.options.SCHOOL.title, 'i'),
      }),
    );

    const schoolInput = within(main).getByLabelText(
      authMessages.fields.schoolName.label,
    ) as HTMLInputElement;
    const passwordInput = within(main).getByLabelText(
      authMessages.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Carlos Gómez' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'carlos@escuela.edu.ar' } },
    );
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });
    fireEvent.change(schoolInput, { target: { value: 'Escuela Central' } });

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      expect(
        within(main).getByText(authMessages.errors.slugConflict),
      ).toBeInTheDocument();
    });

    expect(schoolInput).not.toHaveAttribute('aria-invalid', 'true');
    expect(schoolInput.value).toBe('Escuela Central');
    expect(passwordInput.value).toBe('');
    expect(within(main).queryByRole('status')).not.toBeInTheDocument();
  });

  test('shows rate-limit root error on 429 and clears password', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(429, {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded',
          correlationId: 'corr-429',
        }),
      ),
    );

    renderRegisterRoute('/register');
    const main = await findMainRegion();

    const passwordInput = within(main).getByLabelText(
      authMessages.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Lucía Fernández' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'lucia@example.com' } },
    );
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      expect(
        within(main).getByText(apiErrorMessages.rateLimited),
      ).toBeInTheDocument();
    });

    expect(within(main).queryByRole('status')).not.toBeInTheDocument();
    expect(passwordInput.value).toBe('');
  });

  test('guards unsaved changes on navigation and clears dirty state after password reset or path switch', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(500, {
          code: 'INTERNAL_ERROR',
          message: 'Server error',
          correlationId: 'corr-500-dirty',
        }),
      ),
    );

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { router } = renderRegisterRoute('/register');
    const main = await findMainRegion();

    const nameInput = within(main).getByLabelText(
      authMessages.fields.displayName.label,
    ) as HTMLInputElement;
    const emailInput = within(main).getByLabelText(
      authMessages.fields.email.label,
    ) as HTMLInputElement;
    const passwordInput = within(main).getByLabelText(
      authMessages.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'Sofía Martínez' } });
    fireEvent.change(emailInput, { target: { value: 'sofia@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });

    // Triggering navigation while dirty cancels when confirm() returns false.
    fireEvent.click(
      within(main).getByRole('link', { name: authMessages.actions.loginLink }),
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      authMessages.actions.unsavedChanges,
    );
    expect(router.state.location.pathname).toBe('/register');

    confirmSpy.mockClear();

    // Failing submit clears password with shouldDirty: true; emptying remaining fields leaves form clean.
    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );
    await waitFor(() => {
      expect(
        within(main).getByText(authMessages.errors.unexpected),
      ).toBeInTheDocument();
    });
    expect(passwordInput.value).toBe('');

    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.change(emailInput, { target: { value: '' } });

    // Typing schoolName under SCHOOL and switching back to INDEPENDENT_TEACHER also keeps dirty state inactive.
    fireEvent.click(
      within(main).getByRole('radio', {
        name: new RegExp(authMessages.paths.options.SCHOOL.title, 'i'),
      }),
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.schoolName.label),
      { target: { value: 'Escuela Temporal' } },
    );
    fireEvent.click(
      within(main).getByRole('radio', {
        name: new RegExp(
          authMessages.paths.options.INDEPENDENT_TEACHER.title,
          'i',
        ),
      }),
    );

    fireEvent.click(
      within(main).getByRole('link', { name: authMessages.actions.loginLink }),
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });

  test('guards against duplicate submission on rapid double click while request is in flight', async () => {
    let requestCount = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, async () => {
        requestCount += 1;
        await gate;
        return HttpResponse.json(
          {
            id: 'user-1',
            email: 'sofia@example.com',
            displayName: 'Sofía',
            path: 'INDEPENDENT_TEACHER',
            createdAt: '2026-11-14T12:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    renderRegisterRoute('/register');
    const main = await findMainRegion();

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Sofía' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'sofia@example.com' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.password.label),
      { target: { value: 'ClaveSegura123' } },
    );

    const submitButton = within(main).getByRole('button', {
      name: authMessages.actions.submit,
    });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(requestCount).toBe(1);
    });

    release();

    await waitFor(() => {
      expect(within(main).getByRole('status')).toBeInTheDocument();
    });
    expect(requestCount).toBe(1);
  });

  test('INVITEE choice shows registration inputs and notice, and auto-authenticates into ?next= destination upon 201', async () => {
    let receivedBody: unknown;
    mswServer.use(
      createRegisterHandler({
        onRequest: (_req, body) => {
          receivedBody = body;
        },
        response: {
          path: 'INVITEE',
          session: {
            accessToken: 'session-access-token',
            refreshToken: 'session-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        },
      }),
      http.get(`${TEST_API_BASE_URL}/users/me`, () => {
        return HttpResponse.json({
          id: 'user-test-1',
          email: 'lucas@example.com',
          displayName: 'Lucas Alumno',
          avatar: {
            bodyId: 'male',
            hairId: 'afro',
            topId: 'hoodie',
            hairColor: '#6C4D48',
            clothingColor: '#5B4F96',
          },
        });
      }),
    );

    const { container, router } = renderRegisterRoute(
      '/register?next=%2Finvitations%2Faccept%3Ftoken%3Dtest-token',
    );
    const main = await findMainRegion();

    fireEvent.click(
      within(main).getByRole('radio', {
        name: new RegExp(authMessages.paths.options.INVITEE.title, 'i'),
      }),
    );

    expect(
      within(main).getByLabelText(authMessages.fields.displayName.label),
    ).toBeInTheDocument();
    expect(
      within(main).getByLabelText(authMessages.fields.email.label),
    ).toBeInTheDocument();
    expect(
      within(main).getByLabelText(authMessages.fields.password.label),
    ).toBeInTheDocument();
    expect(
      within(main).queryByLabelText(authMessages.fields.schoolName.label),
    ).not.toBeInTheDocument();
    expect(
      within(main).getByText(authMessages.invitationNotice.heading),
    ).toBeInTheDocument();

    await expectAccessible(container);

    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.displayName.label),
      { target: { value: 'Lucas Alumno' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.email.label),
      { target: { value: 'lucas@example.com' } },
    );
    fireEvent.change(
      within(main).getByLabelText(authMessages.fields.password.label),
      { target: { value: 'ClaveSegura123' } },
    );

    fireEvent.click(
      within(main).getByRole('button', { name: authMessages.actions.submit }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/invitations/accept');
      expect(router.state.location.search).toBe('?token=test-token');
    });

    expect(receivedBody).toEqual({
      path: 'INVITEE',
      displayName: 'Lucas Alumno',
      email: 'lucas@example.com',
      password: 'ClaveSegura123',
    });
  });
});
