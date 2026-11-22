import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { Classroom3DStage } from './classroom-3d-stage';
import { classroomMessages } from './messages';
import { ClassroomPanelsProvider } from './panels/classroom-panels';

const world = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
}));

vi.mock('../world', () => ({
  clearAssetCache: vi.fn(),
  PerformanceProbe: () => null,
  ClassroomWorld: (props: {
    label: string;
    scopeKey?: string;
    children?: ReactNode;
  }) => {
    world.props = props;
    return (
      <div role="region" aria-label={props.label}>
        <span data-testid="scene-host" />
        {props.children}
      </div>
    );
  },
}));

afterEach(() => vi.unstubAllGlobals());

function renderStage(classroomId = 'aula-7') {
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async () =>
        Response.json({
          items: [
            {
              id: 'desk-1',
              deskIndex: 1,
              membershipId: 'm-1',
              userId: profile.id,
            },
          ],
        }),
    }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <MemoryRouter>
          <ClassroomPanelsProvider
            userId={profile.id}
            classroomId={classroomId}
            registry={[
              {
                key: 'grades',
                title: 'Calificaciones',
                component: () => <p>Calificaciones</p>,
              },
            ]}
            availability={{ confirmed: true, keys: ['grades'] }}
            description="Paneles"
            fallbackFocus={() => null}
          >
            <Classroom3DStage
              scopeKey={classroomId}
              classroomId={classroomId}
              petName="Michi"
            />
          </ClassroomPanelsProvider>
        </MemoryRouter>
      </SessionProvider>
    </ApiQueryProvider>,
  );
}

test('mounts the lazy classroom world with the stage label, scope, and interactables bar', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  renderStage('aula-7');
  const region = await screen.findByRole('region', {
    name: classroomMessages.viewMode.canvasLabel,
  });
  expect(within(region).getByTestId('scene-host')).toBeInTheDocument();
  expect(world.props.scopeKey).toBe('aula-7');
  expect(
    screen.getByRole('navigation', {
      name: classroomMessages.interactables.navLabel,
    }),
  ).toBeVisible();
  expect(
    await screen.findByRole('button', { name: 'Mi pupitre #1' }),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Michi' })).toBeVisible();
});
