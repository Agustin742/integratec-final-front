import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallParticipantState } from './call-session';

vi.mock('./call-stage-canvas', () => ({
  default: (props: {
    tiles: readonly { sessionId: string }[];
    rects: readonly unknown[];
    onUnavailable: () => void;
  }) => (
    <div data-testid="stage-canvas" data-tiles={props.tiles.length}>
      <button type="button" onClick={props.onUnavailable}>
        lose webgl
      </button>
    </div>
  ),
}));

import { CallStage } from './call-stage';

const appearance = {
  bodyId: 'female',
  hairId: 'classic-short',
  topId: 'basic-tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
  items: {},
};

function person(
  n: number,
  overrides: Partial<CallParticipantState> = {},
): CallParticipantState {
  return {
    sessionId: `s${n}`,
    userId: `u${n}`,
    displayName: `Persona ${n}`,
    role: 'student',
    selfMuted: false,
    forcedMuted: false,
    speaking: false,
    emote: '',
    emoteSeq: 0,
    appearance,
    isSelf: false,
    muted: false,
    ...overrides,
  };
}

let resize: (width: number, height: number) => void = () => {};

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {
        resize = (width, height) =>
          this.callback(
            [{ contentRect: { width, height } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

async function mountStage(participants: readonly CallParticipantState[]) {
  const view = render(
    <CallStage participants={participants} getLevel={() => 0} />,
  );
  await act(async () => resize(900, 500));
  return view;
}

describe('CallStage', () => {
  it('renders one labeled square tile per participant with a single canvas', async () => {
    await mountStage([person(1), person(2), person(3)]);
    const tiles = screen.getAllByRole('group');
    expect(tiles).toHaveLength(3);
    for (const tile of tiles) {
      expect(tile.style.width).toBe(tile.style.height);
    }
    expect(await screen.findAllByTestId('stage-canvas')).toHaveLength(1);
    expect(screen.getByText('Persona 2')).toBeInTheDocument();
  });

  it('describes state in the tile name: muted, speaking and self', async () => {
    await mountStage([
      person(1, { isSelf: true, speaking: true }),
      person(2, { muted: true }),
    ]);
    expect(
      screen.getByRole('group', { name: 'Persona 1 (vos), hablando' }),
    ).toHaveAttribute('data-speaking', 'true');
    const muted = screen.getByRole('group', {
      name: 'Persona 2, micrófono silenciado',
    });
    expect(muted).toHaveAttribute('data-speaking', 'false');
    expect(within(muted).getByTestId('muted-icon')).toBeInTheDocument();
  });

  it('does not mark a muted participant as speaking', async () => {
    await mountStage([person(1, { speaking: true, muted: true })]);
    expect(screen.getByRole('group')).toHaveAttribute('data-speaking', 'false');
  });

  it('announces speaker changes politely', async () => {
    const { rerender } = await mountStage([person(1), person(2)]);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('');
    rerender(
      <CallStage
        participants={[person(1), person(2, { speaking: true })]}
        getLevel={() => 0}
      />,
    );
    expect(status).toHaveTextContent('Persona 2 está hablando');
  });

  it('relayouts on resize', async () => {
    await mountStage([person(1), person(2)]);
    const wide = screen.getAllByRole('group')[0]?.style.width;
    await act(async () => resize(300, 800));
    const narrow = screen.getAllByRole('group')[0]?.style.width;
    expect(narrow).not.toBe(wide);
  });

  it('falls back to 2D avatar tiles when WebGL is unavailable', async () => {
    await mountStage([
      person(1),
      person(2, { appearance: { ...appearance, bodyId: '' } }),
    ]);
    await act(async () => {
      (await screen.findByText('lose webgl')).click();
    });
    expect(screen.queryByTestId('stage-canvas')).not.toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-avatar-preview="true"]'),
    ).toHaveLength(1);
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('renders no tiles when nobody is in the call', async () => {
    await mountStage([]);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
  });
});
