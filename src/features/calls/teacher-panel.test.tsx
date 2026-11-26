import { useSyncExternalStore } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  FakeAudioElement,
  createFakeCallSdk,
  createFakePeerFactory,
} from '@/test/calls/call-fakes';
import { CALL_MODERATE_MESSAGE } from '@/realtime/call-contracts.generated';
import {
  CLOSE_CODE_ACCESS_REVOKED,
  CLOSE_REASON_ACCESS_REVOKED,
} from '@/realtime/contracts.generated';
import { callMessages } from './call-messages';
import { createCallRoomClient } from './call-room-client';
import {
  createCallSession,
  type CallParticipantState,
  type CallSession,
} from './call-session';
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
      person(3, { muted: true, selfMuted: true }),
    ],
    allowSelfUnmute: false,
    focusMode: false,
    onModerate: vi.fn(),
    ...overrides,
  };
  render(<TeacherPanel {...props} />);
  return props;
}

const copy = callMessages.panel;

function renderPanel(overrides: Partial<TeacherPanelProps> = {}) {
  let props: TeacherPanelProps = {
    participants: [person(1), person(2)],
    allowSelfUnmute: true,
    focusMode: false,
    onModerate: vi.fn(),
    ...overrides,
  };
  const view = render(<TeacherPanel {...props} />);
  return {
    props,
    update(next: Partial<TeacherPanelProps>) {
      props = { ...props, ...next };
      view.rerender(<TeacherPanel {...props} />);
    },
  };
}

function expectNoAppliedAnnouncement() {
  const status = screen.getByRole('status');
  for (const message of [
    copy.mutedAllAnnouncement,
    copy.focusOnAnnouncement,
    copy.focusOffAnnouncement,
    copy.allowOnAnnouncement,
    copy.allowOffAnnouncement,
    copy.mutedOneAnnouncement('Alumno 1'),
    copy.unmutedOneAnnouncement('Alumno 1'),
  ]) {
    expect(status).not.toHaveTextContent(message);
  }
}

function SessionPanel({ session }: { readonly session: CallSession }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  if (!snapshot.isModerator) return null;
  return <TeacherPanel {...snapshot} onModerate={session.moderate} />;
}

const sessions: CallSession[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.dispose();
});

async function renderSessionPanel(role = 'TEACHER') {
  const sdk = createFakeCallSdk();
  const peers = createFakePeerFactory();
  const session = createCallSession({
    roomClient: createCallRoomClient({
      auth: {
        getAccessToken: () => 'synthetic-token',
        refreshAccessToken: async () => undefined,
        registerCleanup: () => () => {},
      },
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    }),
    captureMic: async () => {
      throw new DOMException('No device', 'NotFoundError');
    },
    createPeerConnection: peers.create,
    createAudioContext: () => new FakeAudioContext() as unknown as AudioContext,
    createAudioElement: () =>
      new FakeAudioElement() as unknown as HTMLAudioElement,
  });
  sessions.push(session);
  await session.join({
    kind: 'classroom',
    classroomId: '7b1f3c52-8d1e-4f0a-9a57-2c6f5e8d9a10',
  });
  sdk.lastRoom.setParticipant({ sessionId: 'S-self', role });
  sdk.lastRoom.setParticipant(person(1));
  const view = render(<SessionPanel session={session} />);
  return { sdk, session, ...view };
}

describe('TeacherPanel server confirmation', () => {
  it.each([
    { role: 'switch', label: copy.focusMode, forcedMuted: false },
    { role: 'switch', label: copy.allowSelfUnmute, forcedMuted: false },
    { role: 'button', label: copy.muteAll, forcedMuted: false },
    { role: 'button', label: copy.muteOne('Alumno 1'), forcedMuted: false },
    { role: 'button', label: copy.unmuteOne('Alumno 1'), forcedMuted: true },
  ] as const)(
    'describes $label as a request, not an applied result',
    ({ role, label, forcedMuted }) => {
      const panel = renderPanel({
        participants: [person(1, { forcedMuted, muted: forcedMuted })],
      });
      fireEvent.click(screen.getByRole(role, { name: label }));
      expect(panel.props.onModerate).toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(
        copy.moderationRequestedAnnouncement,
      );
      expectNoAppliedAnnouncement();
      panel.update({ participants: [...panel.props.participants] });
      expect(screen.getByRole('status')).toHaveTextContent(
        copy.moderationRequestedAnnouncement,
      );
      expectNoAppliedAnnouncement();
    },
  );

  it.each([
    { key: 'focusMode', initial: false, label: copy.focusMode },
    { key: 'focusMode', initial: true, label: copy.focusMode },
    { key: 'allowSelfUnmute', initial: false, label: copy.allowSelfUnmute },
    { key: 'allowSelfUnmute', initial: true, label: copy.allowSelfUnmute },
  ] as const)(
    'waits for $key to change from $initial before showing it as applied',
    ({ key, initial, label }) => {
      const panel = renderPanel({ [key]: initial });
      const control = () => screen.getByRole('switch', { name: label });
      fireEvent.click(control());
      expect(panel.props.onModerate).toHaveBeenCalledTimes(1);
      expect(control()).toHaveProperty('checked', initial);
      expectNoAppliedAnnouncement();

      // A fresh render with unchanged authoritative state is not confirmation.
      panel.update({ participants: [...panel.props.participants] });
      expectNoAppliedAnnouncement();
      panel.update({ [key]: !initial });
      expect(control()).toHaveProperty('checked', !initial);
      // Applied announcements are optional; the server-confirmed control is not.
    },
  );

  it.each([false, true])(
    'waits for forced mute to change from %s, not merely self mute',
    (forcedMuted) => {
      const panel = renderPanel({
        participants: [person(1, { forcedMuted, muted: forcedMuted })],
      });
      fireEvent.click(
        screen.getByRole('button', {
          name: forcedMuted
            ? copy.unmuteOne('Alumno 1')
            : copy.muteOne('Alumno 1'),
        }),
      );
      expectNoAppliedAnnouncement();
      panel.update({
        participants: [
          person(1, { forcedMuted, selfMuted: true, muted: true }),
        ],
      });
      expectNoAppliedAnnouncement();
      panel.update({
        participants: [
          person(1, {
            forcedMuted: !forcedMuted,
            selfMuted: true,
            muted: true,
          }),
        ],
      });
      expect(
        screen.getByRole('button', {
          name: forcedMuted
            ? copy.muteOne('Alumno 1')
            : copy.unmuteOne('Alumno 1'),
        }),
      ).toBeInTheDocument();
      // Allowing speech does not turn on a student's own microphone.
      if (forcedMuted)
        expect(screen.getByText(copy.selfMutedBadge)).toBeInTheDocument();
    },
  );

  it('does not mistake a different student update or a departed target for confirmation', () => {
    const panel = renderPanel();
    fireEvent.click(
      screen.getByRole('button', { name: copy.muteOne('Alumno 1') }),
    );
    panel.update({
      participants: [person(1), person(2, { forcedMuted: true, muted: true })],
    });
    expectNoAppliedAnnouncement();
    panel.update({
      participants: [person(2, { forcedMuted: true, muted: true })],
    });
    expectNoAppliedAnnouncement();
  });

  it.each(['mutes-first', 'permission-first'] as const)(
    'waits for both mute-all outcomes: %s',
    (order) => {
      const panel = renderPanel();
      fireEvent.click(screen.getByRole('button', { name: copy.muteAll }));
      expect(panel.props.onModerate).toHaveBeenNthCalledWith(1, {
        action: 'mute-all',
      });
      expect(panel.props.onModerate).toHaveBeenNthCalledWith(2, {
        action: 'allow-self-unmute',
        value: false,
      });
      expectNoAppliedAnnouncement();
      const muted = [
        person(1, { forcedMuted: true, muted: true }),
        person(2, { forcedMuted: true, muted: true }),
      ];
      panel.update(
        order === 'mutes-first'
          ? { participants: muted }
          : { allowSelfUnmute: false },
      );
      expectNoAppliedAnnouncement();
      panel.update({ participants: muted, allowSelfUnmute: false });
      expect(
        screen.getByRole('switch', { name: copy.allowSelfUnmute }),
      ).not.toBeChecked();
      expect(screen.getAllByText(copy.forcedMutedBadge)).toHaveLength(2);
    },
  );

  it.each(['empty', 'already-muted'] as const)(
    'does not fabricate mute-all confirmation from an unchanged %s snapshot',
    (kind) => {
      const participants =
        kind === 'empty' ? [] : [person(1, { forcedMuted: true, muted: true })];
      const panel = renderPanel({ participants, allowSelfUnmute: false });
      fireEvent.click(screen.getByRole('button', { name: copy.muteAll }));
      expectNoAppliedAnnouncement();
      panel.update({ participants: [...participants] });
      expectNoAppliedAnnouncement();
    },
  );

  it('does not announce unrelated server changes as a local action', () => {
    const panel = renderPanel();
    panel.update({
      focusMode: true,
      allowSelfUnmute: false,
      participants: [person(1, { forcedMuted: true, muted: true })],
    });
    expectNoAppliedAnnouncement();
  });

  it('does not retain an old applied announcement when another request is unresolved', () => {
    const panel = renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: copy.focusMode }));
    panel.update({ focusMode: true });
    expect(screen.getByRole('switch', { name: copy.focusMode })).toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: copy.focusMode }));
    expectNoAppliedAnnouncement();
    panel.update({ focusMode: false });
    expect(
      screen.getByRole('switch', { name: copy.focusMode }),
    ).not.toBeChecked();
  });

  it.each(['OWNER', 'ADMIN', 'TEACHER'])(
    'keeps %s out of student moderation targets',
    (role) => {
      renderPanel({
        participants: [person(0, { role, displayName: 'Staff' }), person(1)],
      });
      expect(
        screen.queryByRole('button', { name: copy.muteOne('Staff') }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: copy.muteOne('Alumno 1') }),
      ).toBeInTheDocument();
    },
  );

  it('confirms only after the real session receives changed server state, not after void send returns', async () => {
    const { sdk, session } = await renderSessionPanel();
    fireEvent.click(screen.getByRole('switch', { name: copy.focusMode }));
    expect(sdk.lastRoom.send).toHaveBeenCalledWith(CALL_MODERATE_MESSAGE, {
      action: 'focus-mode',
      value: true,
    });
    expect(session.getSnapshot().focusMode).toBe(false);
    expectNoAppliedAnnouncement();
    act(() => sdk.lastRoom.emitState());
    expectNoAppliedAnnouncement();
    act(() => sdk.lastRoom.setFlags({ focusMode: true }));
    expect(screen.getByRole('switch', { name: copy.focusMode })).toBeChecked();
  });

  it('does not announce a silently ignored command or retry as applied', async () => {
    const { sdk } = await renderSessionPanel();
    const control = screen.getByRole('switch', { name: copy.focusMode });
    fireEvent.click(control);
    act(() => sdk.lastRoom.emitState());
    expectNoAppliedAnnouncement();
    fireEvent.click(control);
    const commands = sdk.lastRoom.send.mock.calls.filter(
      ([type]) => type === CALL_MODERATE_MESSAGE,
    );
    // A pending guard may suppress the repeat; if sent, it must preserve intent.
    expect(commands.length).toBeGreaterThanOrEqual(1);
    for (const [, payload] of commands)
      expect(payload).toEqual({ action: 'focus-mode', value: true });
    expectNoAppliedAnnouncement();
  });

  it('does not report success when the server closes the call for lost access', async () => {
    const { sdk, session, container } = await renderSessionPanel();
    fireEvent.click(screen.getByRole('button', { name: copy.muteAll }));
    expectNoAppliedAnnouncement();
    act(() =>
      sdk.lastRoom.emitLeave(
        CLOSE_CODE_ACCESS_REVOKED,
        CLOSE_REASON_ACCESS_REVOKED,
      ),
    );
    expect(session.getSnapshot().status).toBe('ended');
    expect(container).not.toHaveTextContent(copy.mutedAllAnnouncement);
  });

  it('preserves student moderation and self-unmute restrictions', async () => {
    const { sdk, session } = await renderSessionPanel('STUDENT');
    act(() => {
      sdk.lastRoom.setParticipant({
        sessionId: 'S-self',
        role: 'STUDENT',
        forcedMuted: true,
      });
      sdk.lastRoom.setFlags({ allowSelfUnmute: false });
    });
    expect(
      screen.queryByRole('heading', { name: copy.title }),
    ).not.toBeInTheDocument();
    sdk.lastRoom.send.mockClear();
    session.moderate({ action: 'mute-all' });
    expect(sdk.lastRoom.send).not.toHaveBeenCalled();
    expect(session.setMuted(false)).toBe('refused');
    expect(session.getSnapshot().self.canUnmute).toBe(false);
  });
});

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
      screen.getByRole('button', { name: 'Permitir hablar a Alumno 2' }),
    );
    expect(props.onModerate).toHaveBeenCalledWith({
      action: 'unmute',
      targetUserId: '00000000-0000-4000-8000-000000000002',
    });
  });

  it('keys the action on the forced mute, not on the student own mute', () => {
    const props = setup();
    expect(
      screen.queryByRole('button', { name: 'Permitir hablar a Alumno 3' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Silenciar a Alumno 3' }),
    );
    expect(props.onModerate).toHaveBeenCalledWith({
      action: 'mute',
      targetUserId: '00000000-0000-4000-8000-000000000003',
    });
    expect(screen.getByText('Se silenció solo')).toBeInTheDocument();
    expect(screen.getByText('Silenciado por vos')).toBeInTheDocument();
  });

  it('groups the controls in Clase and Participantes sections', () => {
    setup();
    const clase = screen.getByRole('region', { name: 'Clase' });
    expect(
      within(clase).getByRole('button', { name: 'Silenciar a todos' }),
    ).toBeInTheDocument();
    expect(within(clase).getAllByRole('switch')).toHaveLength(2);
    const participantes = screen.getByRole('region', { name: 'Participantes' });
    expect(within(participantes).getAllByRole('listitem')).toHaveLength(3);
    expect(within(participantes).queryByRole('switch')).toBeNull();
  });

  it('shows an initial and the mic state of each participant', () => {
    setup();
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('A1')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Micrófono activo')).toBeInTheDocument();
    expect(
      within(rows[1]!).getByText('Silenciado por vos'),
    ).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Se silenció solo')).toBeInTheDocument();
    expect(within(rows[0]!).getAllByRole('button')).toHaveLength(1);
  });

  it('mute all also forbids self-unmute', () => {
    const props = setup({ allowSelfUnmute: true });
    fireEvent.click(screen.getByRole('button', { name: 'Silenciar a todos' }));
    expect(props.onModerate).toHaveBeenNthCalledWith(1, { action: 'mute-all' });
    expect(props.onModerate).toHaveBeenNthCalledWith(2, {
      action: 'allow-self-unmute',
      value: false,
    });
    expect(screen.getByRole('status')).not.toHaveTextContent(
      callMessages.panel.mutedAllAnnouncement,
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
