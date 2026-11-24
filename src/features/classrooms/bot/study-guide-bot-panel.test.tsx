import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  TEST_API_BASE_URL,
  createClassroomBotStore,
  createClassroomDetailHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { botMessages } from './messages';
import { StudyGuideBotPanel } from './study-guide-bot-panel';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';

type Role = components['schemas']['ClassroomContextResponseDto']['myRole'];

function renderBotPanel(options: { readonly role?: Role } = {}) {
  const role = options.role ?? 'STUDENT';
  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      myRole: role,
      capabilities:
        role === 'PARENT' ? [] : ['participate_activities', 'view_metrics'],
    }),
  );

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: <StudyGuideBotPanel />,
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
  );

  return {
    queryClient,
    ...render(
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>
          <RouterProvider router={router} />
        </SessionProvider>
      </ApiQueryProvider>,
    ),
  };
}

describe('StudyGuideBotPanel (HU-BOT-002)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('answers student questions with cited sources and renders hostile payloads safely', async () => {
    const store = createClassroomBotStore({
      classroomId: CLASSROOM_ID,
      onAsk: () => ({
        answer:
          '<img src=x onerror=alert(1)> Revisá el teorema en el material aprobado.',
        outcome: 'guided_only',
        citations: [
          {
            materialId: '00000000-0000-4000-8000-000000001001',
            filename: 'resumen-unidad-2.pdf',
            excerpt: 'Capítulo 3: equivalencias.',
          },
        ],
      }),
    });
    mswServer.use(...store.handlers);

    const { container } = renderBotPanel({ role: 'STUDENT' });

    const composer = await screen.findByLabelText(
      'Tu consulta para el asistente',
    );
    fireEvent.change(composer, {
      target: { value: '¿Cómo resuelvo el ejercicio 4?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));

    expect(
      await screen.findByText(
        /<img src=x onerror=alert\(1\)> Revisá el teorema/,
      ),
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('Guía sin solución directa')).toBeInTheDocument();
    expect(screen.getByText('resumen-unidad-2.pdf')).toBeInTheDocument();
    expect(composer).toHaveValue('');

    const axeResults = await axe.run(container);
    expect(axeResults.violations).toEqual([]);
  });

  it('blocks in-flight queries and disables composer when an exam starts', async () => {
    let releaseAsk: (() => void) | undefined;
    const store = createClassroomBotStore({
      classroomId: CLASSROOM_ID,
      onAsk: async () => {
        await new Promise<void>((resolve) => {
          releaseAsk = resolve;
        });
        return { answer: 'Respuesta tardía' };
      },
    });
    mswServer.use(...store.handlers);

    renderBotPanel({ role: 'STUDENT' });

    const composer = await screen.findByLabelText(
      'Tu consulta para el asistente',
    );
    fireEvent.change(composer, { target: { value: 'Pregunta previa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));

    await waitFor(() => {
      expect(releaseAsk).toBeDefined();
    });
    store.setExamLocked(
      true,
      'El asistente está pausado porque tenés un examen en curso.',
    );
    releaseAsk?.();

    expect(
      await screen.findByText('Asistente pausado durante el examen'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Respuesta tardía')).not.toBeInTheDocument();
    expect(composer).toBeDisabled();
  });

  it('shows distinct alerts on provider failure (503) and rate limit (429) while preserving the draft', async () => {
    const store = createClassroomBotStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);

    renderBotPanel({ role: 'STUDENT' });

    const composer = await screen.findByLabelText(
      'Tu consulta para el asistente',
    );
    fireEvent.change(composer, { target: { value: 'Consulta con reintento' } });

    store.failNext('ask', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Provider down',
        correlationId: 'req-bot-503',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));

    expect(
      await screen.findByText('Servicio de IA no disponible'),
    ).toBeInTheDocument();
    expect(composer).toHaveValue('Consulta con reintento');

    store.failNext('ask', {
      status: 429,
      body: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit',
        correlationId: 'req-bot-429',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));

    expect(
      await screen.findByText('Límite de consultas alcanzado'),
    ).toBeInTheDocument();
    expect(composer).toHaveValue('Consulta con reintento');
  });

  it('denies access to PARENT accounts without querying bot status', async () => {
    const store = createClassroomBotStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);

    renderBotPanel({ role: 'PARENT' });

    expect(await screen.findByText('Acceso no disponible')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Tu consulta para el asistente'),
    ).not.toBeInTheDocument();
  });

  it('shows exam-specific reason on 409/423 (never generic conflict), aborts in-flight answer when status turns exam_in_progress, and hides denied content on 403 status refetch', async () => {
    let releaseAsk: (() => void) | undefined;
    const store = createClassroomBotStore({
      classroomId: CLASSROOM_ID,
      onAsk: async () => {
        await new Promise<void>((resolve) => {
          releaseAsk = resolve;
        });
        return { answer: 'Respuesta que no debe mostrarse' };
      },
    });
    mswServer.use(...store.handlers);

    const { queryClient } = renderBotPanel({ role: 'STUDENT' });

    // Empty state + client validation (F-06)
    expect(
      await screen.findByText('Todavía no hiciste consultas en esta sesión'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));
    expect(
      await screen.findByText('Escribí una consulta antes de enviar.'),
    ).toBeInTheDocument();

    // In-flight 409 shows examLockedDefault, never generic conflict (F-01)
    const composer = screen.getByLabelText('Tu consulta para el asistente');
    fireEvent.change(composer, {
      target: { value: 'Consulta durante examen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));
    await waitFor(() => {
      expect(releaseAsk).toBeDefined();
    });
    store.setExamLocked(true);
    releaseAsk?.();

    expect(
      await screen.findByText('Asistente pausado durante el examen'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'El asistente no está disponible mientras tenés un examen en curso según el servidor.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/La operación entra en conflicto/),
    ).not.toBeInTheDocument();

    // Status refetch returning 403 hides cached content instead of StaleDataNotice (F-03)
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/:id/bot/status`, () =>
        HttpResponse.json(
          {
            code: 'FORBIDDEN',
            message: 'Forbidden',
            correlationId: 'req-bot-status-403',
          },
          { status: 403 },
        ),
      ),
    );
    await queryClient.refetchQueries();
    expect(
      await screen.findByText('Sin permiso para consultar el asistente'),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Tu consulta para el asistente'),
    ).not.toBeInTheDocument();
  });

  it('shows unavailableTitle with fallback description when status is no_materials with empty message', async () => {
    const store = createClassroomBotStore({
      classroomId: CLASSROOM_ID,
      initialAvailable: false,
      initialReason: 'no_materials',
      initialMessage: '',
    });
    mswServer.use(...store.handlers);

    renderBotPanel({ role: 'STUDENT' });

    expect(
      await screen.findByText('Asistente no disponible'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'El asistente de estudio no está disponible en este momento para esta aula.',
      ),
    ).toBeInTheDocument();
  });
  it('opens with an assistant header and suggested prompts that fill the composer without sending', async () => {
    const store = createClassroomBotStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);
    renderBotPanel({ role: 'STUDENT' });

    expect(
      await screen.findByRole('heading', { name: botMessages.headerTitle }),
    ).toBeVisible();
    expect(screen.getByText(botMessages.statusAvailable)).toBeVisible();

    const suggestions = screen.getByRole('group', {
      name: botMessages.suggestionsLabel,
    });
    const first = within(suggestions).getByRole('button', {
      name: botMessages.suggestions[0],
    });
    fireEvent.click(first);
    expect(screen.getByLabelText('Tu consulta para el asistente')).toHaveValue(
      botMessages.suggestions[0],
    );
    // Nothing was asked yet: the empty state is still there.
    expect(screen.getByText(botMessages.emptyHistoryTitle)).toBeVisible();
  });

  it('renders the conversation as a log of bubbles with a thinking indicator while waiting', async () => {
    let releaseAsk: (() => void) | undefined;
    const store = createClassroomBotStore({
      classroomId: CLASSROOM_ID,
      onAsk: async () => {
        await new Promise<void>((resolve) => {
          releaseAsk = resolve;
        });
        return { answer: 'Mirá el capítulo 2.' };
      },
    });
    mswServer.use(...store.handlers);
    renderBotPanel({ role: 'STUDENT' });

    fireEvent.change(
      await screen.findByLabelText('Tu consulta para el asistente'),
      { target: { value: 'Dudas de fracciones' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));

    const log = await screen.findByRole('log', {
      name: botMessages.conversationRegionLabel,
    });
    expect(within(log).getByText('Dudas de fracciones')).toBeVisible();
    expect(within(log).getByText(botMessages.userAuthorLabel)).toBeVisible();
    expect(within(log).getByRole('status')).toHaveTextContent(
      botMessages.thinking,
    );

    await waitFor(() => expect(releaseAsk).toBeDefined());
    releaseAsk?.();
    expect(await within(log).findByText('Mirá el capítulo 2.')).toBeVisible();
    expect(within(log).queryByRole('status')).not.toBeInTheDocument();
    expect(within(log).getByText(botMessages.botAuthorLabel)).toBeVisible();
  });

  it('re-enables composer cleanly when an exam lock aborts an in-flight question and later unlocks', async () => {
    let releaseAsk: (() => void) | undefined;
    const store = createClassroomBotStore({
      classroomId: CLASSROOM_ID,
      onAsk: async () => {
        await new Promise<void>((resolve) => {
          releaseAsk = resolve;
        });
        return { answer: 'Respuesta tardía' };
      },
    });
    mswServer.use(...store.handlers);
    const { queryClient } = renderBotPanel({ role: 'STUDENT' });

    const input = await screen.findByLabelText('Tu consulta para el asistente');
    fireEvent.change(input, { target: { value: 'Pregunta abortada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));
    expect(input).toBeDisabled();

    await waitFor(() => expect(releaseAsk).toBeDefined());
    store.setExamLocked(true);
    await queryClient.refetchQueries();
    expect(await screen.findByText(botMessages.examLockedTitle)).toBeVisible();
    expect(screen.queryByText('Respuesta tardía')).not.toBeInTheDocument();
    releaseAsk?.();

    store.setExamLocked(false);
    await queryClient.refetchQueries();
    await waitFor(() => expect(input).toBeEnabled());
  });
});
