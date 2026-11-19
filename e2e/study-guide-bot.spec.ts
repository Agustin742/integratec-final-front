import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000154';

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'estudiante@example.test',
  displayName: 'Sofía Martínez',
  avatar: {
    bodyId: 'female',
    hairId: 'original',
    topId: 'tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
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

test('student asks Study Guide Bot with citations, experiences exam lockout, and captures responsive views', async ({
  page,
}, testInfo) => {
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({
      json: {
        id: classroomId,
        name: '3.º Año B - Matemática',
        subject: null,
        schoolId: null,
        independentTeacherId: null,
        adultMode: false,
        chatMuted: false,
        collaborationLocked: false,
        gamesDisabled: false,
        myRole: 'STUDENT',
        capabilities: ['participate_activities', 'view_metrics'],
        availablePanels: ['bot'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      } satisfies components['schemas']['ClassroomContextResponseDto'],
    }),
  );

  let examLocked = false;
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/bot/status`,
    (route) =>
      route.fulfill({
        json: examLocked
          ? {
              available: false,
              reason: 'exam_in_progress',
              message:
                'El asistente está pausado porque tenés un examen en curso.',
            }
          : {
              available: true,
              reason: null,
              message: null,
            },
      }),
  );

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/bot/messages`,
    async (route) => {
      if (examLocked) {
        await route.fulfill({
          status: 409,
          json: {
            code: 'CONFLICT',
            message:
              'El asistente está pausado porque tenés un examen en curso.',
            correlationId: 'req-e2e-bot-409',
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          id: 'bot-e2e-1',
          answer:
            'Una fracción equivalente representa la misma proporción. Revisá los ejemplos de la guía.',
          outcome: 'answered',
          citations: [
            {
              materialId: '00000000-0000-4000-8000-000000001001',
              filename: 'guia-fracciones.pdf',
              excerpt: 'Sección 2: equivalencias.',
            },
          ],
          createdAt: '2026-11-19T02:25:00.000Z',
        },
      });
    },
  );

  await page.goto(`./classrooms/${classroomId}/panels/bot`);
  const dialog = page.getByRole('dialog', {
    name: 'Asistente de estudio',
    exact: true,
  });

  const composer = dialog.getByLabel('Tu consulta para el asistente');
  await expect(composer).toBeVisible();
  await composer.fill('¿Qué es una fracción equivalente?');
  await dialog.getByRole('button', { name: 'Enviar consulta' }).click();

  await expect(
    dialog.getByText(/Una fracción equivalente representa la misma proporción/),
  ).toBeVisible();
  await expect(dialog.getByText('guia-fracciones.pdf')).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  if (testInfo.project.name === 'desktop') {
    await page.screenshot({
      path: 'docs/assets/classrooms/study-guide-bot-1280.png',
      fullPage: false,
    });
  } else if (testInfo.project.name === 'mobile') {
    await page.screenshot({
      path: 'docs/assets/classrooms/study-guide-bot-360.png',
      fullPage: false,
    });
  }

  examLocked = true;
  await composer.fill('Segunda consulta durante examen');
  await dialog.getByRole('button', { name: 'Enviar consulta' }).click();
  await expect(
    dialog.getByText('Asistente pausado durante el examen'),
  ).toBeVisible();
  await expect(composer).toBeDisabled();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
