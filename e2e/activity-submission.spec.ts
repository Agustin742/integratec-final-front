import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';

const apiOrigin = 'https://api.example.invalid';
const downloadOrigin = 'https://files.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000141';
const activityId = '00000000-0000-4000-8000-000000005501';
const submissionId = '00000000-0000-4000-8000-000000006601';
const submissionFileId = '00000000-0000-4000-8000-000000006611';
const submittedFileName = 'entrega.pdf';
const signedDownloadUrl = `${downloadOrigin}/submissions/${submissionId}/${submittedFileName}?token=synthetic-signed`;
const forbiddenDiagnostic = 'Private synthetic diagnostic must never render';

const ownSubmissionUrl = `${apiOrigin}/activities/${activityId}/submissions/me`;
const submitUrl = `${apiOrigin}/activities/${activityId}/submissions`;

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'estudiante@example.test',
  displayName: 'Sofía Martínez',
  avatar: {
    bodyId: 'female',
    hairId: 'classic-short',
    topId: 'basic-tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

const classroomContext: components['schemas']['ClassroomContextResponseDto'] = {
  id: classroomId,
  name: '3.º Año B - Matemática',
  subject: 'Álgebra',
  schoolId: null,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  tutorBotSkin: 'none',
  myRole: 'STUDENT',
  capabilities: ['participate_activities', 'view_metrics'],
  availablePanels: ['activities'],
  deskCount: 12,
  pet: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

/** Minimal valid-looking PDF bytes for `setInputFiles`; the client pre-checks name and size only. */
const minimalPdf = Buffer.from(
  [
    '%PDF-1.4',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 160 160] >>\nendobj',
    'trailer\n<< /Size 4 /Root 1 0 R >>',
    '%%EOF',
  ].join('\n'),
  'utf-8',
);

async function setupAuthSession(page: Page) {
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];

  await page.exposeFunction('__recordCspViolation__', (directive: string) => {
    cspViolations.push(directive);
  });
  await page.addInitScript(() => {
    const tabOwner = '00000000-0000-4000-8000-000000000002';
    window.name = `\n[integratec-tab:${tabOwner}]`;
    sessionStorage.setItem(
      'integratec.session',
      JSON.stringify({
        accessToken: 'synthetic-access',
        refreshToken: 'synthetic-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + 900_000,
        tabOwner,
      }),
    );
    document.addEventListener('securitypolicyviolation', (event) => {
      const record = (
        window as unknown as {
          __recordCspViolation__?: (directive: string) => void;
        }
      ).__recordCspViolation__;
      record?.(event.violatedDirective);
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.route(`${apiOrigin}/users/me`, (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route(`${apiOrigin}/notifications**`, (route) =>
    route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/context-events`,
    (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: '',
      }),
  );

  return { cspViolations, pageErrors };
}

function errorEnvelope(
  code: components['schemas']['ErrorCode'],
  message: string,
): components['schemas']['ErrorEnvelope'] {
  return {
    error: { code, message, correlationId: 'synthetic-submission-request' },
  };
}

function buildActivity(options: {
  readonly dueAt: string;
  readonly allowLate: boolean;
}): components['schemas']['ActivitySummaryDto'] {
  const now = Date.now();
  return {
    id: activityId,
    classroomId,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Sistemas de ecuaciones',
    description: 'Resolver los cinco problemas y adjuntar el PDF.',
    opensAt: null,
    dueAt: options.dueAt,
    allowLate: options.allowLate,
    maxScore: 100,
    weightMultiplier: 1.5,
    publishedAt: new Date(now - 86_400_000).toISOString(),
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: new Date(now - 2 * 86_400_000).toISOString(),
    updatedAt: new Date(now - 86_400_000).toISOString(),
  };
}

function submissionResponse(
  isLate: boolean,
): components['schemas']['SubmissionResponseDto'] {
  return {
    id: submissionId,
    activityId,
    submittedAt: '2026-11-18T12:30:00.000Z',
    isLate,
    autoScore: null,
    status: 'submitted',
    files: [
      {
        id: submissionFileId,
        originalName: submittedFileName,
        contentType: 'application/pdf',
        sizeBytes: minimalPdf.byteLength,
        position: 0,
      },
    ],
    answers: [],
  };
}

function storedSubmission(
  isLate: boolean,
): components['schemas']['SubmissionDownloadResponseDto'] {
  return {
    ...submissionResponse(isLate),
    files: [
      {
        id: submissionFileId,
        originalName: submittedFileName,
        contentType: 'application/pdf',
        sizeBytes: minimalPdf.byteLength,
        position: 0,
        downloadUrl: signedDownloadUrl,
        downloadUrlExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
    ],
  };
}

async function openSubmissionTab(
  page: Page,
  activity: components['schemas']['ActivitySummaryDto'],
) {
  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({ json: classroomContext }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/activities/${activityId}`,
    (route) =>
      route.fulfill({
        json: {
          ...activity,
          questions: [],
        } satisfies components['schemas']['StudentActivityResponseDto'],
      }),
  );
  await page.goto(`./classrooms/${classroomId}/activities/${activityId}`);
  await expect(
    page.getByRole('heading', { name: 'TP 1: Sistemas de ecuaciones' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Entrega' }).click();
}

async function selectSubmissionFile(page: Page) {
  const fileInput = page.getByLabel('Elegir archivos');
  await expect(fileInput).toBeVisible();
  await fileInput.setInputFiles({
    name: submittedFileName,
    mimeType: 'application/pdf',
    buffer: minimalPdf,
  });
  await expect(
    page.getByLabel('Archivos seleccionados').getByText(submittedFileName, {
      exact: true,
    }),
  ).toBeVisible();
}

function expectHealthyPage(
  cspViolations: readonly string[],
  pageErrors: readonly string[],
): void {
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
}

test('student submits a file and the server-confirmed submission shows with a signed download link', async ({
  page,
  context,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  const openActivity = buildActivity({
    dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    allowLate: false,
  });

  // The read-own endpoint answers 404 until the POST has been observed, then
  // returns the stored submission with a signed download URL.
  let stored = false;
  await page.route(ownSubmissionUrl, (route) =>
    stored
      ? route.fulfill({ json: storedSubmission(false) })
      : route.fulfill({
          status: 404,
          json: errorEnvelope('NOT_FOUND', 'Sin entrega registrada'),
        }),
  );
  const idempotencyKeys: string[] = [];
  await page.route(submitUrl, (route) => {
    idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    stored = true;
    return route.fulfill({ status: 201, json: submissionResponse(false) });
  });

  await openSubmissionTab(page, openActivity);

  const submitButton = page.getByRole('button', { name: 'Enviar entrega' });
  await expect(submitButton).toBeDisabled();
  await selectSubmissionFile(page);
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByRole('heading', { name: 'Tu entrega' })).toBeVisible();
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
  await expect(
    page.getByLabel('Archivos de tu entrega').getByText(submittedFileName, {
      exact: true,
    }),
  ).toBeVisible();

  // The upload carried a client-generated idempotency key so retries reconcile.
  expect(idempotencyKeys).toHaveLength(1);
  expect(idempotencyKeys[0]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  // The read-own refetch supplies the signed URL and the link opens it.
  const downloadLink = page.getByRole('link', { name: 'Descargar' });
  await expect(downloadLink).toHaveAttribute('href', signedDownloadUrl);
  await context.route(`${downloadOrigin}/**`, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: '<!doctype html><title>entrega.pdf</title>',
    }),
  );
  const popupPromise = page.waitForEvent('popup');
  await downloadLink.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(signedDownloadUrl);
  await popup.close();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/assets/classrooms/activity-submission-${width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expectHealthyPage(cspViolations, pageErrors);
});

test('late submission shows the server outcome with the late badge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  const lateAdmittedActivity = buildActivity({
    dueAt: new Date(Date.now() - 3_600_000).toISOString(),
    allowLate: true,
  });

  let stored = false;
  await page.route(ownSubmissionUrl, (route) =>
    stored
      ? route.fulfill({ json: storedSubmission(true) })
      : route.fulfill({
          status: 404,
          json: errorEnvelope('NOT_FOUND', 'Sin entrega registrada'),
        }),
  );
  await page.route(submitUrl, (route) => {
    stored = true;
    return route.fulfill({ status: 201, json: submissionResponse(true) });
  });

  await openSubmissionTab(page, lateAdmittedActivity);
  await selectSubmissionFile(page);
  await page.getByRole('button', { name: 'Enviar entrega' }).click();

  await expect(page.getByRole('heading', { name: 'Tu entrega' })).toBeVisible();
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
  await expect(page.getByText('Entrega tardía', { exact: true })).toBeVisible();
  await expect(
    page.getByLabel('Archivos de tu entrega').getByText(submittedFileName, {
      exact: true,
    }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expectHealthyPage(cspViolations, pageErrors);
});

test('forbidden submission keeps the form and shows the forbidden copy only', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  const openActivity = buildActivity({
    dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    allowLate: false,
  });

  await page.route(ownSubmissionUrl, (route) =>
    route.fulfill({
      status: 404,
      json: errorEnvelope('NOT_FOUND', 'Sin entrega registrada'),
    }),
  );
  await page.route(submitUrl, (route) =>
    route.fulfill({
      status: 403,
      json: errorEnvelope('FORBIDDEN', forbiddenDiagnostic),
    }),
  );

  await openSubmissionTab(page, openActivity);
  await selectSubmissionFile(page);
  const submitButton = page.getByRole('button', { name: 'Enviar entrega' });
  await submitButton.click();

  await expect(
    page.getByText(
      'La entrega está disponible únicamente para alumnos del aula.',
    ),
  ).toBeVisible();
  // The server diagnostic is never rendered to the student.
  await expect(page.getByText(forbiddenDiagnostic)).toHaveCount(0);
  // The rejection keeps the safe input so the student can retry.
  await expect(page.getByLabel('Elegir archivos')).toBeVisible();
  await expect(
    page.getByLabel('Archivos seleccionados').getByText(submittedFileName, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(submitButton).toBeEnabled();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expectHealthyPage(cspViolations, pageErrors);
});

test('closed window disables submission and explains the reason', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  const closedActivity = buildActivity({
    dueAt: new Date(Date.now() - 3_600_000).toISOString(),
    allowLate: false,
  });

  await page.route(ownSubmissionUrl, (route) =>
    route.fulfill({
      status: 404,
      json: errorEnvelope('NOT_FOUND', 'Sin entrega registrada'),
    }),
  );

  await openSubmissionTab(page, closedActivity);
  await expect(page.getByLabel('Elegir archivos')).toBeVisible();
  await selectSubmissionFile(page);
  await expect(
    page.getByRole('button', { name: 'Enviar entrega' }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      'La fecha límite ya pasó y la actividad no admite entregas tardías.',
    ),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expectHealthyPage(cspViolations, pageErrors);
});

test('network failure reconciles to the server-confirmed state instead of a blind failure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  const openActivity = buildActivity({
    dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    allowLate: false,
  });

  // The aborted POST still reached the synthetic server, so reconciliation
  // must surface the stored submission rather than assume the send failed.
  let stored = false;
  await page.route(ownSubmissionUrl, (route) =>
    stored
      ? route.fulfill({ json: storedSubmission(false) })
      : route.fulfill({
          status: 404,
          json: errorEnvelope('NOT_FOUND', 'Sin entrega registrada'),
        }),
  );
  await page.route(submitUrl, (route) => {
    stored = true;
    return route.abort();
  });

  await openSubmissionTab(page, openActivity);
  await selectSubmissionFile(page);
  await page.getByRole('button', { name: 'Enviar entrega' }).click();

  await expect(
    page.getByText('Verificamos con el servidor: tu entrega quedó registrada.'),
  ).toBeVisible();
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
  await expect(
    page.getByLabel('Archivos de tu entrega').getByText(submittedFileName, {
      exact: true,
    }),
  ).toBeVisible();
  // No blind-failure copy remains on screen after reconciliation.
  await expect(
    page.getByText('No pudimos confirmar tu entrega', { exact: true }),
  ).toHaveCount(0);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expectHealthyPage(cspViolations, pageErrors);
});
