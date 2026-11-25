import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';

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

/** Due student review with a daily question, as the backend (#42) will deliver it. */
const dueStudentReview = {
  status: 'due',
  audience: 'STUDENT',
  contentKind: 'generated',
  summary:
    'Buen día, Sofía. Tenés dos actividades pendientes y una calificación nueva.',
  sections: [
    {
      kind: 'pending',
      items: [
        {
          kind: 'pending_activity',
          title: 'Trabajo práctico de fotosíntesis',
          classroomName: 'Biología 3°B',
          dueAt: '2026-11-20T23:59:00.000Z',
          detail: null,
        },
      ],
    },
    {
      kind: 'news',
      items: [
        {
          kind: 'recent_grade',
          title: 'Examen de sistemas circulatorio',
          classroomName: 'Biología 3°B',
          dueAt: null,
          detail: '9/10',
        },
      ],
    },
  ],
  dailyQuestion: {
    id: 'question-e2e-1',
    prompt: '¿Qué organelo realiza la fotosíntesis?',
    options: ['Mitocondria', 'Cloroplasto', 'Ribosoma'],
    materialTitle: 'guia-fotosintesis.pdf',
  },
};

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
  await page.route(`${apiOrigin}/notifications`, (route) =>
    route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } }),
  );
  await page.route(`${apiOrigin}/me/classrooms`, (route) =>
    route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } }),
  );
  await page.route(`${apiOrigin}/users/me/streak-and-badges`, (route) =>
    route.fulfill({
      json: {
        currentStreak: 4,
        bestStreak: 9,
        lastQualifiedDate: '2026-11-18',
        badges: [],
      },
    }),
  );

  return { cspViolations, pageErrors };
}

test('student receives the daily review once, answers the daily question, and sees no repeat after reload', async ({
  page,
}, testInfo) => {
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  // The route keeps the server-side once-per-day record: the first GET
  // delivers the review, later GETs answer `not_due`.
  let delivered = false;
  await page.route(`${apiOrigin}/users/me/daily-review`, (route) => {
    if (delivered) {
      return route.fulfill({ json: { status: 'not_due' } });
    }
    delivered = true;
    return route.fulfill({ json: dueStudentReview });
  });

  await page.route(
    `${apiOrigin}/users/me/daily-review/daily-question`,
    (route) =>
      route.fulfill({
        json: {
          correct: true,
          feedback: '¡Correcto! El cloroplasto realiza la fotosíntesis.',
          streak: {
            currentStreak: 5,
            bestStreak: 9,
            lastQualifiedDate: '2026-11-19',
          },
        },
      }),
  );

  await page.goto('./');
  const dialog = page.getByRole('dialog', { name: 'Tu repaso diario' });

  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(/Tenés dos actividades pendientes/),
  ).toBeVisible();
  await expect(
    dialog.getByText('Trabajo práctico de fotosíntesis'),
  ).toBeVisible();
  await expect(
    dialog.getByText('Examen de sistemas circulatorio'),
  ).toBeVisible();

  await dialog.getByRole('radio', { name: 'Cloroplasto' }).check();
  await dialog.getByRole('button', { name: 'Responder' }).click();
  await expect(dialog.getByText('¡Respuesta correcta!')).toBeVisible();
  await expect(dialog.getByText(/Tu racha llegó a 5 días/)).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  if (testInfo.project.name === 'desktop') {
    await page.screenshot({
      path: 'docs/assets/daily-review/daily-review-1280.png',
      fullPage: false,
    });
  } else if (testInfo.project.name === 'mobile') {
    await page.screenshot({
      path: 'docs/assets/daily-review/daily-review-360.png',
      fullPage: false,
    });
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const secondReviewFetch = page.waitForRequest(
    (request) =>
      request.url() === `${apiOrigin}/users/me/daily-review` &&
      request.method() === 'GET',
  );
  await page.reload();
  await secondReviewFetch;

  await expect(
    page.getByRole('heading', { level: 2, name: 'Mis aulas' }),
  ).toBeVisible();
  await expect(dialog).toBeHidden();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
