import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  type ClassroomInteractable,
} from '../world/classroom/classroom-interactables';
import { ClassroomWorkspace } from './classroom-workspace';
import { resetClassroomModeStore } from './classroom-mode-store';
import { classroomMessages } from './messages';

const worldMock = vi.hoisted(() => ({
  latestProps: null as null | {
    highlightedInteractableId?: string;
    ownDeskIndex?: number | null;
    petReactionNonce?: number;
    interactionLocked?: boolean;
    onHoverInteractable?: (id: string | undefined) => void;
    onSelectInteractable?: (interactable: ClassroomInteractable) => void;
  },
}));

vi.mock('../world', () => ({
  clearAssetCache: vi.fn(),
  PerformanceProbe: () => null,
  ClassroomWorld: (props: {
    label: string;
    scopeKey?: string;
    highlightedInteractableId?: string;
    ownDeskIndex?: number | null;
    petReactionNonce?: number;
    interactionLocked?: boolean;
    onHoverInteractable?: (id: string | undefined) => void;
    onSelectInteractable?: (interactable: ClassroomInteractable) => void;
    children?: ReactNode;
  }) => {
    worldMock.latestProps = props;
    return (
      <div role="region" aria-label={props.label}>
        <span data-testid="world-mock" />
        {props.children}
      </div>
    );
  },
}));

const interactablesById = indexClassroomInteractables(
  deriveClassroomInteractables(CLASSROOM_LAYOUT),
);

const syntheticPanels = [
  {
    key: 'activities',
    title: 'Actividades',
    component: () => <p>Contenido actividades</p>,
  },
  {
    key: 'material',
    title: 'Material',
    component: () => <p>Contenido material</p>,
  },
  { key: 'notices', title: 'Avisos', component: () => <p>Contenido avisos</p> },
  { key: 'shop', title: 'Tienda', component: () => <p>Contenido tienda</p> },
  {
    key: 'bot',
    title: 'Asistente de estudio',
    component: () => <p>Contenido bot</p>,
  },
  {
    key: 'members',
    title: 'Integrantes',
    component: () => <p>Contenido integrantes</p>,
  },
  {
    key: 'grades',
    title: 'Calificaciones',
    component: () => <p>Contenido calificaciones</p>,
  },
] as const;

interface SetupOptions {
  readonly availablePanels?: components['schemas']['ClassroomPanelKey'][];
  readonly myRole?: components['schemas']['ClassroomContextResponseDto']['myRole'];
  readonly assignedDeskIndex?: number | null;
  readonly petName?: string | null;
  readonly shouldFailDesks?: () => boolean;
}

function setup(options: SetupOptions = {}) {
  const {
    availablePanels = [
      'activities',
      'material',
      'notices',
      'shop',
      'bot',
      'members',
      'grades',
    ],
    myRole = 'STUDENT',
    assignedDeskIndex = 2,
    petName = 'Michi',
    shouldFailDesks,
  } = options;

  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const request = input as Request;
        const url = new URL(request.url);
        if (url.pathname.endsWith('/context-events')) {
          return new Response(new ReadableStream(), {
            headers: { 'content-type': 'text/event-stream' },
          });
        }
        if (url.pathname.endsWith('/desks')) {
          if (shouldFailDesks?.()) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'UNAVAILABLE',
                  message: 'Unavailable',
                  correlationId: 'corr-desks-err',
                },
              }),
              { status: 503, headers: { 'content-type': 'application/json' } },
            );
          }
          return Response.json({
            items: Array.from({ length: 12 }, (_, idx) => {
              const deskIndex = idx + 1;
              const isMine =
                assignedDeskIndex !== null && deskIndex === assignedDeskIndex;
              return {
                id: `desk-${deskIndex}`,
                deskIndex,
                membershipId: isMine ? 'membership-mine' : null,
                userId: isMine
                  ? profile.id
                  : deskIndex === 5
                    ? 'other-student-id'
                    : null,
              };
            }),
          });
        }
        if (url.pathname.endsWith('/points')) {
          return Response.json({
            classroomId: 'aula-1',
            studentId: profile.id,
            balance: 100,
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          });
        }
        const classroomId = url.pathname.split('/').pop() ?? 'aula-1';
        return Response.json({
          id: classroomId,
          name: `Aula ${classroomId}`,
          subject: null,
          schoolId: null,
          independentTeacherId: null,
          adultMode: false,
          chatMuted: false,
          collaborationLocked: false,
          gamesDisabled: false,
          myRole,
          capabilities: [],
          availablePanels,
          deskCount: 12,
          pet: petName
            ? {
                id: 'pet-1',
                name: petName,
                species: 'cat',
                level: 1,
                experience: 0,
              }
            : null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        });
      },
    }),
  );

  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <h2>Mis aulas</h2>,
      },
      {
        path: '/classrooms/:classroomId',
        element: <ClassroomWorkspace panels={syntheticPanels} />,
      },
    ],
    { initialEntries: ['/classrooms/aula-1'] },
  );

  const view = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );

  return { ...view, router, queryClient, session };
}

beforeEach(() => {
  resetClassroomModeStore();
  worldMock.latestProps = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Classroom interactables HUD and 3D intent wiring (#38)', () => {
  test('opens a panel from 3D object selection, locks world interaction, and restores focus to stage heading on close', async () => {
    const { container } = setup();
    await screen.findByTestId('world-mock');
    await screen.findByRole('button', { name: 'Mi pupitre #2' });

    const stageHeading = screen.getByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.stage3dHeading,
    });

    await expectAccessible(container);

    act(() => {
      worldMock.latestProps?.onHoverInteractable?.('board');
    });
    expect(worldMock.latestProps?.highlightedInteractableId).toBe('board');
    expect(screen.getByTestId('classroom-active-target')).toHaveTextContent(
      'Pizarra — Abrir Actividades',
    );

    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('board')!,
      );
    });

    const dialog = await screen.findByRole('dialog', { name: 'Actividades' });
    expect(dialog).toBeVisible();
    expect(worldMock.latestProps?.interactionLocked).toBe(true);
    expect(worldMock.latestProps?.highlightedInteractableId).toBeUndefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(stageHeading).toHaveFocus();
    expect(worldMock.latestProps?.interactionLocked).toBe(false);
  });

  test('highlights the 3D target when focusing a quick chip and restores focus to that chip on dialog close', async () => {
    setup();
    await screen.findByTestId('world-mock');

    const shopChip = screen.getByRole('button', { name: 'Tienda' });
    fireEvent.focus(shopChip);
    expect(worldMock.latestProps?.highlightedInteractableId).toBe('shop');
    expect(screen.getByTestId('classroom-active-target')).toHaveTextContent(
      'Tienda — Abrir Tienda',
    );

    shopChip.focus();
    fireEvent.click(shopChip);
    const dialog = await screen.findByRole('dialog', { name: 'Tienda' });
    expect(dialog).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(shopChip).toHaveFocus();
  });

  test('filters unavailable panel chips from the bar while 3D picking denies them honestly', async () => {
    setup({ availablePanels: ['activities'] });
    await screen.findByTestId('world-mock');

    const status = screen.getByTestId('classroom-interactable-status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toBeEmptyDOMElement();

    expect(screen.getByRole('button', { name: 'Pizarra' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Michi' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Puerta' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Tienda' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cartelera' }),
    ).not.toBeInTheDocument();

    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('bulletin-board')!,
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(status).toHaveTextContent(
      classroomMessages.interactables.panelDenied,
    );
  });

  test('omits the desk chip for teachers without an assigned desk while refusing 3D student desk clicks', async () => {
    setup({
      myRole: 'TEACHER',
      assignedDeskIndex: null,
      availablePanels: ['activities', 'members', 'grades'],
    });
    await screen.findByTestId('world-mock');

    await waitFor(() => expect(worldMock.latestProps?.ownDeskIndex).toBeNull());
    expect(
      screen.queryByRole('button', {
        name: classroomMessages.interactables.desksTitle,
      }),
    ).not.toBeInTheDocument();

    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('student-desk:1')!,
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('classroom-interactable-status'),
    ).toHaveTextContent(classroomMessages.interactables.noAssignedDesk);
  });

  test('offers a retry button when the desk map fails to load and recovers assigned desk on retry', async () => {
    let failDesks = true;
    setup({ assignedDeskIndex: 3, shouldFailDesks: () => failDesks });
    await screen.findByTestId('world-mock');

    const desksChip = await screen.findByRole('button', {
      name: classroomMessages.interactables.desksTitle,
    });
    const status = screen.getByTestId('classroom-interactable-status');

    // Wait until the failed /desks query moves out of pending before clicking.
    await waitFor(() => {
      fireEvent.click(desksChip);
      expect(status).toHaveTextContent(
        classroomMessages.interactables.desksUnavailable,
      );
    });

    const retryBtn = within(status).getByRole('button', {
      name: classroomMessages.interactables.retryDesksAction,
    });
    failDesks = false;
    fireEvent.click(retryBtn);

    expect(
      await screen.findByRole('button', { name: 'Mi pupitre #3' }),
    ).toBeVisible();
    await waitFor(() => expect(status).toBeEmptyDOMElement());
  });

  test('distinguishes own assigned desk from another student desk without leaking foreign data', async () => {
    setup({ assignedDeskIndex: 2 });
    await screen.findByTestId('world-mock');
    const ownChip = await screen.findByRole('button', {
      name: 'Mi pupitre #2',
    });
    expect(worldMock.latestProps?.ownDeskIndex).toBe(2);

    // Selecting desk 5 (assigned to another user) never opens grades.
    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('student-desk:5')!,
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('classroom-interactable-status'),
    ).toHaveTextContent(classroomMessages.interactables.foreignDesk);
    expect(screen.queryByText(/other-student-id/i)).not.toBeInTheDocument();

    // Selecting own assigned desk opens grades.
    fireEvent.click(ownChip);
    expect(
      await screen.findByRole('dialog', { name: 'Calificaciones' }),
    ).toBeVisible();
  });

  test('triggers decorative pet reaction distinct from tutor-bot without opening a panel', async () => {
    const { container } = setup({ petName: 'Michi' });
    await screen.findByTestId('world-mock');

    const initialNonce = worldMock.latestProps?.petReactionNonce ?? 0;
    const petChip = screen.getByRole('button', { name: 'Michi' });
    const botChip = screen.getByRole('button', {
      name: 'Asistente de estudio',
    });
    expect(petChip).not.toBe(botChip);

    fireEvent.click(petChip);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(worldMock.latestProps?.petReactionNonce).toBe(initialNonce + 1);
    expect(
      screen.getByTestId('classroom-interactable-status'),
    ).toHaveTextContent('Michi te saluda desde su rincón.');

    await expectAccessible(container);

    fireEvent.click(botChip);
    expect(
      await screen.findByRole('dialog', { name: 'Asistente de estudio' }),
    ).toBeVisible();
    expect(worldMock.latestProps?.petReactionNonce).toBe(initialNonce + 1);
  });

  test('navigates cleanly to Mis aulas when entrance is activated', async () => {
    const { router } = setup();
    await screen.findByTestId('world-mock');

    fireEvent.click(screen.getByRole('button', { name: 'Puerta' }));
    expect(
      await screen.findByRole('heading', { name: 'Mis aulas' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });
});
