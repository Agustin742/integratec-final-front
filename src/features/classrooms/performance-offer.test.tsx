import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter, useOutletContext } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { createAppRoutes } from '@/app/router/routes';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { render } from '@/test/render';
import {
  getClassroomMode,
  resetClassroomModeStore,
} from './classroom-mode-store';
import { ClassroomWorkspace } from './classroom-workspace';
import { classroomMessages } from './messages';
import {
  beginPerformanceOffer,
  resetPerformanceOfferStore,
  usePerformanceOfferStore,
} from './performance-offer-store';

type Detail = components['schemas']['ClassroomContextResponseDto'];

function buildDetail(id: string): Detail {
  return {
    id,
    name: `Aula ${id}`,
    subject: null,
    schoolId: null,
    independentTeacherId: null,
    adultMode: true,
    chatMuted: true,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: 'STUDENT',
    capabilities: ['view_metrics', 'participate_activities'],
    availablePanels: ['activities', 'grades'],
    deskCount: 1,
    pet: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function OutletProbe() {
  const context = useOutletContext<Detail>();
  return (
    <output data-testid="workspace-outlet">{`${context.id}:${context.myRole}`}</output>
  );
}

function setupWorkspace() {
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const request = input as Request;
        if (request.url.endsWith('/context-events')) {
          return new Response(new ReadableStream(), {
            headers: { 'content-type': 'text/event-stream' },
          });
        }
        const id = new URL(request.url).pathname.split('/').pop() ?? 'a';
        return Response.json(buildDetail(id));
      },
    }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    createAppRoutes({
      protectedRoutes: [
        {
          path: 'test-classrooms/:classroomId',
          Component: ClassroomWorkspace,
          children: [{ index: true, Component: OutletProbe }],
        },
      ],
    }),
    { initialEntries: ['/classrooms/a'] },
  );

  return render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );
}

/** The header toggle shares its label with the offer's accept button. */
function headerToggle(name: string) {
  const offer = screen.queryByTestId('performance-offer');
  const match = screen
    .getAllByRole('button', { name })
    .find((button) => !offer?.contains(button));
  if (!match) {
    throw new Error(`Header toggle "${name}" not found`);
  }
  return match;
}

/**
 * Issue #56 S4/S5/S6/S7a/S7b: sustained low fps shows a non-blocking offer;
 * the app never switches by itself; decline is remembered for the session.
 */
describe('ClassroomWorkspace performance offer (#56)', () => {
  beforeEach(() => {
    resetClassroomModeStore();
    resetPerformanceOfferStore();
  });

  test('no offer appears while performance is fine', async () => {
    setupWorkspace();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3 })).toBeTruthy(),
    );
    expect(screen.queryByTestId('performance-offer')).toBeNull();
  });

  test('sustained low fps announces the offer without switching modes (S7b)', async () => {
    setupWorkspace();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3 })).toBeTruthy(),
    );

    act(() => {
      beginPerformanceOffer();
    });

    // Announced to assistive technology through the Alert's default status
    // role, without a redundant explicit role or aria-live.
    const offer = screen.getByTestId('performance-offer');
    expect(offer).toHaveAttribute('role', 'status');
    expect(within(offer).queryAllByRole('status')).toHaveLength(0);
    expect(offer).not.toHaveAttribute('aria-live');
    expect(offer.textContent).toContain(
      classroomMessages.performanceOffer.body,
    );
    expect(classroomMessages.performanceOffer.body).toContain('Alt+M');
    expect(classroomMessages.performanceOffer.accept).toBe(
      classroomMessages.viewMode.switchTo2d,
    );
    expect(offer.textContent).toContain(
      classroomMessages.performanceOffer.title,
    );

    // No mode change occurs without the user's choice.
    expect(getClassroomMode(profile.id)).toBe('3d');
    expect(headerToggle(classroomMessages.viewMode.switchTo2d)).toBeTruthy();
  });

  test('accepting switches to 2D Classic Mode through the HU-ESP-003 action', async () => {
    setupWorkspace();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3 })).toBeTruthy(),
    );

    act(() => {
      beginPerformanceOffer();
    });
    fireEvent.click(
      within(screen.getByTestId('performance-offer')).getByRole('button', {
        name: classroomMessages.performanceOffer.accept,
      }),
    );

    expect(getClassroomMode(profile.id)).toBe('2d');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: classroomMessages.viewMode.mode2dHeading,
        }),
      ).toBeTruthy(),
    );
    expect(screen.queryByTestId('performance-offer')).toBeNull();
  });

  test('declining keeps 3D and is remembered for the session (S6)', async () => {
    setupWorkspace();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3 })).toBeTruthy(),
    );

    act(() => {
      beginPerformanceOffer();
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.performanceOffer.decline,
      }),
    );

    expect(getClassroomMode(profile.id)).toBe('3d');
    expect(screen.queryByTestId('performance-offer')).toBeNull();

    // A later sustained low period must not re-offer after a decline.
    act(() => {
      beginPerformanceOffer();
    });
    expect(screen.queryByTestId('performance-offer')).toBeNull();
    expect(getClassroomMode(profile.id)).toBe('3d');
  });

  test('declining moves focus to the 3D stage heading', async () => {
    setupWorkspace();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3 })).toBeTruthy(),
    );

    act(() => {
      beginPerformanceOffer();
    });
    const decline = screen.getByRole('button', {
      name: classroomMessages.performanceOffer.decline,
    });
    decline.focus();
    fireEvent.click(decline);

    expect(screen.queryByTestId('performance-offer')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', {
        name: classroomMessages.viewMode.stage3dHeading,
      }),
    );
  });

  test('switching to 2D with the header toggle resolves the offer', async () => {
    setupWorkspace();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3 })).toBeTruthy(),
    );

    act(() => {
      beginPerformanceOffer();
    });
    fireEvent.click(headerToggle(classroomMessages.viewMode.switchTo2d));
    expect(usePerformanceOfferStore.getState().status).toBe('accepted');

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: classroomMessages.viewMode.mode2dHeading,
        }),
      ).toBeTruthy(),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo3d,
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: classroomMessages.viewMode.stage3dHeading,
        }),
      ).toBeTruthy(),
    );
    expect(screen.queryByTestId('performance-offer')).toBeNull();
  });

  test('switching to 2D with Alt+M resolves the offer', async () => {
    setupWorkspace();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3 })).toBeTruthy(),
    );

    act(() => {
      beginPerformanceOffer();
    });
    fireEvent.keyDown(window, { key: 'm', code: 'KeyM', altKey: true });

    await waitFor(() => expect(getClassroomMode(profile.id)).toBe('2d'));
    expect(usePerformanceOfferStore.getState().status).toBe('accepted');
  });
});
