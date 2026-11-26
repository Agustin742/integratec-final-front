import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CallControlsBar,
  type CallControlsBarProps,
} from './call-controls-bar';

const self = {
  muted: false,
  forcedMuted: false,
  canUnmute: true,
  hasMicrophone: true,
};

function setup(overrides: Partial<CallControlsBarProps> = {}) {
  const props: CallControlsBarProps = {
    self,
    isModerator: false,
    onToggleMute: vi.fn(),
    onSendEmote: vi.fn(),
    onLeave: vi.fn(),
    onEndCall: vi.fn(),
    ...overrides,
  };
  render(<CallControlsBar {...props} />);
  return props;
}

describe('CallControlsBar', () => {
  it('toggles the microphone', () => {
    const props = setup();
    fireEvent.click(
      screen.getByRole('button', { name: 'Silenciar mi micrófono' }),
    );
    expect(props.onToggleMute).toHaveBeenCalledOnce();
  });

  it('shows the unmute label and pressed state while muted', () => {
    setup({ self: { ...self, muted: true } });
    expect(
      screen.getByRole('button', { name: 'Activar mi micrófono' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables the mic and explains why when forced muted', () => {
    setup({
      self: { ...self, muted: true, forcedMuted: true, canUnmute: false },
    });
    const button = screen.getByRole('button', { name: 'Activar mi micrófono' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      'Tu profe te silenció y todavía no habilitó que actives tu micrófono.',
    );
  });

  it('explains when there is no microphone', () => {
    setup({ self: { ...self, hasMicrophone: false, canUnmute: false } });
    expect(screen.getByRole('button', { name: /micrófono/i })).toBeDisabled();
    expect(screen.getByText(/No hay micrófono disponible/)).toBeInTheDocument();
  });

  it('offers all 13 emotes and sends the chosen one', () => {
    const props = setup();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reacción' }), {
      key: 'Enter',
    });
    expect(screen.getAllByRole('menuitem')).toHaveLength(13);
    fireEvent.click(screen.getByRole('menuitem', { name: /Bailar/ }));
    expect(props.onSendEmote).toHaveBeenCalledWith('dance');
  });

  it('labels the emote button Reacción with an icon, no emoji, and a tooltip', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Reacción' });
    expect(button).toHaveAttribute('title', 'Reacción');
    expect(button.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('shows each reaction with an svg icon and a Spanish label, no emoji', () => {
    setup();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reacción' }), {
      key: 'Enter',
    });
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(13);
    for (const item of items) {
      expect(item.querySelector('svg')).not.toBeNull();
      expect(item.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(items.map((item) => item.textContent)).toEqual([
      'Saludar',
      'Alegría',
      'Tristeza',
      'Enojo',
      'Pensar',
      'Celebrar',
      'Levantar la mano',
      'Aplaudir',
      'Asentir',
      'Negar',
      'Bailar',
      'Explicar',
      'Señalar',
    ]);
  });

  it('gives every icon button a tooltip', () => {
    setup({ isModerator: true });
    for (const name of ['Silenciar mi micrófono', 'Salir de la llamada']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'title',
        name,
      );
    }
  });

  it('leaves the call', () => {
    const props = setup();
    fireEvent.click(
      screen.getByRole('button', { name: 'Salir de la llamada' }),
    );
    expect(props.onLeave).toHaveBeenCalledOnce();
  });

  it('shows "Finalizar clase" only to moderators', () => {
    const props = setup({ isModerator: true });
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar clase' }));
    expect(props.onEndCall).toHaveBeenCalledOnce();
  });

  it('hides "Finalizar clase" from participants', () => {
    setup();
    expect(
      screen.queryByRole('button', { name: 'Finalizar clase' }),
    ).not.toBeInTheDocument();
  });
});
