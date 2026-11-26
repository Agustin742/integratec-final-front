import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
import { createAppRoutes } from '@/app/router/routes';
import { createSession } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { storageKey, tokens } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createFamilyLinksHandler,
  createFamilyReportCardHandler,
  createOwnProfileHandler,
  createParentLinkMessagesHandler,
  type FamilyLinkPayload,
  type FamilyMetricsSummaryPayload,
  type FamilyReportCardItemPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { familyMessages } from './messages';

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

const parentUserId = '00000000-0000-4000-8000-000000000090';

const linkSofia: FamilyLinkPayload = {
  id: '11111111-1111-4111-8111-111111111101',
  classroomId: '22222222-2222-4222-8222-222222222201',
  classroomName: '3.º Año A - Matemática',
  classroomSubject: 'Álgebra y Geometría',
  schoolId: '33333333-3333-4333-8333-333333333301',
  adultMode: false,
  childId: '44444444-4444-4444-8444-444444444401',
  childDisplayName: 'Sofía Martínez',
  createdAt: '2026-11-10T10:00:00.000Z',
};

const linkTomas: FamilyLinkPayload = {
  id: '11111111-1111-4111-8111-111111111102',
  classroomId: '22222222-2222-4222-8222-222222222202',
  classroomName: '5.º Año B - Historia',
  classroomSubject: 'Historia Argentina',
  schoolId: '33333333-3333-4333-8333-333333333301',
  adultMode: false,
  childId: '44444444-4444-4444-8444-444444444402',
  childDisplayName: 'Tomás Martínez',
  createdAt: '2026-11-11T10:00:00.000Z',
};

const linkAdultMode: FamilyLinkPayload = {
  id: '11111111-1111-4111-8111-111111111103',
  classroomId: '22222222-2222-4222-8222-222222222203',
  classroomName: 'Taller Nocturno de Programación',
  classroomSubject: null,
  schoolId: null,
  adultMode: true,
  childId: '44444444-4444-4444-8444-444444444403',
  childDisplayName: 'Lucas Martínez',
  createdAt: '2026-11-12T10:00:00.000Z',
};

const sofiaMetrics: FamilyMetricsSummaryPayload = {
  connectedSeconds: 5400, // 1 h 30 min
  submissionCount: 5,
  messageCount: 12,
  gradedCount: 3,
  ungradedCount: 1,
  pendingCount: 2,
  averageScorePercent: 87.5,
};

const tomasMetrics: FamilyMetricsSummaryPayload = {
  connectedSeconds: 1800, // 30 min
  submissionCount: 2,
  messageCount: 4,
  gradedCount: 1,
  ungradedCount: 0,
  pendingCount: 1,
  averageScorePercent: 95,
};

function makeReportCardItem(
  index: number,
  overrides: Partial<FamilyReportCardItemPayload> = {},
): FamilyReportCardItemPayload {
  return {
    activityId: `55555555-5555-4555-8555-${String(index).padStart(12, '0')}`,
    activityTitle: `Trabajo Práctico ${index}`,
    activityType: index % 2 === 0 ? 'EXAM' : 'TP',
    maxScore: 100,
    score: 85,
    feedback: `Buen desarrollo en la actividad ${index}.`,
    pointsAwarded: 85,
    isLate: false,
    submittedAt: '2026-11-18T14:00:00.000Z',
    gradedAt: '2026-11-19T18:30:00.000Z',
    ...overrides,
  };
}

function seedAuthenticatedSession(tabOwner = 'tab-family-test') {
  window.name = `\n[integratec-tab:${tabOwner}]`;
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      ...tokens,
      expiresAt: Date.now() + 900_000,
      tabOwner,
    }),
  );
  return tabOwner;
}

function renderFamilyRoute(initialPath = '/family') {
  const tabOwner = seedAuthenticatedSession();
  mswServer.use(
    createOwnProfileHandler({
      response: {
        id: parentUserId,
        email: 'parent@example.edu.ar',
        displayName: 'Laura Martínez',
      },
    }),
  );

  const session = createSession({
    baseUrl: TEST_API_BASE_URL,
    tabOwner: () => tabOwner,
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const router = createMemoryRouter(createAppRoutes({ showcase: false }), {
    initialEntries: [initialPath],
  });

  const rendered = render(
    <SessionProvider service={session}>
      <RouterProvider router={router} />
    </SessionProvider>,
    { queryClient },
  );

  return { ...rendered, router, queryClient, session };
}

describe('FamilyAreaView (/family)', () => {
  test('renders loading state and empty state with accept-invitation CTA when account has zero links', async () => {
    mswServer.use(
      createFamilyLinksHandler({
        items: [],
        delayMs: 30,
      }),
    );

    const { container } = await renderFamilyRoute('/family');

    expect(
      await screen.findByText(familyMessages.loadingLinks),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', { name: familyMessages.empty.title }),
    ).toBeInTheDocument();

    const acceptLink = screen.getByRole('link', {
      name: familyMessages.empty.acceptInvitationCta,
    });
    expect(acceptLink).toHaveAttribute('href', '/invitations/accept');

    const backLink = screen.getByRole('link', {
      name: familyMessages.backToClassrooms,
    });
    expect(backLink).toHaveAttribute('href', '/');

    await expectAccessible(container);
  });

  test('renders single child participation metrics, graded items, pagination, and zero forbidden controls', async () => {
    const items = Array.from({ length: 22 }, (_, idx) =>
      makeReportCardItem(idx + 1, {
        activityTitle:
          idx === 0
            ? 'Examen de Ecuaciones'
            : idx === 20
              ? 'TP de Página Dos'
              : `Actividad ${idx + 1}`,
        activityType: idx === 0 ? 'EXAM' : 'TP',
        score: idx === 0 ? 90 : 80,
        maxScore: 100,
        feedback: idx === 0 ? 'Excelente resolución paso a paso.' : '',
        isLate: idx === 1,
      }),
    );

    mswServer.use(
      createFamilyLinksHandler({ items: [linkSofia] }),
      createFamilyReportCardHandler({
        linkId: linkSofia.id,
        link: linkSofia,
        items,
        metrics: sofiaMetrics,
      }),
      createParentLinkMessagesHandler({
        linkId: linkSofia.id,
        link: linkSofia,
        items: [],
      }),
    );

    const { container } = await renderFamilyRoute('/family');

    expect(
      await screen.findByRole('heading', { name: 'Sofía Martínez' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3\.º Año A - Matemática · Álgebra y Geometría/),
    ).toBeInTheDocument();

    // Participation metrics
    expect(await screen.findByText('87,5%')).toBeInTheDocument();
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    // Report card first page item
    expect(
      screen.getByRole('heading', { name: 'Examen de Ecuaciones' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Excelente resolución paso a paso.'),
    ).toBeInTheDocument();
    expect(screen.getByText('90 / 100')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Entrega tarde')).toBeInTheDocument();

    // Zero forbidden classroom/3D/shop/bot controls
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.queryByText(/Chat del aula/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tienda/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Asistente de estudio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Repaso diario/i)).not.toBeInTheDocument();

    await expectAccessible(container);

    // Pagination to page 2
    const nextButton = screen.getByRole('button', { name: /Siguiente/i });
    fireEvent.click(nextButton);

    expect(
      await screen.findByRole('heading', { name: 'TP de Página Dos' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Examen de Ecuaciones' }),
    ).not.toBeInTheDocument();
  });

  test('renders honest empty report card when child has no graded items yet', async () => {
    mswServer.use(
      createFamilyLinksHandler({ items: [linkSofia] }),
      createFamilyReportCardHandler({
        linkId: linkSofia.id,
        link: linkSofia,
        items: [],
        metrics: {
          connectedSeconds: 0,
          submissionCount: 0,
          messageCount: 0,
          gradedCount: 0,
          ungradedCount: 0,
          pendingCount: 2,
          averageScorePercent: null,
        },
      }),
      createParentLinkMessagesHandler({
        linkId: linkSofia.id,
        link: linkSofia,
        items: [],
      }),
    );

    await renderFamilyRoute('/family');

    expect(
      await screen.findByRole('heading', {
        name: familyMessages.reportCard.emptyTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(familyMessages.metrics.averageScoreEmpty),
    ).toBeInTheDocument();
  });

  test('switches between multiple linked children without leaking previous child grades', async () => {
    const sofiaItems = [
      makeReportCardItem(1, {
        activityTitle: 'Examen Exclusivo de Sofía',
        score: 75,
        maxScore: 100,
      }),
    ];
    const tomasItems = [
      makeReportCardItem(2, {
        activityTitle: 'Trabajo Exclusivo de Tomás',
        score: 95,
        maxScore: 100,
      }),
    ];

    mswServer.use(
      createFamilyLinksHandler({ items: [linkSofia, linkTomas] }),
      createFamilyReportCardHandler({
        linkId: linkSofia.id,
        link: linkSofia,
        items: sofiaItems,
        metrics: sofiaMetrics,
      }),
      createFamilyReportCardHandler({
        linkId: linkTomas.id,
        link: linkTomas,
        items: tomasItems,
        metrics: tomasMetrics,
      }),
      createParentLinkMessagesHandler({
        linkId: linkSofia.id,
        link: linkSofia,
        items: [
          {
            id: '77777777-7777-4777-8777-000000000001',
            parentLinkId: linkSofia.id,
            authorId: '00000000-0000-4000-8000-000000000091',
            authorDisplayName: 'Prof. Matemática',
            authorRole: 'STAFF',
            body: 'Mensaje privado de Sofía',
            createdAt: '2026-11-20T12:00:00.000Z',
          },
        ],
      }),
      createParentLinkMessagesHandler({
        linkId: linkTomas.id,
        link: linkTomas,
        items: [
          {
            id: '77777777-7777-4777-8777-000000000002',
            parentLinkId: linkTomas.id,
            authorId: '00000000-0000-4000-8000-000000000092',
            authorDisplayName: 'Prof. Historia',
            authorRole: 'STAFF',
            body: 'Mensaje privado de Tomás',
            createdAt: '2026-11-21T12:00:00.000Z',
          },
        ],
      }),
    );

    const { router } = await renderFamilyRoute(
      `/family?classroomId=${linkSofia.classroomId}`,
    );

    expect(
      await screen.findByRole('heading', { name: 'Examen Exclusivo de Sofía' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Mensaje privado de Sofía'),
    ).toBeInTheDocument();

    const selectorRegion = screen.getByRole('region', {
      name: familyMessages.selector.regionLabel,
    });
    const sofiaButton = within(selectorRegion).getByRole('button', {
      name: /Sofía Martínez/,
    });
    const tomasButton = within(selectorRegion).getByRole('button', {
      name: /Tomás Martínez/,
    });

    expect(sofiaButton).toHaveAttribute('aria-pressed', 'true');
    expect(tomasButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(tomasButton);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/family/${linkTomas.id}`);
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Trabajo Exclusivo de Tomás',
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Mensaje privado de Tomás'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Examen Exclusivo de Sofía' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Mensaje privado de Sofía'),
    ).not.toBeInTheDocument();
    expect(tomasButton).toHaveAttribute('aria-pressed', 'true');
    expect(sofiaButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('shows adult-mode notice without calling report-card or messages when link has adultMode=true', async () => {
    const reportCardSpy = vi.fn();
    const messagesSpy = vi.fn();
    mswServer.use(
      createFamilyLinksHandler({ items: [linkAdultMode] }),
      createFamilyReportCardHandler({
        linkId: linkAdultMode.id,
        onRequest: reportCardSpy,
      }),
      createParentLinkMessagesHandler({
        linkId: linkAdultMode.id,
        onRequest: messagesSpy,
      }),
    );

    const { container } = await renderFamilyRoute('/family');

    expect(
      await screen.findByRole('heading', {
        name: familyMessages.adultMode.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(familyMessages.adultMode.description),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: familyMessages.messaging.defaultTitle,
      }),
    ).not.toBeInTheDocument();
    expect(reportCardSpy).not.toHaveBeenCalled();
    expect(messagesSpy).not.toHaveBeenCalled();

    await expectAccessible(container);
  });

  test('handles 403 adult-mode mid-session transition without exposing raw backend text', async () => {
    mswServer.use(
      createFamilyLinksHandler({ items: [linkSofia] }),
      createFamilyReportCardHandler({
        linkId: linkSofia.id,
        status: 403,
      }),
      createParentLinkMessagesHandler({
        linkId: linkSofia.id,
        status: 403,
      }),
    );

    await renderFamilyRoute(`/family/${linkSofia.id}`);

    const adultModeHeadings = await screen.findAllByRole('heading', {
      name: familyMessages.errors.adultModeTitle,
    });
    expect(adultModeHeadings.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText(/Parent viewing is disabled/i),
    ).not.toBeInTheDocument();
  });

  test('handles 404 removed link/student cleanly without exposing raw backend text', async () => {
    mswServer.use(
      createFamilyLinksHandler({ items: [linkSofia] }),
      createFamilyReportCardHandler({
        linkId: linkSofia.id,
        status: 404,
      }),
      createParentLinkMessagesHandler({
        linkId: linkSofia.id,
        status: 404,
      }),
    );

    await renderFamilyRoute(`/family/${linkSofia.id}`);

    const notFoundHeadings = await screen.findAllByRole('heading', {
      name: familyMessages.errors.notFoundTitle,
    });
    expect(notFoundHeadings.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText(/Parent link not found/i),
    ).not.toBeInTheDocument();
  });

  test('retries transient report-card errors and recovers cleanly', async () => {
    let shouldFail = true;

    mswServer.use(
      createFamilyLinksHandler({ items: [linkSofia] }),
      createFamilyReportCardHandler({
        linkId: linkSofia.id,
        status: 500,
      }),
      createParentLinkMessagesHandler({
        linkId: linkSofia.id,
        link: linkSofia,
        items: [],
      }),
    );

    await renderFamilyRoute(`/family/${linkSofia.id}`);

    expect(
      await screen.findByRole('heading', {
        name: familyMessages.errors.reportCardTitle,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Raw backend failure/i)).not.toBeInTheDocument();

    shouldFail = false;
    mswServer.use(
      createFamilyReportCardHandler({
        linkId: linkSofia.id,
        link: linkSofia,
        items: [makeReportCardItem(1, { activityTitle: 'Recuperada OK' })],
        metrics: sofiaMetrics,
      }),
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: familyMessages.errors.retryAction }),
      );
    });

    expect(shouldFail).toBe(false);
    expect(
      await screen.findByRole('heading', { name: 'Recuperada OK' }),
    ).toBeInTheDocument();
  });
});
