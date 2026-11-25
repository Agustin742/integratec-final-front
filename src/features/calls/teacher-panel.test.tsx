import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CallParticipantState } from './call-session';
import { TeacherPanel, type TeacherPanelProps } from './teacher-panel';

function person(
  n: number,
  overrides: Partial<CallParticipantState> = {},
): CallParticipantState {
  return {
    sessionId: `s${n}`,
    userId: `00000000-0000-4000-8000-00000000000${n}`,
    displayName: `Alumno ${n}`,
    role: 'STUDENT',
    selfMuted: false,
    forcedMuted: false,
    speaking: false,
    emote: '',
    emoteSeq: 0,
    appearance: {} as CallParticipantState['appearance'],
    isSelf: false,
    muted: false,
    ...overrides,
  };
}

function setup(overrides: Partial<TeacherPanelProps> = {}) {
  const props: TeacherPanelProps = {
    participants: [
      person(0, { role: 'TEACHER', isSelf: true, displayName: 'Profe' }),
      person(1),
      person(2, { muted: true, forcedMuted: true }),
    ],
    allowSelfUnmute: false,
    focusMode: false,
    onModerate: vi.fn(),
    ...overrides,
  };
  render(<TeacherPanel {...props} />);
  return props;
}

describe('TeacherPanel', () => {
  it('lists only students and offers mute or unmute per student', () => {
    const props = setup();
    expect(screen.queryByText('Profe')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Silenciar a Alumno 1' }),
    );
    expect(props.onModerate).toHaveBeenCalledWith({
      action: 'mute',
      targetUserId: '00000000-0000-4000-8000-000000000001',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Activar el micrófono de Alumno 2' }),
    );
    expect(props.onModerate).toHaveBeenCalledWith({
      action: 'unmute',
      targetUserId: '00000000-0000-4000-8000-000000000002',
    });
  });

  it('mute all also forbids self-unmute', () => {
    const props = setup({ allowSelfUnmute: true });
    fireEvent.click(screen.getByRole('button', { name: 'Silenciar a todos' }));
    expect(props.onModerate).toHaveBeenNthCalledWith(1, { action: 'mute-all' });
    expect(props.onModerate).toHaveBeenNthCalledWith(2, {
      action: 'allow-self-unmute',
      value: false,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Silenciaste a todos los alumnos.',
    );
  });

  it('toggles self-unmute and focus mode through labelled switches', () => {
    const props = setup();
    const allow = screen.getByRole('switch', {
      name: 'Permitir que activen su micrófono',
    });
    expect(allow).not.toBeChecked();
    fireEvent.click(allow);
    expect(props.onModerate).toHaveBeenCalledWith({
      action: 'allow-self-unmute',
      value: true,
    });
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Modo foco: ocultar el aula 3D a los alumnos',
      }),
    );
    expect(props.onModerate).toHaveBeenCalledWith({
      action: 'focus-mode',
      value: true,
    });
  });

  it('reflects the current state and shows an empty message', () => {
    setup({ participants: [], allowSelfUnmute: true, focusMode: true });
    expect(
      screen.getByRole('switch', { name: 'Permitir que activen su micrófono' }),
    ).toBeChecked();
    expect(
      screen.getByRole('switch', {
        name: 'Modo foco: ocultar el aula 3D a los alumnos',
      }),
    ).toBeChecked();
    expect(
      screen.getByText('Todavía no hay alumnos en la llamada.'),
    ).toBeInTheDocument();
  });
});
