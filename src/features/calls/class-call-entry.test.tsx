import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassCallButtonView, IncomingCallPrompt } from './class-call-entry';

describe('ClassCallButtonView', () => {
  it('renders the rail variant like the other classroom features', () => {
    render(
      <ClassCallButtonView
        appearance="rail"
        className="rail-item"
        canStart
        active={false}
        inCall={false}
        onClick={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Iniciar clase en llamada',
    });
    expect(button).toHaveAttribute('title', 'Iniciar clase en llamada');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button).toHaveClass('rail-item');
  });

  it('renders the tile variant like the 2D panel buttons', () => {
    render(
      <ClassCallButtonView
        appearance="tile"
        canStart={false}
        active
        inCall={false}
        onClick={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Unirse a la llamada' }),
    ).toHaveTextContent('Unirse');
  });

  it('starts for moderators and joins for students only when active', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <ClassCallButtonView
        canStart
        active={false}
        inCall={false}
        onClick={onClick}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Iniciar clase en llamada' }),
    );
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <ClassCallButtonView
        canStart={false}
        active={false}
        inCall={false}
        onClick={onClick}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <ClassCallButtonView
        canStart={false}
        active
        inCall={false}
        onClick={onClick}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Unirse a la llamada' }),
    ).toBeInTheDocument();
  });
});

describe('IncomingCallPrompt', () => {
  const calls = [
    { callerUserId: 'u1', callerDisplayName: 'Ana' },
    { callerUserId: 'u2', callerDisplayName: 'Beto' },
  ];

  it('accepts and declines each caller separately', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(
      <IncomingCallPrompt
        calls={calls}
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );
    expect(screen.getByText('Ana te está llamando')).toBeInTheDocument();
    const beto = screen.getByRole('group', { name: 'Beto te está llamando' });
    fireEvent.click(within(beto).getByRole('button', { name: 'Aceptar' }));
    expect(onAccept).toHaveBeenCalledWith(calls[1]);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Rechazar' })[0] as HTMLElement,
    );
    expect(onDecline).toHaveBeenCalledWith(calls[0]);
  });

  it('renders nothing without calls', () => {
    const { container } = render(
      <IncomingCallPrompt calls={[]} onAccept={vi.fn()} onDecline={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
