import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassroomWorldHud } from './classroom-3d-hud';

function setup(callAction?: React.ReactNode) {
  render(
    <ClassroomWorldHud
      myDeskIndex={null}
      feedback={null}
      canOpenPanel={(key) => key === 'members'}
      onFocusInteractable={vi.fn()}
      onOpenPanel={vi.fn()}
      callAction={callAction}
    />,
  );
}

describe('ClassroomWorldHud call entry', () => {
  it('adds the call action to the side rail beside the other features', () => {
    setup(<button type="button">Iniciar clase en llamada</button>);
    const rail = screen.getByTestId('classroom-3d-panels-right');
    expect(
      within(rail).getByRole('button', { name: 'Iniciar clase en llamada' }),
    ).toBeInTheDocument();
    expect(
      within(rail).getByRole('button', { name: /Integrantes/ }),
    ).toBeInTheDocument();
  });

  it('keeps the rail free of call UI without an action', () => {
    setup();
    const rail = screen.getByTestId('classroom-3d-panels-right');
    expect(within(rail).getAllByRole('button')).toHaveLength(1);
  });
});
