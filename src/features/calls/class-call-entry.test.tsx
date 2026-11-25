import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ClassCallBanner,
  ClassCallButtonView,
  IncomingCallPrompt,
} from './class-call-entry';

describe('ClassCallBanner', () => {
  it('lets a moderator start a class call', () => {
    const onStart = vi.fn();
    render(
      <ClassCallBanner
        canStart
        active={false}
        inCall={false}
        onStart={onStart}
        onJoin={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Iniciar clase en llamada' }),
    );
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('shows students the running class call with a join button', () => {
    const onJoin = vi.fn();
    render(
      <ClassCallBanner
        canStart={false}
        active
        inCall={false}
        onStart={vi.fn()}
        onJoin={onJoin}
      />,
    );
    expect(screen.getByText('La clase está en llamada')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Iniciar clase en llamada' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unirse' }));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it('shows nothing to a student when no class call is running', () => {
    const { container } = render(
      <ClassCallBanner
        canStart={false}
        active={false}
        inCall={false}
        onStart={vi.fn()}
        onJoin={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('hides itself while already in a call', () => {
    const { container } = render(
      <ClassCallBanner
        canStart
        active
        inCall
        onStart={vi.fn()}
        onJoin={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ClassCallButtonView', () => {
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
