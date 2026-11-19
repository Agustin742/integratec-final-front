import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import {
  ownDailyReviewQueryKey,
  ownStreakAndBadgesQueryKey,
} from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { profile } from '@/session/test-fixtures';
import { SessionProvider } from '@/session/provider';
import {
  TEST_API_BASE_URL,
  createDailyQuestionAnswerHandler,
  createDailyReviewHandler,
  createOwnStreakAndBadgesHandler,
  type DailyReviewPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { DailyReviewDialog } from './daily-review-dialog';

const CONFLICT_ENVELOPE = {
  status: 409,
  body: {
    code: 'CONFLICT' as const,
    message: 'Ya respondiste la pregunta de hoy.',
    correlationId: '3f2b8c1e-0d1a-4f4e-9a55-6f0c2f9c1a11',
  },
};

const DUE_STUDENT_REVIEW: DailyReviewPayload = {
  status: 'due',
  audience: 'STUDENT',
  contentKind: 'generated',
  summary:
    'Buen día, Camila. Tenés dos actividades pendientes y una calificación nueva.',
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
    id: 'question-1',
    prompt: '¿Qué organelo realiza la fotosíntesis?',
    options: ['Mitocondria', 'Cloroplasto', 'Ribosoma'],
    materialTitle: 'guia-fotosintesis.pdf',
  },
};

const DUE_TEACHER_REVIEW: DailyReviewPayload = {
  status: 'due',
  audience: 'TEACHER',
  contentKind: 'generated',
  summary:
    'Buen día, Sofía. Tenés entregas esperando calificación y un aviso nuevo.',
  sections: [
    {
      kind: 'pending',
      items: [
        {
          kind: 'teacher_review',
          title: '5 entregas esperan tu calificación',
          classroomName: 'Biología 3°B',
          dueAt: null,
          detail: null,
        },
      ],
    },
  ],
  dailyQuestion: null,
};

const STRUCTURED_STUDENT_REVIEW: DailyReviewPayload = {
  status: 'due',
  audience: 'STUDENT',
  contentKind: 'structured',
  summary: null,
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
          kind: 'announcement',
          title: 'Salida al museo de ciencias',
          classroomName: 'Biología 3°B',
          dueAt: null,
          detail: 'Viernes 27 de noviembre',
        },
      ],
    },
  ],
  dailyQuestion: null,
};

function renderDailyReviewDialog() {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    queryClient,
    ...render(
      <SessionProvider service={session.service}>
        <DailyReviewDialog />
      </SessionProvider>,
      { queryClient },
    ),
  };
}

async function waitForReviewQuery(queryClient: QueryClient): Promise<void> {
  await waitFor(() => {
    const state = queryClient.getQueryState(ownDailyReviewQueryKey(profile.id));
    expect(state?.status).toBe('success');
  });
}

describe('DailyReviewDialog (HU-BOT-003, #55)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('shows the daily review on the first authenticated connection and closes on escape', async () => {
    mswServer.use(
      createDailyReviewHandler({
        payload: DUE_STUDENT_REVIEW,
        deliverOnce: true,
      }),
      createOwnStreakAndBadgesHandler(),
    );

    const { container } = renderDailyReviewDialog();

    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tenés dos actividades pendientes/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Trabajo práctico de fotosíntesis'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Cloroplasto' }),
    ).toBeInTheDocument();

    const axeResults = await axe.run(container.ownerDocument.body);
    expect(axeResults.violations).toEqual([]);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('does not repeat the presentation after a reload when the server says not due', async () => {
    // The handler keeps the server-side once-per-day record across renders.
    mswServer.use(
      createDailyReviewHandler({
        payload: DUE_STUDENT_REVIEW,
        deliverOnce: true,
      }),
      createOwnStreakAndBadgesHandler(),
    );

    const first = renderDailyReviewDialog();
    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    first.unmount();

    const second = renderDailyReviewDialog();
    await waitForReviewQuery(second.queryClient);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when the server says the review is not due (parents)', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: { status: 'not_due' } }),
      createOwnStreakAndBadgesHandler(),
    );

    const { queryClient } = renderDailyReviewDialog();
    await waitForReviewQuery(queryClient);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the server-confirmed streak update after a correct answer', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
      createDailyQuestionAnswerHandler({
        result: {
          correct: true,
          feedback: '¡Correcto! El cloroplasto realiza la fotosíntesis.',
          streak: {
            currentStreak: 5,
            bestStreak: 9,
            lastQualifiedDate: '2026-11-19',
          },
        },
      }),
      createOwnStreakAndBadgesHandler(),
    );

    const { queryClient } = renderDailyReviewDialog();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Cloroplasto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));

    expect(await screen.findByText('¡Respuesta correcta!')).toBeInTheDocument();
    expect(screen.getByText(/Tu racha llegó a 5 días/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Cloroplasto' })).toBeDisabled();

    // The read-only streak cache is invalidated so indicators refetch.
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ownStreakAndBadgesQueryKey(profile.id),
      });
    });
    invalidateSpy.mockRestore();
  });

  it('shows incorrect-answer feedback without a streak update', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
      createDailyQuestionAnswerHandler({
        result: {
          correct: false,
          feedback: 'No era esa. Revisá el capítulo 3 de la guía.',
          streak: null,
        },
      }),
      createOwnStreakAndBadgesHandler(),
    );

    renderDailyReviewDialog();

    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Mitocondria' }));
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));

    expect(await screen.findByText('Respuesta incorrecta')).toBeInTheDocument();
    expect(
      screen.getByText(/Revisá el capítulo 3 de la guía/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tu racha llegó a/)).toBeNull();
  });

  it('shows the server message when the daily question was already answered', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
      createDailyQuestionAnswerHandler({ error: CONFLICT_ENVELOPE }),
      createOwnStreakAndBadgesHandler(),
    );

    renderDailyReviewDialog();

    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Cloroplasto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));

    expect(
      await screen.findByText('Ya respondiste la pregunta de hoy.'),
    ).toBeInTheDocument();
  });

  it('renders the structured fallback without generated text or a question card', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: STRUCTURED_STUDENT_REVIEW }),
      createOwnStreakAndBadgesHandler(),
    );

    renderDailyReviewDialog();

    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Resumen estructurado con tus datos guardados/),
    ).toBeInTheDocument();
    expect(screen.getByText('Salida al museo de ciencias')).toBeInTheDocument();
    expect(screen.queryByText(/Tenés dos actividades pendientes/)).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('shows teachers the review without the daily question card', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_TEACHER_REVIEW }),
      createOwnStreakAndBadgesHandler(),
    );

    renderDailyReviewDialog();

    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('5 entregas esperan tu calificación'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull();
  });
});
