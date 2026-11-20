import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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

  it('shows the daily review on the first authenticated connection and closes with the close button', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
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
    // A 409 means the day is already answered: the card locks instead of
    // inviting retries that can only hit the same conflict.
    expect(screen.getByRole('radio', { name: 'Cloroplasto' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull();
  });

  it('shows a dedicated submit-failure message, not the load error copy', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
      createDailyQuestionAnswerHandler({ error: 'network' }),
      createOwnStreakAndBadgesHandler(),
    );

    renderDailyReviewDialog();

    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Cloroplasto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos enviar tu respuesta. Revisá tu conexión e intentá de nuevo.',
    );
    expect(screen.queryByText(/interpretar tu repaso diario/)).toBeNull();
    // The student can retry after a transient failure.
    expect(screen.getByRole('button', { name: 'Responder' })).toBeEnabled();
  });

  it('keeps an unanswered question open on escape and outside click, closing only with the close button', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
      createOwnStreakAndBadgesHandler(),
    );

    renderDailyReviewDialog();

    const dialog = await screen.findByRole('dialog', {
      name: 'Tu repaso diario',
    });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('closes on escape once the question was answered', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
      createDailyQuestionAnswerHandler({
        result: { correct: false, feedback: null, streak: null },
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

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('closes on escape after an already-answered conflict', async () => {
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

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('closes on escape for a teacher review', async () => {
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_TEACHER_REVIEW }),
      createOwnStreakAndBadgesHandler(),
    );

    renderDailyReviewDialog();

    fireEvent.keyDown(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
      { key: 'Escape' },
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('submits the answer once when the button is clicked twice in the same tick', async () => {
    const onAnswer = vi.fn();
    mswServer.use(
      createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
      createDailyQuestionAnswerHandler({
        onAnswer,
        result: { correct: false, feedback: null, streak: null },
      }),
      createOwnStreakAndBadgesHandler(),
    );

    renderDailyReviewDialog();

    expect(
      await screen.findByRole('dialog', { name: 'Tu repaso diario' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Mitocondria' }));
    const submit = screen.getByRole('button', { name: 'Responder' });
    // Both clicks run inside one batched update, before `isPending` re-renders.
    act(() => {
      submit.click();
      submit.click();
    });

    expect(await screen.findByText('Respuesta incorrecta')).toBeInTheDocument();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      '404',
      {
        status: 404,
        body: {
          code: 'NOT_FOUND' as const,
          message: 'Not found.',
          correlationId: '3f2b8c1e-0d1a-4f4e-9a55-6f0c2f9c1a12',
        },
      },
    ],
    ['network error', 'network' as const],
  ])(
    'stays closed when the daily review request fails (%s)',
    async (_label, error) => {
      mswServer.use(
        createDailyReviewHandler({ error }),
        createOwnStreakAndBadgesHandler(),
      );

      const { queryClient } = renderDailyReviewDialog();
      await waitFor(() => {
        const state = queryClient.getQueryState(
          ownDailyReviewQueryKey(profile.id),
        );
        expect(state?.status).toBe('error');
      });

      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );

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

  describe('accessibility and content', () => {
    it('links the visible description to the dialog', async () => {
      mswServer.use(
        createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
        createOwnStreakAndBadgesHandler(),
      );

      renderDailyReviewDialog();

      const dialog = await screen.findByRole('dialog', {
        name: 'Tu repaso diario',
      });
      expect(dialog).toHaveAccessibleDescription(
        'Un resumen de tus pendientes y novedades para organizar tu jornada.',
      );
    });

    it('renders items with duplicate titles without key warnings', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const duplicated: DailyReviewPayload = {
        ...DUE_TEACHER_REVIEW,
        sections: [
          {
            kind: 'pending',
            items: [
              {
                kind: 'pending_activity',
                title: 'Guía de ejercicios',
                classroomName: 'Biología 3°B',
                dueAt: null,
                detail: null,
              },
              {
                kind: 'pending_activity',
                title: 'Guía de ejercicios',
                classroomName: 'Química 4°A',
                dueAt: null,
                detail: null,
              },
            ],
          },
        ],
      };
      mswServer.use(
        createDailyReviewHandler({ payload: duplicated }),
        createOwnStreakAndBadgesHandler(),
      );

      renderDailyReviewDialog();

      expect(await screen.findAllByText('Guía de ejercicios')).toHaveLength(2);
      const keyWarnings = errorSpy.mock.calls.filter((call) =>
        String(call[0]).includes('same key'),
      );
      expect(keyWarnings).toEqual([]);
      errorSpy.mockRestore();
    });

    it('exposes a single radio group named by the question prompt', async () => {
      mswServer.use(
        createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
        createOwnStreakAndBadgesHandler(),
      );

      renderDailyReviewDialog();

      await screen.findByRole('dialog', { name: 'Tu repaso diario' });
      const groups = screen.getAllByRole('group');
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveAccessibleName(
        '¿Qué organelo realiza la fotosíntesis?',
      );
      expect(screen.queryByRole('radiogroup')).toBeNull();
    });

    it('nests section headings under the dialog title as level 3', async () => {
      mswServer.use(
        createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
        createOwnStreakAndBadgesHandler(),
      );

      renderDailyReviewDialog();

      await screen.findByRole('dialog', { name: 'Tu repaso diario' });
      expect(
        screen.getByRole('heading', { level: 3, name: 'Pendientes' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: 'Novedades' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          level: 3,
          name: 'Pregunta diaria de repaso',
        }),
      ).toBeInTheDocument();
    });

    it('moves focus to the result heading and announces it in the live region', async () => {
      mswServer.use(
        createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }),
        createDailyQuestionAnswerHandler({
          result: {
            correct: true,
            feedback: '¡Correcto! El cloroplasto realiza la fotosíntesis.',
            streak: null,
          },
        }),
        createOwnStreakAndBadgesHandler(),
      );

      renderDailyReviewDialog();

      await screen.findByRole('dialog', { name: 'Tu repaso diario' });
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeEmptyDOMElement();
      fireEvent.click(screen.getByRole('radio', { name: 'Cloroplasto' }));
      fireEvent.click(screen.getByRole('button', { name: 'Responder' }));

      const heading = await screen.findByRole('heading', {
        level: 4,
        name: '¡Respuesta correcta!',
      });
      await waitFor(() => {
        expect(heading).toHaveFocus();
      });
      expect(screen.getByRole('status')).toBe(liveRegion);
      expect(liveRegion).toContainElement(heading);
    });

    it('uses per-section empty copy when only one section is empty', async () => {
      const onlyNews: DailyReviewPayload = {
        ...STRUCTURED_STUDENT_REVIEW,
        sections: [
          { kind: 'pending', items: [] },
          STRUCTURED_STUDENT_REVIEW.sections[1],
        ],
      };
      mswServer.use(
        createDailyReviewHandler({ payload: onlyNews }),
        createOwnStreakAndBadgesHandler(),
      );

      renderDailyReviewDialog();

      expect(
        await screen.findByText('Sin pendientes por ahora.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('No tenés pendientes ni novedades')).toBeNull();
    });
  });
});
