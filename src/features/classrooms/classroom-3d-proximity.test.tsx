import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import type { ClassroomInteractable } from '../world/classroom/classroom-interactables';
import { Classroom3DStage } from './classroom-3d-stage';
import { classroomMessages } from './messages';
import { ClassroomPanelsProvider } from './panels/classroom-panels';

interface WorldProps {
  highlightedInteractableId?: string;
  onHoverInteractable?: (id: string | undefined) => void;
  onProximityChange?: (id: string | undefined) => void;
  isProximityTarget?: (item: ClassroomInteractable) => boolean;
}

const world = vi.hoisted(() => ({ props: {} as WorldProps }));

vi.mock('../world', () => ({
  clearAssetCache: vi.fn(),
  PerformanceProbe: () => null,
  ClassroomWorld: (
    props: WorldProps & { label: string; children?: ReactNode },
  ) => {
    world.props = props;
    return (
      <div role="region" aria-label={props.label}>
        {props.children}
      </div>
    );
  },
}));

afterEach(() => vi.unstubAllGlobals());

const PANEL_KEYS = ['activities', 'shop', 'grades', 'members'];
const registry = PANEL_KEYS.map((key) => ({
  key,
  title: `Panel ${key}`,
  component: () => <p>{`Contenido ${key}`}</p>,
}));

function renderStage() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async () =>
        Response.json({
          items: [
            { id: 'd1', deskIndex: 1, membershipId: 'm-1', userId: profile.id },
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
            classroomId="aula-7"
            registry={registry}
            availability={{ confirmed: true, keys: PANEL_KEYS }}
            description="Paneles"
            fallbackFocus={() => null}
          >
            <Classroom3DStage
              scopeKey="aula-7"
              classroomId="aula-7"
              petName="Michi"
            />
            <input aria-label="Mensaje" />
          </ClassroomPanelsProvider>
        </MemoryRouter>
      </SessionProvider>
    </ApiQueryProvider>,
  );
}

async function nearTo(id: string | undefined) {
  await screen.findByRole('region', {
    name: classroomMessages.viewMode.canvasLabel,
  });
  act(() => world.props.onProximityChange?.(id));
}

const pressE = (
  init: KeyboardEventInit = {},
  target: Element = document.body,
) => fireEvent.keyDown(target, { code: 'KeyE', key: 'e', ...init });

describe('proximity prompt', () => {
  test('shows the key and the object action, and follows the target', async () => {
    renderStage();
    await nearTo('shop');
    const prompt = screen.getByRole('button', { name: /Abrir tienda/ });
    expect(prompt.querySelector('kbd')).toHaveTextContent('E');

    act(() => world.props.onProximityChange?.('board'));
    expect(
      screen.getByRole('button', { name: /Abrir actividades/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Abrir tienda/ })).toBeNull();
  });

  test('announces politely once per target change', async () => {
    renderStage();
    await nearTo('shop');
    const live = screen.getByTestId('classroom-proximity-status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent(
      classroomMessages.proximity.announce('Abrir tienda'),
    );
    act(() => world.props.onProximityChange?.(undefined));
    expect(live).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /Abrir tienda/ })).toBeNull();
  });

  test('the pet reads as a greeting with its name', async () => {
    renderStage();
    await nearTo('pet');
    expect(
      screen.getByRole('button', { name: /Saludar a Michi/ }),
    ).toBeInTheDocument();
  });

  test('the touch button is at least 44px tall and activates the target', async () => {
    renderStage();
    await nearTo('shop');
    const prompt = screen.getByRole('button', { name: /Abrir tienda/ });
    expect(prompt.className).toContain('min-h-11');
    fireEvent.click(prompt);
    expect(
      await screen.findByRole('dialog', { name: 'Panel shop' }),
    ).toBeInTheDocument();
  });
});

describe('E key', () => {
  test('opens the panel of the nearby target', async () => {
    renderStage();
    await nearTo('shop');
    pressE();
    expect(
      await screen.findByRole('dialog', { name: 'Panel shop' }),
    ).toBeInTheDocument();
  });

  test('is layout independent through event.code', async () => {
    renderStage();
    await nearTo('shop');
    pressE({ key: 'u' });
    expect(
      await screen.findByRole('dialog', { name: 'Panel shop' }),
    ).toBeInTheDocument();
  });

  test('does nothing without a nearby target and does not swallow the key', async () => {
    renderStage();
    await nearTo(undefined);
    expect(pressE()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('is ignored while typing in a text control', async () => {
    renderStage();
    await nearTo('shop');
    pressE({}, screen.getByLabelText('Mensaje'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test.each([
    ['ctrl', { ctrlKey: true }],
    ['alt', { altKey: true }],
    ['meta', { metaKey: true }],
    ['repeat', { repeat: true }],
  ])('is ignored with %s', async (_name, init) => {
    renderStage();
    await nearTo('shop');
    pressE(init);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('is ignored while another dialog is open', async () => {
    renderStage();
    await nearTo('shop');
    const foreign = document.createElement('div');
    foreign.setAttribute('role', 'dialog');
    document.body.append(foreign);
    pressE();
    foreign.remove();
    expect(screen.queryByRole('dialog', { name: 'Panel shop' })).toBeNull();
  });

  test('is ignored once the stage unmounts (2D mode)', async () => {
    const view = renderStage();
    await nearTo('shop');
    view.unmount();
    expect(() => pressE()).not.toThrow();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('does not open a second panel while one is open', async () => {
    renderStage();
    await nearTo('shop');
    pressE();
    await screen.findByRole('dialog', { name: 'Panel shop' });
    act(() => world.props.onProximityChange?.('board'));
    pressE();
    expect(
      screen.queryByRole('dialog', { name: 'Panel activities' }),
    ).toBeNull();
  });
});

describe('availability and highlight', () => {
  test('only reachable objects can be proximity targets', async () => {
    renderStage();
    await nearTo(undefined);
    const isTarget = (id: string, extra: Partial<ClassroomInteractable> = {}) =>
      world.props.isProximityTarget!({
        id,
        type: 'shop',
        interactionClass: 'opens_panel',
        panelKey: 'shop',
        worldPosition: [0, 0, 0],
        footprint: [1, 1],
        beaconHeight: 1,
        ...extra,
      });
    expect(isTarget('shop')).toBe(true);
    expect(
      isTarget('pet', { type: 'pet', interactionClass: 'decorative' }),
    ).toBe(true);
    expect(
      isTarget('entrance', {
        type: 'entrance',
        interactionClass: 'direct_transition',
      }),
    ).toBe(false);
    expect(isTarget('x', { panelKey: 'notices' })).toBe(false);
    expect(
      isTarget('student-desk:2', {
        type: 'student-desk',
        panelKey: 'grades',
        deskIndex: 2,
      }),
    ).toBe(false);
  });

  test('the HUD focus or hover wins over proximity, which wins otherwise', async () => {
    renderStage();
    await nearTo('shop');
    expect(world.props.highlightedInteractableId).toBe('shop');

    act(() => world.props.onHoverInteractable?.('board'));
    expect(world.props.highlightedInteractableId).toBe('board');

    act(() => world.props.onHoverInteractable?.(undefined));
    expect(world.props.highlightedInteractableId).toBe('shop');
  });

  test('highlight and prompt are suppressed while a panel is open', async () => {
    renderStage();
    await nearTo('shop');
    pressE();
    await screen.findByRole('dialog', { name: 'Panel shop' });
    expect(world.props.highlightedInteractableId).toBeUndefined();
    expect(screen.queryByRole('button', { name: /Abrir tienda/ })).toBeNull();
  });
});
