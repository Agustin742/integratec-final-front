# Avatar Voice Calls (#141)

Voice-only calls for a classroom (a class call run by a moderator) and between two members of the same classroom (a direct 1:1 call). Nobody shares video: each participant appears as their own 3D avatar. The server never carries or records audio. The server side (rooms, signaling, moderation, limits, close codes) is described in the backend `docs/voice-calls.md`; this page covers the client in `src/features/calls/`.

Status: implemented and covered by unit and component tests with fake WebRTC and fake realtime peers. The reproducible visual fixture passed both browser projects; its three PNGs were generated and visually inspected. Live multi-device behavior still requires separate verification.

## What users see

- **Adaptive grid.** The call opens as a full-screen overlay. Each participant gets a rounded-square tile; the grid resizes with the number of participants (1 to 12) so tiles stay as large as the viewport allows, down to 360px wide.
- **Avatar tiles.** Each tile shows the participant's customized avatar with idle breathing and blinking. Display names are rendered as plain text.
- **Speaking indicator.** While someone speaks, their tile gets a glowing border and the avatar's head nods gently, driven by the voice volume. There is no lip-sync.
- **Emotes.** The reaction menu offers all **13** expressive avatar gestures (`wave`, `happy`, `sad`, `angry`, `think`, `celebrate`, `raise-hand`, `clap`, `nod`, `shake-head`, `dance`, `explain`, and `point`) from the canonical `male/body.glb` and `female/body.glb` animation suite ([avatar animations](./art/avatar-animations.md)), rendered with SVG icons and bounded scrolling for small viewports. The emote plays on the sender's avatar for every participant for its configured duration, then returns to idle; `fallbackClipsUrl` fallback to the male clips remains for compatibility. Requires backend `CALL_EMOTES` (`integratec-final-back` PR #157) in live rooms so Colyseus validates all 13 emotes.
- **Controls bar.** Mute or unmute, emotes, and leave. A participant force-muted by a moderator cannot unmute while self-unmute is disallowed.
- **Teacher panel** (moderators only: owner, admin, teacher). Mute all, mute or unmute one participant, allow or deny self-unmute, end the call for everyone, and toggle focus mode. Action feedback announces a request only; switches and participant state change only with authoritative server snapshots. The current signaling contract has no per-command acknowledgment, so unchanged state cannot distinguish a delayed request from a silent rejection.
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
- **Classroom capability reuse.** The classroom workspace passes its confirmed `moderate_chat` capability to the call entry in both 2D and 3D. The entry does not mount another classroom-detail query, so recovering from an initial HTTP 500 through the retry control makes exactly two requests (the failed read and the explicit retry).
- **One session object.** `call-session.ts` ties the mic, the peer mesh and the room client together; `CallProvider` (mounted in the app shell) owns the active session and exposes it to the UI through `use-call-session.ts`.
- **Mic capture and volume.** `mic-capture.ts` requests the microphone only when the user joins; `voice-activity.ts` measures volume from a Web Audio analyser to set the speaking flag and drive the head nod.
- **Rendering.** `call-stage-canvas.tsx` uses a single WebGL canvas with one viewport per tile instead of one canvas per participant, so the number of WebGL contexts stays at one regardless of the grid size. Tile layout is computed in `call-stage-layout.ts`; rig, blink, breathing, nod and emote playback live in `call-avatar-rig.ts`, `blink-scheduler.ts`, `speaking-nod.ts` and `use-emote-playback.ts`.
- **Receiver-side mute enforcement.** The sender disables its audio track when muted, and receivers also refuse to play audio from any peer the server state marks as muted (`remote-audio-sink.ts`), so a modified client cannot talk over a forced mute.
- **Autoplay unlock.** The Permissions-Policy sets `autoplay=()`, so remote audio playback is primed inside the user's join or answer click. If the browser still rejects `play()`, an "enable audio" fallback is shown.
- **Focus mode on the client.** `focus-mode.tsx` hides the world for students while the classroom state reports a class call with focus mode on. The server also ignores student movement, so hiding the world is a convenience and not the enforcement.
- **Dropped connections are not resumed.** The server removes a dropped participant immediately, so the client rejoins a class call once (`MAX_REJOIN_ATTEMPTS`) instead of renegotiating a held seat.

## Reproduce visual evidence (not a live call)

Open `/dev/ui/calls` in development or the `showcase` build. This separate lazy route renders the **production `CallView`, `CallStage`, `TeacherPanel`, and controls**, using the real modular avatar GLBs. The existing `__UI_SHOWCASE__` build-time gate excludes the route import and fixture data from production builds; no production call implementation or authentication behavior is replaced.

The Spanish title identifies a local sample. Two synthetic participants (teacher and student) receive deterministic typed props. Microphone toggling changes only local display state; moderation records a simulated request without changing the supplied snapshot; reactions increment a local `emote` / `emoteSeq` state on the teacher sample avatar so selecting any of the 13 reactions animates it locally without realtime messaging. Leave, end, and audio-unlock handlers are no-ops. The fixture does not join Colyseus, request microphone access, send media, or prove authorization, signaling, audio quality, or live moderation enforcement.

### Run and inspect

With the repository's Node 22 and pnpm 10 toolchain and installed dependencies, run from the repository root (POSIX/Git Bash syntax; public sample endpoints only):

```bash
VITE_APP_ENV=test VITE_API_BASE_URL=https://api.example.invalid VITE_REALTIME_URL=wss://realtime.example.invalid pnpm build:e2e
pnpm exec playwright test e2e/voice-calls.spec.ts
```

The existing `desktop` and `mobile` projects capture 1280×800 and 360×800 respectively. The test observes successful body/hair/top GLB responses and actual WebGL indexed geometry submissions matching those assets, rather than sleeping or treating canvas creation as avatar readiness. It checks viewport overflow, participant labels, keyboard microphone and teacher controls, and request-only moderation state. It requires working WebGL2; a 2D fallback is not accepted as visual evidence.

**Capture status: desktop and mobile checks passed (2/2); generated PNGs inspected by the coding agent.** Avatars, readable controls, and panel placement are visible; team visual approval remains pending; independent fixture review subsequently approved the scoped evidence. The test writes only these new paths:

- [1280×800 stage, teacher panel, and controls](./assets/voice-calls/fixture-panel-1280.png).
- [360×800 unobscured avatar stage and controls](./assets/voice-calls/fixture-stage-360.png).
- [360×800 expanded teacher panel and controls](./assets/voice-calls/fixture-panel-360.png). The production mobile panel overlays the stage, so both mobile states are captured.

These are visual-fixture checks, not full call-flow end-to-end coverage. Inspect the generated PNGs for actual avatar appearance, readable text, and panel/control placement before treating them as delivered evidence. No mobile frame-rate or real-device performance result is claimed.

## Correction verification checkpoint

The classroom retry correction and request-only moderation feedback have independent scoped reviews. The visual fixture has browser evidence and a subsequently recovered independent review approved its scoped evidence and production gate; this checkpoint is **not merge approval**.

| Check                                                           | Observed result                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, production build, security build check, assets | Passed                                                                                                                    |
| Production fixture exclusion                                    | Passed: no fixture module or unique fixture data in built JavaScript                                                      |
| Unit suite                                                      | Final `pnpm test`: 215 files and 2258 cases passed after isolating tooling first and bounding the application worker pool |
| Full browser suite                                              | Final hardware ANGLE D3D11 matrix: 175 passed, 1 existing skip, 0 failed; all original assertions and timeouts retained   |
| Python CI tests, documentation links, whitespace                | Passed: 10 Python tests and 124 Markdown files                                                                            |
| Formatting                                                      | Passed in the subsequently authorized bounded check (job 21), after correcting three new files                            |

A subsequently authorized isolated security-lint check passed 2/2 within the existing timeout (job 21); this does not retroactively make the earlier full unit run green or establish that timeout's cause. The earlier isolated inventory/regrading diagnostic failed all four cases (job 20), so those failures were not limited to the full-suite run. The subsequent hardware differential and full matrix passed. Earlier failed runs remain evidence, not retroactively successful runs.

Earlier SwiftShader browser failures affected Michi interaction, classroom invitations, inventory equip/rejection, and teacher regrading, on both viewports. Michi/invitation failures were also observed on the earlier develop baseline; the original inventory/regrading failures were investigated with renderer telemetry. Chromium was using ANGLE SwiftShader. With hardware ANGLE D3D11 on a verified RTX 4070 SUPER, the same four inventory/regrading cases passed (1.7–3.0 seconds each) under unchanged 15-second test limits and assertions. This differential provides strong environment evidence; it does not retroactively make the earlier full run green. Their snapshots show the slow-3D offer, but that offer alone does not establish causation. No timeout was increased and no failing expectation was weakened. The earlier context-stream abort assertion passed in this full run, without proving why it failed in the earlier focused batch.

The final hardware matrix used an ignored local wrapper with unchanged original test-source hashes, explicit `--use-angle=d3d11 --enable-gpu --disable-software-rasterizer`, and a runtime physical-GPU identity check. Screenshots were redirected to ignored artifacts; no failing test was excluded. The existing skipped case is the mobile-only unthrottled reference-scene overlay reading (`performance-offer.spec.ts:403`). The default headless renderer is environment-dependent; a passing D3D11 run is not a claim that the earlier SwiftShader run passed.

Vitest's declaration inventory was identical before and after grouping (1930 declarations across 215 files, expanding to 2258 executed cases); positional and name filters were also checked. Independent review covered the runner contract and the fixture's build-time exclusion.

The develop merge and seven conflicts remain explicitly deferred in the earlier correction stage above.

## Integrated develop and 13-emote checkpoint

PR #145 was locally integrated cleanly against latest `origin/develop` (`3dc0c294`, including PR #152 avatar clips/face and PR #151 family/parent routes + `e2e/register.spec.ts` alignment) on local branch `fix/141-pr145-develop-integration` (`0` commits behind `develop`, not pushed), and expanded to all 13 synchronized call reactions (`586aa6ec`), paired with backend `CALL_EMOTES` PR #157 (`feat/149-call-emote-animations`).

| Check                                                                   | Observed scope & result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, format, assets, security, production fixture exclusion | Passed on `586aa6ec`: `pnpm lint` (exit `0`), `pnpm typecheck` (exit `0`), `pnpm format:check` (exit `0`), `pnpm assets:check` (`197` models, `1.82 MB / 8.00 MB`), `pnpm build` (`813` modules) + `pnpm security:check` (exit `0`), `0` showcase fixture hits in `dist/assets/*.js`                                                                                                                                                                                                                                                                                                                     |
| Python CI tests & documentation links                                   | Passed on `586aa6ec`: `10/10` CI tests (`10.027s`) and `check_docs.py` (`124` files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Unit / integration Vitest                                               | Focused calls/sync/client suite on `586aa6ec`: **28/28 files, 266/266 passed**; post-merge #151 focus on `eb30ea6f`: **31/31 files, 332/332 passed** (cold `tooling src/config/eslint-security.test.ts` passed **2/2** in `3.4s` before the full rerun was canceled per user request not to repeat full suites). Earlier pre-reactions full runs: `e55769ba` passed **232/232 files / 2,465/2,465** (after preloading `./call-view` to eliminate a `5,353ms` cold lazy timeout), and `d668600b` passed **238/238 application files / 2,803/2,803** with 1 cold `24,070ms` ESLint timeout (`> 15,000ms`). |
| Hardware ANGLE D3D11 Playwright                                         | Targeted post-reactions runs: `e2e/classroom-workspace.spec.ts` **24/24** (`1b63c36a`) and `e2e/voice-calls.spec.ts` **2/2** (`586aa6ec`, desktop + mobile verifying 13 SVG menu items, bounded scrolling, and `'Bailar'` → `'dance:1'`). Earlier full hardware matrix on `e55769ba` passed **172/176** (`1` skip, `2` pre-existing `register.spec.ts:128` subsequently resolved by PR #151, `1` transient `ui-foundations.spec.ts:65` passing **14/14** on rerun).                                                                                                                                      |
| Paired backend & independent audit                                      | Backend PR #157 (`9e3f3af`): `@aula/contracts` **4/4 (139/139)**, sequential `@aula/realtime` **36/36 (531/531)**, builds, `typecheck`, `lint`, `format:check`, `realtime:codegen:check`, `check_docs.py` (`87` files). Independent read-only audit returned **PASS** (`0` blocking, `1` minor note for unused `'Celebrate'` fallback).                                                                                                                                                                                                                                                                  |

Remaining requirements before merge: team review and visual approval of screenshots, passing CI after pushing frontend PR #145, merging paired backend PR #157 before or with frontend PR #145, and live multi-device WebRTC audio/signaling verification.

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
