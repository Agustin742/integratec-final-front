import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseCallSessionResult } from './use-call-session';

const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({
  toast: Object.assign(toastMock.toast, {
    info: toastMock.toast,
    error: toastMock.toast,
  }),
}));

let session: Partial<UseCallSessionResult>;
vi.mock('./use-call-session', () => ({
  useCallSession: () => session,
}));
vi.mock('@/features/classrooms/chat/chat-conversation', () => ({
  ChatConversationWithComposer: () => <div>chat</div>,
}));
vi.mock('./call-stage', () => ({
  CallStage: () => <div data-testid="stage" />,
}));

import { CallProvider, useCalls } from './call-provider';
// Load the lazy CallView module during test-file import (after hoisted vi.mock
// calls) so cold Vite transforms do not consume the first test's 5 s budget.
import './call-view';

const CLASSROOM = '11111111-1111-4111-8111-111111111111';

function Starter() {
  const calls = useCalls();
  return (
    <button
      type="button"
      onClick={() =>
        calls?.start(
          { kind: 'classroom', classroomId: CLASSROOM },
          'Matemática',
        )
      }
    >
      start
    </button>
  );
}

function makeSession(overrides: Partial<UseCallSessionResult> = {}) {
  session = {
    status: 'idle',
    endReason: null,
    micError: null,
    participants: [],
    self: {
      muted: false,
      forcedMuted: false,
      canUnmute: true,
      hasMicrophone: true,
    },
    focusMode: false,
    allowSelfUnmute: false,
    isModerator: false,
    needsAudioUnlock: false,
    kind: null,
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
    toggleMute: vi.fn(),
    sendEmote: vi.fn(),
    moderate: vi.fn(),
    endCall: vi.fn(),
    resumeAudio: vi.fn().mockResolvedValue(undefined),
    getLevel: () => 0,
    ...overrides,
  };
}

describe('CallProvider', () => {
  beforeEach(() => {
    toastMock.toast.mockClear();
    makeSession();
  });

  it('joins from the click that starts the call', async () => {
    const { rerender } = render(
      <CallProvider>
        <Starter />
      </CallProvider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    expect(session.join).toHaveBeenCalledWith({
      kind: 'classroom',
      classroomId: CLASSROOM,
    });
    makeSession({ status: 'connected', kind: 'classroom' });
    rerender(
      <CallProvider>
        <Starter />
      </CallProvider>,
    );
    expect(
      screen.getByRole('dialog', { name: 'Clase en llamada: Matemática' }),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Salir de la llamada' }),
    );
    expect(session.leave).toHaveBeenCalledOnce();
  });

  it('surfaces a failed join as a Spanish toast', async () => {
    makeSession({ join: vi.fn().mockRejectedValue(new Error('boom')) });
    render(
      <CallProvider>
        <Starter />
      </CallProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() =>
      expect(toastMock.toast).toHaveBeenCalledWith(
        'Se cortó la llamada. Probá unirte de nuevo.',
        expect.anything(),
      ),
    );
  });

  it('announces the end reason in Spanish', () => {
    const { rerender } = render(
      <CallProvider>
        <Starter />
      </CallProvider>,
    );
    makeSession({ status: 'ended', endReason: 'moderator_ended' });
    act(() => {
      rerender(
        <CallProvider>
          <Starter />
        </CallProvider>,
      );
    });
    expect(toastMock.toast).toHaveBeenCalledWith(
      'La clase en llamada terminó.',
      expect.anything(),
    );
  });

  it('useCalls is null without a provider', () => {
    render(<Starter />);
    expect(screen.getByRole('button', { name: 'start' })).toBeInTheDocument();
  });
});
