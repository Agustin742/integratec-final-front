import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, useOutletContext } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { createAppRoutes } from '@/app/router/routes';
import {
  AVATAR_INPUT_MESSAGE,
  CLOSE_CODE_ACCESS_REVOKED,
  CLOSE_CODE_TOO_MANY_CONNECTIONS,
  CLOSE_REASON_ACCESS_REVOKED,
  CLOSE_REASON_TOO_MANY_CONNECTIONS,
  ClassroomRealtimeProvider,
  NPC_INTERACT_MESSAGE,
  TUTOR_BOT_PHRASES,
  realtimeMessages,
  type AvatarInput,
} from '@/realtime';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import { createFakeRealtimeSdk } from '@/test/realtime/fake-realtime-sdk';
import { render } from '@/test/render';
import { findNpcView } from '@/features/world/npc/npc-view';
import type { Classroom3DStageProps } from './classroom-3d-stage';
import { ClassroomWorkspace } from './classroom-workspace';
import { classroomMessages } from './messages';

const stage = vi.hoisted(() => ({
  props: null as Classroom3DStageProps | null,
  clearLoadedWorldAssets: vi.fn(),
  mountCount: 0,
}));

vi.mock('./classroom-3d-stage', () => ({
  clearLoadedWorldAssets: stage.clearLoadedWorldAssets,
  Classroom3DStage: (props: Classroom3DStageProps) => {
    stage.props = props;
    stage.mountCount += 1;
    return (
      <div
        data-testid="mock-3d-stage"
        data-scope={props.scopeKey}
        data-connection-key={props.connectionKey}
        data-frozen={String(Boolean(props.frozen))}
        data-remote-count={String(props.remoteParticipants?.length ?? 0)}
      >
        {props.topSlot}
        {props.presenceSlot}
      </div>
    );
  },
}));

const CLASSROOM_A = '11111111-1111-4111-8111-111111111111';
const CLASSROOM_B = '22222222-2222-4222-8222-222222222222';
const REMOTE_TEACHER_ID = '00000000-0000-4000-8000-000000000099';
const REMOTE_STUDENT_ID = '00000000-0000-4000-8000-000000000088';

type Detail = components['schemas']['ClassroomContextResponseDto'];

function buildDetail(id: string, overrides: Partial<Detail> = {}): Detail {
  return {
    id,
    name: `Aula ${id.slice(0, 4)}`,
    subject: null,
    schoolId: null,
    independentTeacherId: null,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: 'STUDENT',
    capabilities: ['chat_classmates', 'list_directory'],
    availablePanels: ['activities', 'chat', 'grades'],
    deskCount: 12,
    pet: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function ActivePanelProbe() {
  const ctx = useOutletContext<Detail>();
  return (
    <output data-testid="workspace-controls-probe">
      {JSON.stringify({
        id: ctx.id,
        chatMuted: ctx.chatMuted,
        collaborationLocked: ctx.collaborationLocked,
        gamesDisabled: ctx.gamesDisabled,
      })}
    </output>
  );
}

function setupPresenceWorkspace(
  options: {
    readonly path?: string;
    readonly detailOverrides?: (id: string) => Partial<Detail>;
    readonly members?: readonly components['schemas']['ClassroomMemberDto'][];
    readonly releaseGraceMs?: number;
    readonly holdContextEvents?: boolean;
  } = {},
) {
  const sdk = createFakeRealtimeSdk();
  let currentDetailOverrides = options.detailOverrides;
  let currentDetailResponse: ((id: string) => Response) | null = null;
  let currentMembersResponse: (() => Response) | null = null;
  const detailRequests: string[] = [];
  const contextEventRequests: string[] = [];
  const membersRequests: string[] = [];

  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const request = input as Request;
        const url = new URL(request.url);
        if (url.pathname.endsWith('/context-events')) {
          contextEventRequests.push(url.pathname);
          if (options.holdContextEvents) {
            return new Promise<Response>(() => {});
          }
          return new Response(new ReadableStream(), {
            headers: { 'content-type': 'text/event-stream' },
          });
        }
        if (url.pathname === '/notifications') {
          return Response.json({ items: [], page: 1, pageSize: 20, total: 0 });
        }
        if (url.pathname === '/chats') {
          return Response.json({ items: [] });
        }
        if (url.pathname === '/users/me/daily-review') {
          return Response.json({ status: 'not_due' });
        }
        if (url.pathname.endsWith('/points')) {
          return Response.json({
            classroomId: CLASSROOM_A,
            studentId: profile.id,
            balance: 50,
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          });
        }
        if (url.pathname.endsWith('/members')) {
          membersRequests.push(url.pathname);
          if (currentMembersResponse) {
            return currentMembersResponse();
          }
          const items = options.members ?? [
            {
              id: REMOTE_TEACHER_ID,
              userId: REMOTE_TEACHER_ID,
              displayName: 'Prof. Laura',
              role: 'TEACHER',
              avatar: {
                bodyId: 'female',
                hairId: 'classic-short',
                topId: 'basic-tshirt',
                hairColor: '#6C4D48',
                clothingColor: '#5B4F96',
              },
            },
          ];
          return Response.json({
            items,
            page: 1,
            pageSize: 100,
            total: items.length,
          });
        }
        const match = /^\/classrooms\/([^/]+)$/.exec(url.pathname);
        if (match) {
          const id = match[1];
          detailRequests.push(id);
          if (currentDetailResponse) {
            return currentDetailResponse(id);
          }
          return Response.json(
            buildDetail(id, currentDetailOverrides?.(id) ?? {}),
          );
        }
        return new Response(null, { status: 404 });
      },
    }),
  );
  session.service.controller.getAccessToken = () => 'presence-token';
  session.service.controller.refreshAccessToken = async () => 'presence-token';

  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const router = createMemoryRouter(
    createAppRoutes({
      protectedRoutes: [
        {
          path: 'presence/:classroomId',
          Component: ClassroomWorkspace,
          children: [{ index: true, Component: ActivePanelProbe }],
        },
      ],
    }),
    { initialEntries: [options.path ?? `/presence/${CLASSROOM_A}`] },
  );

  const view = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <ClassroomRealtimeProvider
          realtimeUrl="wss://realtime.example.invalid"
          createSdkClient={sdk.createSdkClient}
          releaseGraceMs={options.releaseGraceMs ?? 0}
        >
          <RouterProvider router={router} />
        </ClassroomRealtimeProvider>
      </SessionProvider>
    </ApiQueryProvider>,
  );

  return {
    ...view,
    sdk,
    session,
    queryClient,
    router,
    detailRequests,
    contextEventRequests,
    membersRequests,
    setDetailOverrides(fn: (id: string) => Partial<Detail>) {
      currentDetailOverrides = fn;
    },
    setDetailResponse(fn: ((id: string) => Response) | null) {
      currentDetailResponse = fn;
    },
    setMembersResponse(fn: (() => Response) | null) {
      currentMembersResponse = fn;
    },
  };
}

async function expandPresence() {
  const pill = await screen.findByRole('button', { name: /ver todos/ });
  if (pill.getAttribute('aria-expanded') !== 'true') fireEvent.click(pill);
}

beforeEach(() => {
  stage.props = null;
  stage.mountCount = 0;
  stage.clearLoadedWorldAssets.mockClear();
});

describe('Classroom real-time presence & remote avatars (#37)', () => {
  test('connects two members, resolves remote avatars from directory & room appearance, and sends movement intents', async () => {
    const { container, sdk } = setupPresenceWorkspace();
    await expandPresence();

    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const room = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      room.setAvatar({
        userId: profile.id,
        displayName: profile.displayName,
        role: 'STUDENT',
        x: -2,
        z: 5,
        rotation: Math.PI,
      });
      room.setAvatar({
        userId: REMOTE_TEACHER_ID,
        displayName: 'Prof. Laura',
        role: 'TEACHER',
        x: 0,
        z: -3.5,
        rotation: 0,
      });
      room.setAvatar({
        userId: REMOTE_STUDENT_ID,
        displayName: 'Mateo',
        role: 'STUDENT',
        x: 3,
        z: 1,
        rotation: 0.5,
        appearance: {
          bodyId: 'male',
          hairId: 'dreads',
          topId: 'hoodie',
          hairColor: '#353849',
          clothingColor: '#75B7DA',
        },
      });
    });

    const bar = await screen.findByTestId('classroom-presence-bar');
    expect(bar).toHaveTextContent(classroomMessages.presence.liveBadge);
    expect(bar).toHaveTextContent(`${profile.displayName}`);
    expect(bar).toHaveTextContent(classroomMessages.presence.youSuffix);
    expect(bar).toHaveTextContent('Prof. Laura');
    expect(bar).toHaveTextContent('Mateo');

    await waitFor(() => {
      expect(stage.props?.remoteParticipants).toHaveLength(2);
      const teacherRemote = stage.props?.remoteParticipants?.find(
        (p) => p.userId === REMOTE_TEACHER_ID,
      );
      expect(teacherRemote?.avatar).toEqual({
        bodyId: 'female',
        hairId: 'classic-short',
        topId: 'basic-tshirt',
        hairColor: '#6C4D48',
        clothingColor: '#5B4F96',
      });
    });

    const studentRemote = stage.props?.remoteParticipants?.find(
      (p) => p.userId === REMOTE_STUDENT_ID,
    );
    expect(studentRemote?.avatar).toEqual({
      bodyId: 'male',
      hairId: 'dreads',
      topId: 'hoodie',
      hairColor: '#353849',
      clothingColor: '#75B7DA',
    });
    expect(stage.props?.selfPose).toEqual({ x: -2, z: 5, rotation: Math.PI });

    const intent: AvatarInput = { x: 1, z: 0 };
    act(() => {
      stage.props?.onIntentChange?.(intent);
    });
    expect(room.send).toHaveBeenCalledWith(AVATAR_INPUT_MESSAGE, intent);

    await expectAccessible(container);
  });

  test('forwards synced NPCs, their phrase text and npc:interact to the stage (#138)', async () => {
    const { sdk } = setupPresenceWorkspace();
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const room = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      room.setNpc('tutorBot', {
        x: -5.9,
        z: 1.05,
        state: 'reacting',
        reaction: 'phrase',
        phraseId: 1,
        reactionSeq: 1,
      });
    });

    await waitFor(() => {
      const bot = stage.props?.npcs
        ? findNpcView(stage.props.npcs, 'tutorBot')
        : undefined;
      expect(bot).toMatchObject({ x: -5.9, z: 1.05, phraseId: 1 });
      expect(stage.props?.resolveNpcPhrase?.(bot!)).toBe(TUTOR_BOT_PHRASES[1]);
    });

    act(() => {
      stage.props?.onInteractNpc?.('tutorBot');
    });
    expect(room.send).toHaveBeenCalledWith(NPC_INTERACT_MESSAGE, {
      npcId: 'tutorBot',
    });
  });

  test('forwards equipped accessory codes of the local and remote members to the stage', async () => {
    const { sdk } = setupPresenceWorkspace();
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const room = sdk.roomFor(CLASSROOM_A)!;
    const baseAvatar = {
      bodyId: 'male',
      hairId: 'dreads',
      topId: 'hoodie',
      hairColor: '#353849',
      clothingColor: '#75B7DA',
    };
    const item = (slot: string, shopItemCode: string) => ({
      slot,
      shopItemId: `id-${slot}`,
      shopItemCode,
      shopItemName: shopItemCode,
      kind: 'AVATAR_ACCESSORY',
    });
    const emptyItems = {
      head: null,
      face: null,
      back: null,
      desk_decor: null,
      hand: null,
      neck: null,
      ears: null,
    };

    act(() => {
      room.setAvatar({
        userId: profile.id,
        displayName: profile.displayName,
        role: 'STUDENT',
        appearance: {
          baseAvatar,
          items: { ...emptyItems, face: item('face', 'face_sunglasses') },
        },
      });
      room.setAvatar({
        userId: REMOTE_STUDENT_ID,
        displayName: 'Mateo',
        role: 'STUDENT',
        appearance: {
          baseAvatar,
          items: {
            ...emptyItems,
            head: item('head', 'head_crown'),
            back: item('back', 'back_wings'),
            hand: item('hand', 'hand_mate'),
          },
        },
      });
    });

    await waitFor(() => {
      expect(stage.props?.selfEquipped).toEqual({
        head: null,
        face: 'face_sunglasses',
        back: null,
        hand: null,
        neck: null,
        ears: null,
      });
      expect(
        stage.props?.remoteParticipants?.find(
          (p) => p.userId === REMOTE_STUDENT_ID,
        )?.equipped,
      ).toEqual({
        head: 'head_crown',
        face: null,
        back: 'back_wings',
        hand: 'hand_mate',
        neck: null,
        ears: null,
      });
    });
  });

  test('handles duplicate updates without ghost avatars and removes departed participants immediately', async () => {
    const { sdk } = setupPresenceWorkspace();
    await expandPresence();
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const room = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      room.setAvatar({
        userId: profile.id,
        displayName: profile.displayName,
        role: 'STUDENT',
        x: 0,
        z: 5,
      });
      room.setAvatar({
        userId: REMOTE_STUDENT_ID,
        displayName: 'Mateo',
        role: 'STUDENT',
        x: 1,
        z: 2,
      });
      room.setAvatar({
        userId: REMOTE_STUDENT_ID,
        displayName: 'Mateo',
        role: 'STUDENT',
        x: 1.5,
        z: 2.2,
      });
    });

    await waitFor(() => {
      expect(stage.props?.remoteParticipants).toHaveLength(1);
    });
    expect(stage.props?.remoteParticipants?.[0]).toMatchObject({
      userId: REMOTE_STUDENT_ID,
      x: 1.5,
      z: 2.2,
    });

    act(() => {
      room.removeAvatar(REMOTE_STUDENT_ID);
    });

    await waitFor(() => {
      expect(stage.props?.remoteParticipants).toHaveLength(0);
    });
    expect(screen.getByTestId('classroom-presence-bar')).not.toHaveTextContent(
      'Mateo',
    );
  });

  test('shows uncertain presence on connection drop, reconciles persisted controls and freeze on reconnect', async () => {
    const { sdk, setDetailOverrides } = setupPresenceWorkspace();
    await expandPresence();
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const firstRoom = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      firstRoom.setAvatar({
        userId: profile.id,
        displayName: profile.displayName,
        role: 'STUDENT',
        x: -2,
        z: 5,
      });
      firstRoom.setAvatar({
        userId: REMOTE_TEACHER_ID,
        displayName: 'Prof. Laura',
        role: 'TEACHER',
        x: 0,
        z: -4,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
        classroomMessages.presence.liveBadge,
      );
    });

    // Server persisted controls changed while offline.
    setDetailOverrides(() => ({
      chatMuted: true,
      collaborationLocked: true,
      gamesDisabled: true,
    }));

    act(() => {
      firstRoom.emitDrop(1006, 'network lost');
    });

    // Reconnection resolves asynchronously; check uncertainty and freeze reconciliation.
    await waitFor(() => {
      const reconnectedRoom = sdk.roomFor(CLASSROOM_A);
      expect(reconnectedRoom).toBeDefined();
      expect(reconnectedRoom).not.toBe(firstRoom);
    });
    const reconnectedRoom = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      reconnectedRoom.setControls({
        chatMuted: true,
        collaborationLocked: true,
        gamesDisabled: true,
        frozen: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
        classroomMessages.presence.controls.frozen,
      );
    });
    expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
      classroomMessages.presence.controls.chatMuted,
    );
    expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
      classroomMessages.presence.controls.collaborationLocked,
    );
    expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
      classroomMessages.presence.controls.gamesDisabled,
    );
    expect(stage.props?.frozen).toBe(true);
    expect(stage.props?.remoteParticipants).toHaveLength(1);
    expect(screen.getByTestId('workspace-controls-probe')).toHaveTextContent(
      '"chatMuted":true',
    );

    // Intents must not be sent while frozen.
    reconnectedRoom.send.mockClear();
    act(() => {
      stage.props?.onIntentChange?.({ x: 1, z: 0 });
    });
    expect(reconnectedRoom.send).not.toHaveBeenCalled();
  });

  test('displays uncertain state while reconnection is pending', async () => {
    const sdk = createFakeRealtimeSdk();
    let releaseReconnect!: () => void;
    const reconnectGate = new Promise<void>((resolve) => {
      releaseReconnect = resolve;
    });
    const wrappedSdkFactory: typeof sdk.createSdkClient = () => {
      const inner = sdk.createSdkClient();
      return {
        ...inner,
        reconnect: async (token) => {
          await reconnectGate;
          return inner.reconnect(token);
        },
      };
    };

    const session = fakeSession(
      { status: 'authenticated', user: profile },
      createApiClient({
        baseUrl: 'https://api.example.invalid',
        fetch: async (input) => {
          const url = new URL((input as Request).url);
          if (url.pathname.endsWith('/context-events')) {
            return new Response(new ReadableStream(), {
              headers: { 'content-type': 'text/event-stream' },
            });
          }
          if (url.pathname === '/notifications') {
            return Response.json({
              items: [],
              page: 1,
              pageSize: 20,
              total: 0,
            });
          }
          if (url.pathname === '/chats') {
            return Response.json({ items: [] });
          }
          if (url.pathname === '/users/me/daily-review') {
            return Response.json({ status: 'not_due' });
          }
          if (url.pathname.endsWith('/points')) {
            return Response.json({
              classroomId: CLASSROOM_A,
              studentId: profile.id,
              balance: 0,
              items: [],
              page: 1,
              pageSize: 20,
              total: 0,
            });
          }
          return Response.json(buildDetail(CLASSROOM_A));
        },
      }),
    );
    session.service.controller.getAccessToken = () => 'tok';
    session.service.controller.refreshAccessToken = async () => 'tok';

    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/classrooms/${CLASSROOM_A}`],
    });

    render(
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>
          <ClassroomRealtimeProvider
            realtimeUrl="wss://realtime.example.invalid"
            createSdkClient={wrappedSdkFactory}
            releaseGraceMs={0}
          >
            <RouterProvider router={router} />
          </ClassroomRealtimeProvider>
        </SessionProvider>
      </ApiQueryProvider>,
    );

    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const firstRoom = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      firstRoom.setAvatar({
        userId: profile.id,
        displayName: profile.displayName,
        role: 'STUDENT',
        x: 0,
        z: 5,
      });
    });

    act(() => {
      firstRoom.emitDrop(1006, 'drop');
    });

    await expandPresence();
    const bar = await screen.findByTestId('classroom-presence-bar');
    expect(bar).toHaveTextContent(classroomMessages.presence.reconnectingBadge);
    expect(bar).toHaveTextContent(classroomMessages.presence.uncertainBadge);
    expect(bar).toHaveTextContent(realtimeMessages.reconnecting);
    expect(stage.props?.connectionKey).toBe(
      `${firstRoom.roomId}:${firstRoom.sessionId}`,
    );

    releaseReconnect();
    await waitFor(() => {
      expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
        classroomMessages.presence.liveBadge,
      );
    });
  });

  test('exits immediately on live access revocation (4001 access_revoked), stops SSE/refetches/reconnects, and focuses lost-access heading', async () => {
    const { sdk, detailRequests, contextEventRequests } =
      setupPresenceWorkspace();
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const room = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      room.setAvatar({
        userId: profile.id,
        displayName: profile.displayName,
        role: 'STUDENT',
      });
    });
    await screen.findByTestId('mock-3d-stage');

    const detailCountBefore = detailRequests.length;
    const sseCountBefore = contextEventRequests.length;

    act(() => {
      room.emitLeave(CLOSE_CODE_ACCESS_REVOKED, CLOSE_REASON_ACCESS_REVOKED);
    });

    const alert = await screen.findByTestId('classroom-lost-access');
    expect(alert).toHaveTextContent(classroomMessages.presence.lostAccessTitle);
    expect(alert).toHaveTextContent(realtimeMessages.lostAccess);
    expect(screen.queryByTestId('mock-3d-stage')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('classroom-presence-bar'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('workspace-controls-probe'),
    ).not.toBeInTheDocument();
    expect(stage.clearLoadedWorldAssets).toHaveBeenCalledWith({
      scopeKey: CLASSROOM_A,
    });
    expect(
      screen.getByRole('link', { name: classroomMessages.backToList }),
    ).toHaveAttribute('href', '/');

    const lostAccessHeading = screen.getByRole('heading', {
      level: 2,
      name: classroomMessages.presence.lostAccessTitle,
    });
    expect(lostAccessHeading).toHaveAttribute('tabindex', '-1');
    await waitFor(() => {
      expect(document.activeElement).toBe(lostAccessHeading);
    });

    // Flush timers/microtasks to confirm zero post-4001 GET /classrooms/:id refetches,
    // zero SSE reconnects, and zero extra Colyseus room joins.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(sdk.joinedClassrooms).toHaveLength(1);
    expect(detailRequests.length).toBe(detailCountBefore);
    expect(contextEventRequests.length).toBe(sseCountBefore);
  });

  test('shows rejected alert with retry on 4002 too_many_connections', async () => {
    const { sdk } = setupPresenceWorkspace();
    sdk.failNextJoinWith(
      Object.assign(new Error(CLOSE_REASON_TOO_MANY_CONNECTIONS), {
        code: CLOSE_CODE_TOO_MANY_CONNECTIONS,
      }),
    );

    const rejected = await screen.findByTestId('classroom-realtime-rejected');
    expect(rejected).toHaveTextContent(
      classroomMessages.presence.rejectedTitle,
    );
    expect(rejected).toHaveTextContent(realtimeMessages.tooManyConnections);
    expect(stage.props?.remoteParticipants).toEqual([]);

    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.presence.retryAction,
      }),
    );
    await expandPresence();
    await waitFor(() => {
      expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
        classroomMessages.presence.liveBadge,
      );
    });
  });

  test('discards old room state and remote avatars on classroom and account switches', async () => {
    const { sdk, router, session } = setupPresenceWorkspace();
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const roomA = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      roomA.setAvatar({
        userId: REMOTE_STUDENT_ID,
        displayName: 'Estudiante A',
        role: 'STUDENT',
        x: 2,
        z: 2,
      });
    });
    await waitFor(() => {
      expect(stage.props?.remoteParticipants).toHaveLength(1);
    });

    await act(() => router.navigate(`/presence/${CLASSROOM_B}`));
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_B)).toBeDefined();
    });
    expect(roomA.leave).toHaveBeenCalledTimes(1);
    expect(stage.props?.remoteParticipants).toEqual([]);

    const roomB = sdk.roomFor(CLASSROOM_B)!;
    act(() => {
      roomB.setAvatar({
        userId: REMOTE_TEACHER_ID,
        displayName: 'Docente B',
        role: 'TEACHER',
        x: -1,
        z: -4,
      });
    });
    await waitFor(() => {
      expect(stage.props?.remoteParticipants).toHaveLength(1);
      expect(stage.props?.remoteParticipants?.[0].displayName).toBe(
        'Docente B',
      );
    });

    // Account switch drops user 1's room and starts fresh for user 2.
    act(() => {
      session.set({
        status: 'authenticated',
        user: { ...profile, id: 'user-2', displayName: 'Otro Usuario' },
      });
    });

    await waitFor(() => {
      expect(roomB.leave).toHaveBeenCalledTimes(1);
      expect(sdk.rooms.length).toBeGreaterThanOrEqual(3);
    });
    expect(stage.props?.remoteParticipants).toEqual([]);
  });

  test('never opens a realtime room for PARENT accounts', async () => {
    const { sdk } = setupPresenceWorkspace({
      detailOverrides: () => ({
        myRole: 'PARENT',
        capabilities: ['message_teacher'],
        availablePanels: ['grades', 'notices'],
      }),
    });

    await screen.findByText(/Familiar/);
    await act(async () => {
      await Promise.resolve();
    });
    expect(sdk.joinedClassrooms).toEqual([]);
    expect(
      screen.queryByTestId('classroom-presence-bar'),
    ).not.toBeInTheDocument();
  });

  test('reconciles REST classroom detail when initial realtime join is rejected as forbidden (403/4001)', async () => {
    const { sdk, detailRequests, setDetailResponse } = setupPresenceWorkspace({
      holdContextEvents: true,
    });
    // Initial GET /classrooms/:id was already dispatched during mount (returns 200);
    // subsequent reconciliation read returns 403 once realtime join is rejected as forbidden.
    setDetailResponse(() => new Response(null, { status: 403 }));
    sdk.failNextJoinWith(
      Object.assign(new Error(CLOSE_REASON_ACCESS_REVOKED), {
        code: CLOSE_CODE_ACCESS_REVOKED,
      }),
    );

    await waitFor(() => {
      expect(detailRequests).toHaveLength(2);
      expect(screen.queryByTestId('mock-3d-stage')).not.toBeInTheDocument();
    });
  });

  test('reconciles persisted controls after drop -> failed reconnect -> disconnected -> manual retry', async () => {
    const { sdk, setDetailOverrides } = setupPresenceWorkspace();
    await expandPresence();
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const firstRoom = sdk.roomFor(CLASSROOM_A)!;

    await waitFor(() => {
      expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
        classroomMessages.presence.liveBadge,
      );
    });

    // Next reconnect fails so client transitions to disconnected (with Retry button).
    sdk.failNextReconnectWith(new Error('network unreachable'));
    act(() => {
      firstRoom.emitDrop(1006, 'network down');
    });

    const retryButton = await screen.findByRole('button', {
      name: classroomMessages.presence.retryAction,
    });
    expect(stage.props?.connectionKey).toBeUndefined();

    // Persisted controls change on the server while disconnected.
    setDetailOverrides(() => ({
      chatMuted: true,
      collaborationLocked: true,
      gamesDisabled: true,
    }));

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
        classroomMessages.presence.liveBadge,
      );
      expect(screen.getByTestId('workspace-controls-probe')).toHaveTextContent(
        '"chatMuted":true',
      );
      expect(screen.getByTestId('workspace-controls-probe')).toHaveTextContent(
        '"collaborationLocked":true',
      );
      expect(screen.getByTestId('workspace-controls-probe')).toHaveTextContent(
        '"gamesDisabled":true',
      );
    });
  });

  test('keeps frozen latched across reconnecting and sends stop intent on unmount while lease lingers', async () => {
    const sdk = createFakeRealtimeSdk();
    let releaseReconnect!: () => void;
    const reconnectGate = new Promise<void>((resolve) => {
      releaseReconnect = resolve;
    });
    const wrappedSdkFactory: typeof sdk.createSdkClient = () => {
      const inner = sdk.createSdkClient();
      return {
        ...inner,
        reconnect: async (token) => {
          await reconnectGate;
          return inner.reconnect(token);
        },
      };
    };

    const session = fakeSession(
      { status: 'authenticated', user: profile },
      createApiClient({
        baseUrl: 'https://api.example.invalid',
        fetch: async (input) => {
          const url = new URL((input as Request).url);
          if (url.pathname.endsWith('/context-events')) {
            return new Response(new ReadableStream(), {
              headers: { 'content-type': 'text/event-stream' },
            });
          }
          if (url.pathname === '/notifications') {
            return Response.json({
              items: [],
              page: 1,
              pageSize: 20,
              total: 0,
            });
          }
          if (url.pathname === '/chats') {
            return Response.json({ items: [] });
          }
          if (url.pathname === '/users/me/daily-review') {
            return Response.json({ status: 'not_due' });
          }
          if (url.pathname.endsWith('/points')) {
            return Response.json({
              classroomId: CLASSROOM_A,
              studentId: profile.id,
              balance: 0,
              items: [],
              page: 1,
              pageSize: 20,
              total: 0,
            });
          }
          return Response.json(buildDetail(CLASSROOM_A));
        },
      }),
    );
    session.service.controller.getAccessToken = () => 'tok';
    session.service.controller.refreshAccessToken = async () => 'tok';

    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/classrooms/${CLASSROOM_A}`],
    });

    const view = render(
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>
          <ClassroomRealtimeProvider
            realtimeUrl="wss://realtime.example.invalid"
            createSdkClient={wrappedSdkFactory}
            releaseGraceMs={500}
          >
            <RouterProvider router={router} />
          </ClassroomRealtimeProvider>
        </SessionProvider>
      </ApiQueryProvider>,
    );

    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const firstRoom = sdk.roomFor(CLASSROOM_A)!;

    act(() => {
      firstRoom.setControls({ frozen: true });
    });
    await waitFor(() => {
      expect(stage.props?.frozen).toBe(true);
    });

    // Drop while frozen: frozen lock must remain latched while reconnecting.
    act(() => {
      firstRoom.emitDrop(1006, 'drop while frozen');
    });
    await expandPresence();
    await waitFor(() => {
      expect(screen.getByTestId('classroom-presence-bar')).toHaveTextContent(
        classroomMessages.presence.reconnectingBadge,
      );
    });
    expect(stage.props?.frozen).toBe(true);

    // Finish reconnect and unfreeze, then start walking and unmount while grace period keeps room alive.
    releaseReconnect();
    await waitFor(() => {
      const next = sdk.roomFor(CLASSROOM_A);
      expect(next).toBeDefined();
      expect(next).not.toBe(firstRoom);
    });
    const reconnectedRoom = sdk.roomFor(CLASSROOM_A)!;
    act(() => {
      reconnectedRoom.setControls({ frozen: false });
    });
    await waitFor(() => {
      expect(stage.props?.frozen).toBe(false);
    });

    act(() => {
      stage.props?.onIntentChange?.({ x: 1, z: 0 });
    });
    expect(reconnectedRoom.send).toHaveBeenCalledWith(AVATAR_INPUT_MESSAGE, {
      x: 1,
      z: 0,
    });

    reconnectedRoom.send.mockClear();
    view.unmount();
    expect(reconnectedRoom.send).toHaveBeenCalledWith(AVATAR_INPUT_MESSAGE, {
      x: 0,
      z: 0,
    });
  });

  test('formats SCHOOL_ADMIN role, scopes aria-live to status container, and refreshes directory avatars after failure and new members', async () => {
    const NEW_STUDENT_ID = '00000000-0000-4000-8000-000000000077';
    const { sdk, membersRequests, setMembersResponse } =
      setupPresenceWorkspace();
    await expandPresence();
    let membersAttempt = 0;
    setMembersResponse(() => {
      membersAttempt += 1;
      if (membersAttempt === 1) {
        return new Response(null, { status: 503 });
      }
      if (membersAttempt === 2) {
        return Response.json({
          items: [
            {
              id: REMOTE_TEACHER_ID,
              userId: REMOTE_TEACHER_ID,
              displayName: 'Directora Ana',
              role: 'SCHOOL_ADMIN',
              avatar: {
                bodyId: 'female',
                hairId: 'classic-short',
                topId: 'basic-tshirt',
                hairColor: '#6C4D48',
                clothingColor: '#5B4F96',
              },
            },
          ],
          page: 1,
          pageSize: 100,
          total: 1,
        });
      }
      return Response.json({
        items: [
          {
            id: REMOTE_TEACHER_ID,
            userId: REMOTE_TEACHER_ID,
            displayName: 'Directora Ana',
            role: 'SCHOOL_ADMIN',
            avatar: {
              bodyId: 'female',
              hairId: 'classic-short',
              topId: 'basic-tshirt',
              hairColor: '#6C4D48',
              clothingColor: '#5B4F96',
            },
          },
          {
            id: NEW_STUDENT_ID,
            userId: NEW_STUDENT_ID,
            displayName: 'Lucas Nuevo',
            role: 'STUDENT',
            avatar: {
              bodyId: 'male',
              hairId: 'dreads',
              topId: 'hoodie',
              hairColor: '#353849',
              clothingColor: '#75B7DA',
            },
          },
        ],
        page: 1,
        pageSize: 100,
        total: 2,
      });
    });

    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)).toBeDefined();
    });
    const room = sdk.roomFor(CLASSROOM_A)!;

    // First join of SCHOOL_ADMIN triggers directory lookup #1 (503 transient failure).
    act(() => {
      room.setAvatar({
        userId: REMOTE_TEACHER_ID,
        displayName: 'Directora Ana',
        role: 'SCHOOL_ADMIN',
        x: 0,
        z: -3,
      });
    });

    const bar = await screen.findByTestId('classroom-presence-bar');
    expect(bar).toHaveTextContent('Directora Ana');
    expect(bar).toHaveTextContent(classroomMessages.roles.SCHOOL_ADMIN);
    expect(bar).not.toHaveAttribute('aria-live');
    const liveRegion = bar.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.querySelector('ul')).toBeNull();

    await waitFor(() => {
      expect(membersRequests.length).toBe(1);
    });

    // Adding a second missing participant retries after the 503 failure (lookup #2).
    act(() => {
      room.setAvatar({
        userId: REMOTE_STUDENT_ID,
        displayName: 'Mateo',
        role: 'STUDENT',
        x: 2,
        z: 1,
      });
    });
    await waitFor(() => {
      expect(membersRequests.length).toBe(2);
      const adminRemote = stage.props?.remoteParticipants?.find(
        (p) => p.userId === REMOTE_TEACHER_ID,
      );
      expect(adminRemote?.avatar?.bodyId).toBe('female');
    });

    // Newly enrolled student arrives within the 60s window; staleTime: 0 fetches fresh directory (#3).
    act(() => {
      room.setAvatar({
        userId: NEW_STUDENT_ID,
        displayName: 'Lucas Nuevo',
        role: 'STUDENT',
        x: 3,
        z: 2,
      });
    });
    await waitFor(() => {
      expect(membersRequests.length).toBe(3);
      const newRemote = stage.props?.remoteParticipants?.find(
        (p) => p.userId === NEW_STUDENT_ID,
      );
      expect(newRemote?.avatar).toEqual({
        bodyId: 'male',
        hairId: 'dreads',
        topId: 'hoodie',
        hairColor: '#353849',
        clothingColor: '#75B7DA',
      });
    });
  });
});

describe('Compact presence pill in the 3D stage (#128)', () => {
  function seatMembers(
    room: ReturnType<ReturnType<typeof createFakeRealtimeSdk>['roomFor']> & {},
    names: string[],
  ) {
    act(() => {
      room.setAvatar({
        userId: profile.id,
        displayName: profile.displayName,
        role: 'STUDENT',
        x: 0,
        z: 5,
      });
      names.forEach((name, index) => {
        room.setAvatar({
          userId: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
          displayName: name,
          role: 'STUDENT',
          x: index,
          z: 1,
        });
      });
    });
  }

  test('shows a compact collapsed pill instead of the full bar, with a counted accessible name', async () => {
    const { sdk } = setupPresenceWorkspace();
    await waitFor(() => expect(sdk.roomFor(CLASSROOM_A)).toBeDefined());
    seatMembers(sdk.roomFor(CLASSROOM_A)!, ['Mateo', 'Lucia']);

    const pill = await screen.findByRole('button', {
      name: '3 conectados, ver todos',
    });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(pill).toHaveClass('min-h-11');
    expect(
      screen.queryByTestId('classroom-presence-bar'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('classroom-3d-top-bar')).not.toContainElement(
      pill,
    );
  });

  test('shows at most three avatars and a +N counter for the rest', async () => {
    const { sdk } = setupPresenceWorkspace();
    await waitFor(() => expect(sdk.roomFor(CLASSROOM_A)).toBeDefined());
    seatMembers(sdk.roomFor(CLASSROOM_A)!, ['Ana', 'Beto', 'Caro', 'Dani']);

    const pill = await screen.findByRole('button', {
      name: '5 conectados, ver todos',
    });
    expect(pill.querySelectorAll('[data-presence-avatar]')).toHaveLength(3);
    expect(pill).toHaveTextContent('+2');
  });

  test('expands to the full presence list on click and collapses on Escape returning focus', async () => {
    const { sdk } = setupPresenceWorkspace();
    await waitFor(() => expect(sdk.roomFor(CLASSROOM_A)).toBeDefined());
    seatMembers(sdk.roomFor(CLASSROOM_A)!, ['Mateo']);

    const pill = await screen.findByRole('button', {
      name: '2 conectados, ver todos',
    });
    pill.focus();
    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-expanded', 'true');
    const bar = await screen.findByTestId('classroom-presence-bar');
    expect(bar).toHaveTextContent('Mateo');
    expect(bar).toHaveTextContent(classroomMessages.presence.liveBadge);

    fireEvent.keyDown(bar, { key: 'Escape' });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByTestId('classroom-presence-bar'),
    ).not.toBeInTheDocument();
    expect(pill).toHaveFocus();

    fireEvent.click(pill);
    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-expanded', 'false');
  });
});
