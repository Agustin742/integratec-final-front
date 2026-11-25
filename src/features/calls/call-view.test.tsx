import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./call-stage', () => ({
  CallStage: ({ participants }: { participants: readonly unknown[] }) => (
    <div data-testid="stage" data-count={participants.length} />
  ),
}));

import { CallView, type CallViewProps } from './call-view';

const base: CallViewProps = {
  title: 'Clase en llamada: Matemática',
  participants: [],
  self: {
    muted: false,
    forcedMuted: false,
    canUnmute: true,
    hasMicrophone: true,
  },
  micError: null,
  needsAudioUnlock: false,
  isModerator: false,
  kind: 'classroom',
  allowSelfUnmute: false,
  focusMode: false,
  getLevel: () => 0,
  onToggleMute: vi.fn(),
  onSendEmote: vi.fn(),
  onLeave: vi.fn(),
  onEndCall: vi.fn(),
  onResumeAudio: vi.fn(),
  onModerate: vi.fn(),
};

describe('CallView', () => {
  it('renders the stage and the controls', () => {
    render(<CallView {...base} />);
    expect(
      screen.getByRole('heading', { name: base.title }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('stage')).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Controles de la llamada' }),
    ).toBeInTheDocument();
  });

  it('shows the participant count in the top bar', () => {
    const p = (n: number) =>
      ({
        sessionId: `s${n}`,
        userId: `u${n}`,
        displayName: `P${n}`,
        isSelf: n === 0,
        muted: false,
      }) as (typeof base.participants)[number];
    render(<CallView {...base} participants={[p(0), p(1), p(2)]} />);
    expect(screen.getByText('3 en la llamada')).toBeInTheDocument();
  });

  it('toggles the in-call chat panel when a chat is provided', () => {
    render(<CallView {...base} chatPanel={<div>CHAT BODY</div>} />);
    expect(screen.queryByText('CHAT BODY')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Abrir el chat' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByText('CHAT BODY')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el chat' }));
    expect(screen.queryByText('CHAT BODY')).not.toBeInTheDocument();
  });

  it('has no chat toggle without a chat panel', () => {
    render(<CallView {...base} />);
    expect(
      screen.queryByRole('button', { name: 'Abrir el chat' }),
    ).not.toBeInTheDocument();
  });

  it('offers to unlock blocked audio from a click', () => {
    const onResumeAudio = vi.fn();
    render(
      <CallView {...base} needsAudioUnlock onResumeAudio={onResumeAudio} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Activar audio' }));
    expect(onResumeAudio).toHaveBeenCalledOnce();
  });

  it('explains a microphone error and keeps the call', () => {
    render(<CallView {...base} micError="denied" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos usar tu micrófono porque el permiso está bloqueado.',
    );
    expect(screen.getByTestId('stage')).toBeInTheDocument();
  });

  it('shows the teacher panel only to moderators of a class call', () => {
    const { rerender } = render(<CallView {...base} />);
    expect(screen.queryByText('Controles de la clase')).not.toBeInTheDocument();
    rerender(<CallView {...base} isModerator />);
    expect(screen.getByText('Controles de la clase')).toBeInTheDocument();
    rerender(<CallView {...base} isModerator kind="direct" />);
    expect(screen.queryByText('Controles de la clase')).not.toBeInTheDocument();
  });
});
