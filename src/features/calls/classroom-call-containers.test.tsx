import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassroomCallSignals } from './use-classroom-call-signals';

const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ toast: toastMock.toast }));

let signals: ClassroomCallSignals;
vi.mock('./use-classroom-call-signals', () => ({
  useClassroomCallSignals: () => signals,
}));

let calls: { start: ReturnType<typeof vi.fn>; inCall: boolean } | null;
vi.mock('./call-provider', () => ({ useCalls: () => calls }));

let capabilities: readonly string[] = [];
vi.mock('@/features/classrooms/use-classroom-capabilities', () => ({
  useClassroomContext: () => ({
    status: 'ready',
    userId: 'me',
    classroom: { capabilities, myRole: 'STUDENT' },
  }),
}));

import {
  ClassCallButton,
  DirectCallButton,
  IncomingCallListener,
  useWorldLocked,
} from './classroom-call-containers';

const CLASSROOM = '11111111-1111-4111-8111-111111111111';
const PEER = '22222222-2222-4222-8222-222222222222';

function makeSignals(
  overrides: Partial<ClassroomCallSignals> = {},
): ClassroomCallSignals {
  return {
    connected: true,
    classCallActive: false,
    focusMode: false,
    incomingCalls: [],
    declinedByUserId: null,
    declineCall: vi.fn().mockReturnValue(true),
    dismissDeclined: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  toastMock.toast.mockClear();
  signals = makeSignals();
  calls = { start: vi.fn(), inCall: false };
  capabilities = [];
});

describe('IncomingCallListener', () => {
  it('accepting joins the direct call with the caller as peer', () => {
    signals = makeSignals({
      incomingCalls: [{ callerUserId: PEER, callerDisplayName: 'Ana' }],
    });
    render(<IncomingCallListener classroomId={CLASSROOM} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(calls?.start).toHaveBeenCalledWith(
      { kind: 'direct', classroomId: CLASSROOM, peerUserId: PEER },
      'Ana',
    );
    expect(signals.declineCall).not.toHaveBeenCalled();
  });

  it('declining sends the decline signal', () => {
    signals = makeSignals({
      incomingCalls: [{ callerUserId: PEER, callerDisplayName: 'Ana' }],
    });
    render(<IncomingCallListener classroomId={CLASSROOM} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(signals.declineCall).toHaveBeenCalledWith(PEER);
    expect(calls?.start).not.toHaveBeenCalled();
  });

  it('tells the caller when the peer declined', () => {
    signals = makeSignals({ declinedByUserId: PEER });
    render(<IncomingCallListener classroomId={CLASSROOM} />);
    expect(toastMock.toast).toHaveBeenCalledWith(
      'Rechazaron tu llamada.',
      expect.anything(),
    );
    expect(signals.dismissDeclined).toHaveBeenCalled();
  });

  it('does not ring while the user is already in a call', () => {
    calls = { start: vi.fn(), inCall: true };
    signals = makeSignals({
      incomingCalls: [{ callerUserId: PEER, callerDisplayName: 'Ana' }],
    });
    render(<IncomingCallListener classroomId={CLASSROOM} />);
    expect(screen.queryByText('Ana te está llamando')).not.toBeInTheDocument();
  });
});

describe('ClassCallButton', () => {
  it('shows for classroom moderators (moderate_chat) and starts the call', () => {
    capabilities = ['moderate_chat'];
    render(<ClassCallButton classroomId={CLASSROOM} classroomName="Mate" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Iniciar clase en llamada' }),
    );
    expect(calls?.start).toHaveBeenCalledOnce();
  });

  it('is hidden for students until the class call is running', () => {
    const { rerender } = render(
      <ClassCallButton classroomId={CLASSROOM} classroomName="Mate" />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    signals = makeSignals({ classCallActive: true });
    rerender(<ClassCallButton classroomId={CLASSROOM} classroomName="Mate" />);
    expect(
      screen.getByRole('button', { name: 'Unirse a la llamada' }),
    ).toBeInTheDocument();
  });
});

describe('useWorldLocked', () => {
  function Probe({ myRole }: { readonly myRole: string }) {
    return <p>{useWorldLocked(CLASSROOM, myRole) ? 'locked' : 'open'}</p>;
  }

  it('locks the world for students in focus mode and restores it', () => {
    signals = makeSignals({ focusMode: true });
    const { rerender } = render(<Probe myRole="STUDENT" />);
    expect(screen.getByText('locked')).toBeInTheDocument();
    rerender(<Probe myRole="TEACHER" />);
    expect(screen.getByText('open')).toBeInTheDocument();
    signals = makeSignals({ focusMode: false });
    rerender(<Probe myRole="STUDENT" />);
    expect(screen.getByText('open')).toBeInTheDocument();
  });
});

describe('DirectCallButton', () => {
  it('starts a direct call with the member as peer', () => {
    render(
      <DirectCallButton
        classroomId={CLASSROOM}
        peerUserId={PEER}
        peerName="Ana"
      />,
    );
    const button = screen.getByRole('button', { name: 'Llamar a Ana' });
    expect(button).toHaveAttribute('title', 'Llamar a Ana');
    expect(button).toHaveTextContent('Llamar');
    expect(button.querySelector('svg')).not.toBeNull();
    fireEvent.click(button);
    expect(calls?.start).toHaveBeenCalledWith(
      { kind: 'direct', classroomId: CLASSROOM, peerUserId: PEER },
      'Ana',
    );
  });

  it('is hidden outside the provider or during a call', () => {
    calls = null;
    const { container, rerender } = render(
      <DirectCallButton
        classroomId={CLASSROOM}
        peerUserId={PEER}
        peerName="Ana"
      />,
    );
    expect(container).toBeEmptyDOMElement();
    calls = { start: vi.fn(), inCall: true };
    rerender(
      <DirectCallButton
        classroomId={CLASSROOM}
        peerUserId={PEER}
        peerName="Ana"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
