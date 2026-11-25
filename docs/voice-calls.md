# Avatar Voice Calls (#141)

Voice-only calls for a classroom (a class call run by a moderator) and between two members of the same classroom (a direct 1:1 call). Nobody shares video: each participant appears as their own 3D avatar. The server never carries or records audio. The server side (rooms, signaling, moderation, limits, close codes) is described in the backend `docs/voice-calls.md`; this page covers the client in `src/features/calls/`.

Status: implemented and covered by unit and component tests with fake WebRTC and fake realtime peers. Real-browser, multi-device behavior is verified by hand; screenshots are added separately.

## What users see

- **Adaptive grid.** The call opens as a full-screen overlay. Each participant gets a rounded-square tile; the grid resizes with the number of participants (1 to 12) so tiles stay as large as the viewport allows, down to 360px wide.
- **Avatar tiles.** Each tile shows the participant's customized avatar with idle breathing and blinking. Display names are rendered as plain text.
- **Speaking indicator.** While someone speaks, their tile gets a glowing border and the avatar's head nods gently, driven by the voice volume. There is no lip-sync.
- **Emotes.** A bar offers `wave`, `happy`, `sad`, `angry`, `think` and `celebrate`. The emote plays on the sender's avatar for every participant for a few seconds, then returns to idle. The female body lacks some body clips, so it reuses the male clips (same skeleton) plus face morphs.
- **Controls bar.** Mute or unmute, emotes, and leave. A participant force-muted by a moderator cannot unmute while self-unmute is disallowed.
- **Teacher panel** (moderators only: owner, admin, teacher). Mute all, mute or unmute one participant, allow or deny self-unmute, end the call for everyone, and toggle focus mode.
- **Focus mode.** While it is on during a class call, students cannot move in the 3D world and the world is hidden for them. Moderators are never affected.
- **1:1 ring.** The callee sees an incoming-call prompt (accept or decline) on any page of the app that has their classroom connection; the caller sees a ringing state until the peer answers, declines, or the ring times out.

## Entry points

- **Classroom banner and button:** while a class call is running, the classroom shows a banner with a join button; moderators get the button to start the call.
- **Chat dock and chat page header:** the same class call button appears in the chat dock window and in the header of the chats page.
- **Member directory:** each member row in the classroom directory has a "Llamar" action that starts a direct call (not offered for yourself or in the staff roster).
- **Incoming prompt:** shown when another member rings you; it is fed by the classroom realtime connection.

## Architecture

- **Audio is peer-to-peer.** `peer-manager.ts` opens one `RTCPeerConnection` to every other participant (a full mesh) using perfect negotiation, and sends Opus audio only. No media passes through our servers.
- **STUN only.** `call-config.ts` lists one public STUN server. There is no TURN relay.
- **Signaling through the realtime `call` room.** `call-room-client.ts` joins the Colyseus `call` room; SDP offers, answers and ICE candidates are relayed by the server to one participant of the same room. Shared state (participants, self mute, speaking, emote, forced mute, `allowSelfUnmute`, `focusMode`) comes from the room state and is the source of truth.
- **One session object.** `call-session.ts` ties the mic, the peer mesh and the room client together; `CallProvider` (mounted in the app shell) owns the active session and exposes it to the UI through `use-call-session.ts`.
- **Mic capture and volume.** `mic-capture.ts` requests the microphone only when the user joins; `voice-activity.ts` measures volume from a Web Audio analyser to set the speaking flag and drive the head nod.
- **Rendering.** `call-stage-canvas.tsx` uses a single WebGL canvas with one viewport per tile instead of one canvas per participant, so the number of WebGL contexts stays at one regardless of the grid size. Tile layout is computed in `call-stage-layout.ts`; rig, blink, breathing, nod and emote playback live in `call-avatar-rig.ts`, `blink-scheduler.ts`, `speaking-nod.ts` and `use-emote-playback.ts`.
- **Receiver-side mute enforcement.** The sender disables its audio track when muted, and receivers also refuse to play audio from any peer the server state marks as muted (`remote-audio-sink.ts`), so a modified client cannot talk over a forced mute.
- **Autoplay unlock.** The Permissions-Policy sets `autoplay=()`, so remote audio playback is primed inside the user's join or answer click. If the browser still rejects `play()`, an "enable audio" fallback is shown.
- **Focus mode on the client.** `focus-mode.tsx` hides the world for students while the classroom state reports a class call with focus mode on. The server also ignores student movement, so hiding the world is a convenience and not the enforcement.
- **Dropped connections are not resumed.** The server removes a dropped participant immediately, so the client rejoins a class call once (`MAX_REJOIN_ATTEMPTS`) instead of renegotiating a held seat.

## Limits

- **12 participants per class call** by default; the cap is configured server-side (`CALL_MAX_PARTICIPANTS`, 2 to 24) and the client does not hardcode it. Direct calls hold 2.
- **Mesh CPU and bandwidth.** Every participant encodes and decodes up to 11 streams and renders up to 12 avatars. Weak devices and slow networks degrade first.
- **No TURN.** Peers behind symmetric NAT or strict corporate firewalls may fail to connect. This is a known limitation the UI cannot fix.
- **No recording and no lip-sync.** Nothing is stored; speaking is shown by glow and head motion only.
- **Single realtime process.** Calls and the classroom connection must be served by the same realtime process (backend assumption).
- Microphone access needs the `microphone=(self)` Permissions-Policy and a secure context; `camera` stays disabled. See [Security](./security.md).

## Known follow-ups

- Add a TURN server for restrictive networks.
- Move to an SFU if classes larger than the mesh limit need to be on a call.
- Make the ICE server list configurable through a public environment variable instead of a constant.
- Run the full `api:sync`. Only the realtime and call contracts were synced; regenerating the REST contracts depends on catching up with the backend avatar catalog changes (#145).
- Add real-browser end-to-end coverage with fake media devices.

## Related

- [Realtime client](./realtime-client.md) and [classroom workspace](./classroom-workspace.md) for the classroom connection that carries the incoming ring.
- [Threat model](./threat-model.md) (`TM-049`) for call-specific threats and the accepted IP-exposure risk.
