# Tracker — Agustin

## 2026-11-26 — Emote wheel focus and announcements (#149)

- **Status:** completed
- **Area / files:** `src/features/classrooms/`
- **Change:** Pressing a gap of the wheel keeps focus; one always-mounted live region announces the cooldown and a short-lived send failure.
- **Reason:** Keyboard controls stopped working after a gap press, and screen readers missed the status.
- **Verification:** Strict TDD; emote tests, lint, typecheck, prettier.
- **Next step:** Visual check of the status position and of presses inside the wheel.

## 2026-11-26 — Remove the on-screen gestures button (#149)

- **Status:** completed
- **Area / files:** `src/features/classrooms/`, `docs/realtime-client.md`
- **Change:** The emote wheel opens with Space only; the floating button was removed.
- **Reason:** Owner review: the button looked disconnected from the rest of the app.
- **Verification:** Emote and classroom stage tests, lint, typecheck.
- **Next step:** Touch devices have no way to open the wheel; decide where to place a trigger.

## 2026-11-26 — Avatar emotes in the 3D classroom (#149)

- **Status:** completed (not visually checked)
- **Area / files:** `src/features/classrooms/`, `src/features/world/{avatar,classroom}/`, `src/realtime/`, `docs/realtime-client.md`
- **Change:** Space or a button opens a wheel with five gestures (Wave, Cheer, Clap, Dance, RaiseHand); the room announces them to everyone and each avatar plays the clip once. Moving cancels it; the contract constants mirror `packages/contracts`.
- **Reason:** Members can express themselves in the live classroom.
- **Verification:** Strict TDD; touched test files, lint and typecheck. No full suite, build, e2e or visual review.
- **Next step:** Visual check with two users against the backend that has `avatar:emote`.

## 2026-11-26 — Profile streak uses the real gamification route (#149)

- **Status:** completed
- **Area / files:** `src/features/points/`, `src/test/msw/handlers.ts`, `e2e/{profile,daily-review}.spec.ts`, `docs/streak-and-badges.md`
- **Change:** The streak reads `GET /gamification/me` with generated types; schema, mocks and the hidden badge showcase follow the real contract (earned badges only).
- **Reason:** `/profile` always failed to load the streak: the client called a route that does not exist.
- **Verification:** Strict TDD (service test failed first); touched test files, lint and typecheck. No full suite, build or e2e.
- **Next step:** Check `/profile` against the running backend.

## 2026-11-26 — Profile page redesign (#149)

- **Status:** completed (not visually checked)
- **Area / files:** `src/features/{profile,inventory,points}/`, `e2e/profile.spec.ts`, `docs/{routing,ui-inventory,streak-and-badges}.md`
- **Change:** Sticky avatar preview beside a name field and Cuerpo/Pelo/Ropa/Accesorios tabs; picture cards with clear chosen and locked states; locked items link to the shop; accessories one part at a time with a clear classroom and instant save; streak and email moved to a small footer; medals hidden (code kept).
- **Reason:** The owner rejected the previous page: weak hierarchy, no item previews and a poor selector.
- **Verification:** Strict TDD on the profile page tests; inventory panel tests, lint and typecheck. No full suite, build, e2e (spec updated, not run) or visual review.
- **Next step:** Visual check at desktop and 360px.

## 2026-11-26 — Shop previews for hair styles and tops (#149)

- **Status:** completed (not visually checked)
- **Area / files:** `src/features/shop/`, `docs/classroom-shop.md`
- **Change:** Hair styles and tops render worn by the avatar body instead of an illustration; `AvatarThumbnail` exposes the same thumbnails by style id or accessory code and body. The preview renderer now releases its WebGL context when idle.
- **Reason:** Students could not see what they were buying.
- **Verification:** Strict TDD on the touched test files, lint and typecheck. No full suite, build, e2e or visual review.
- **Next step:** Visual check of the framing in the shop.

## 2026-11-26 — Welcome scene face, outfit and backdrop fixes (#149)

- **Status:** completed (not visually checked)
- **Area / files:** `src/features/world/{avatar,preview}/`, `src/features/world/world-canvas.tsx`, `src/features/profile/avatar-preview-3d.tsx`, `src/app/router/auth-layout.tsx`, `src/styles/`, `docs/`
- **Change:** Avatars rest on a neutral face (slightly happy on the welcome scene and profile preview); public gestures are Wave, Cheer, Clap and Dance; the outfit no longer cycles and the character and scenery change only on reload; a warm gradient backdrop replaces the near-white one.
- **Reason:** Characters looked sad because both body GLBs ship with `Sad` on; the outfit changed while the page was open; the scene's near-white clear color looked bad.
- **Verification:** Strict TDD on the touched test files, lint and typecheck. Full suite, build, e2e and visual review not run.
- **Next step:** Visual check of the face, backdrop and frame on `/login` and the profile preview.

## 2026-11-25 — Avatar customization rework (#149)

- **Status:** completed (design not reviewed)
- **Area / files:** `src/features/profile/`, `src/features/inventory/profile-inventory-section.tsx`, `src/features/world/preview/use-show-step.ts`, `docs/routing.md`
- **Change:** The profile avatar section is now one customization workspace: large animated front preview, choices grouped by category, and the per-classroom inventory inside it, with the preview wearing that classroom's accessories.
- **Reason:** The customization area had never had its visual rework.
- **Verification:** Strict TDD on the touched test files, lint, typecheck, build and `security:check`. No visual review; `docs/assets/profile/` screenshots are stale.
- **Next step:** Visual review at 1280px and 360px, then refresh the screenshots.

## 2026-11-25 — Review fixes for the welcome scene, desk map and bot skins (#149)

- **Status:** completed
- **Area / files:** `src/features/world/preview/`, `src/features/world/npc/`, `src/features/classrooms/{desks,settings}/`, `src/realtime/client.test.ts`, `docs/3d-assets.md`
- **Change:** Wide side pieces are shrunk to fit the 16:9 frame; an unexpected `deskDecor` value only empties its own desk. Added coverage for every character model and for clearing a synced desk decor. Parts a bot skin hides now stay unmerged although they load as groups, and settings send the skin only when changed.
- **Reason:** Review findings: cut-off scenery, one bad desk failing the whole map, skins not hiding the real bot parts and unrelated saves resetting an unknown skin.
- **Verification:** Touched tests, lint and typecheck. Not checked visually.
- **Next step:** F5 customization rework.

## 2026-11-25 — Tutor bot skins and selector (#149)

- **Status:** completed (not visually checked)
- **Area / files:** `src/features/world/npc/`, `src/features/world/asset-cache.ts`, `src/features/classrooms/` (settings, schema, presence, 3D stage, desk schema), `src/realtime/`, `src/api/schema.generated.ts`, `src/test/msw/handlers.ts`, `docs/3d-assets.md`
- **Change:** Staff pick the bot skin in classroom settings; the bot wears the synced value. Embedded textures now load through an image element, so skinned and cat textures work under the unchanged CSP. Contracts synced from back `ff6cb8e`, replacing the local `deskDecor` type.
- **Reason:** The seven merged skins were unused; back counterpart integratec-final-back#154.
- **Verification:** Strict TDD on the touched test files, lint, typecheck and `security:check`. Full suite, e2e and visual review not run.
- **Next step:** Visual review of each skin and of the cat texture in a real browser.

## 2026-11-25 — Animated 3D welcome scene on the public screens (#149)

- **Status:** completed (not visually checked)
- **Area / files:** `src/features/world/preview/`, `src/features/world/{camera,world-canvas}.ts*`, `src/app/router/auth-layout.tsx`, `docs/{3d-assets,routing}.md`
- **Change:** The auth layout's placeholder is now a front view with a random character that waves, animates and changes outfits beside random scenery, lazy-loaded with a quiet fallback.
- **Reason:** Preview areas had no 3D scene.
- **Verification:** Strict TDD on the touched test files, lint, typecheck, build and `security:check`. Full suite, e2e and visual review not run.
- **Next step:** Visual review of framing and scenery positions at 1280px and 360px.

## 2026-11-25 — Desk decor on each student's desk (#149)

- **Status:** completed (not visually checked)
- **Area / files:** `src/features/world/classroom/` (`desk-decor.ts`, kit manifest, scene), `src/features/classrooms/` (desk map schema, presence, 3D stage), `src/realtime/client.ts`, `src/features/shop/item-preview-source.ts`, `src/test/msw/handlers.ts`, `docs/art/classroom-desk-decor.md`
- **Change:** Each desk shows the student's equipped `desk_decor` item (synced value first, desk map otherwise) and the shop previews the same seven models.
- **Reason:** Desk upgrades were not visible anywhere; back counterpart integratec-final-back#154.
- **Verification:** Strict TDD on the touched test files, lint and typecheck. Full suite, build, e2e and visual review not run.
- **Next step:** Visual review; run `pnpm api:sync` to replace the local `deskDecor` type extension.

## 2026-11-25 — Equip hand, neck and ear accessories from the inventory (#149)

- **Status:** completed
- **Area / files:** `src/features/inventory/`, `src/api/schema.generated.ts`, `src/realtime/contracts.generated.ts`, `src/test/msw/handlers.ts`, appearance fixtures in `src/realtime/client.test.ts`, `src/features/classrooms/classroom-presence.test.tsx` and `e2e/inventory.spec.ts`, `docs/ui-inventory.md`
- **Change:** The inventory offers `Mano`, `Cuello` and `Orejas` rows to equip and unequip; types were regenerated from back commit `cb46656` (`pnpm api:sync --backend-dir`), which also brings the already published `INVITEE` registration path.
- **Reason:** Students could buy these accessories but not wear them; back counterpart integratec-final-back#154.
- **Verification:** Strict TDD on the touched test files, lint and typecheck. Full suite, build, e2e and visual evidence not run.
- **Next step:** Deploy together with the back API and realtime services; refresh inventory screenshots during visual review.

## 2026-11-25 — Hand, neck and ear accessories and shop 3D preview (#149)

- **Status:** completed
- **Area / files:** `src/features/world/avatar/`, `src/features/shop/`, `src/realtime/client.ts`, `src/features/classrooms/use-classroom-presence.ts`, `docs/art/{hand-items,neck-ears}.md`
- **Change:** Added the `hand`, `neck` and `ears` slots to the avatar catalog (19 items, colors mirroring the shop seed), the part plan and the synced equipped codes; the shop preview now resolves every accessory from that catalog by shop code, tints only `AvatarAccessoryTint` and poses skinned meshes.
- **Reason:** The merged assets are unused and shop accessory previews fail; back counterpart integratec-final-back#154.
- **Next step:** Equip and inventory UI (entry above).

## 2026-11-25 — Study guide bot material contract fix

- **Status:** completed (pending push, CI and review)
- **Area / files:** `src/features/classrooms/materials/` (bot schema, service, toggle, panel, copy), `src/test/msw/handlers.ts`, `e2e/study-materials.spec.ts`, `docs/threat-model.md`
- **Change:** The material switch uses the published back contract (paginated GET reading all pages, POST `{materialId}`, DELETE) with generated types; adds a retry action for failed indexing, a pending-cleanup message for 503, and MSW handlers that follow the contract.
- **Reason:** Enabling a material failed with 404 because the front still used a provisional `PUT` contract.
- **Verification:** Tests written first and seen failing; the five material test files (50 tests), lint and typecheck pass. Full suite, build and E2E not run locally.
- **Next step:** Review, push and CI. Images (PNG/JPEG) can never be indexed by the back.

## 2026-11-24 — Interactive props, decorations, pet and tutor bot routines (#138)

- **Status:** completed (pending visual review, CI and merge of the PR)
- **Area / files:** `src/features/world/classroom/` (interactive and decoration placements, door with local occlusion fade, kit batching by material appearance and TypedArray cloning, asset error wiring), `src/features/world/npc/` (tutor bot, classroom pet, clip plans, live positions, skinned mesh merge, speech bubble), `src/features/world/asset-cache.ts` (CSP-safe `TextureLoader` for embedded GLB images), `src/features/classrooms/` (bot station, chat computer and report card stand interactables), `src/realtime/` (NPC snapshot, `npc:interact`, synced layout props, equipped items read from the synced map), `public/models/` (#137 interactive models, #139 cat clips and decorations), `e2e/classroom-interactables.spec.ts`, `docs/technical-justification.md`, `docs/3d-performance-monitor.md`
- **Change:** The classroom places only the props with a feature: door (exit), collaborative and bulletin boards, shop kiosk, chat computer, report card stand, bot station (bot panel) and pet bed (`6c67d04`, `2ff8866`, `cdf6a01`); the door stays at the entrance and fades locally when it hides your avatar. The tutor bot and Michi follow the room-synced routine with real clips (procedural fallback for the cat), and pressing E on them shows the shared reaction or academic phrase (`7d07105`, `c805688`, `0c8d6fe`, `2d01a56`). Flags at the teacher desk corners, christmas tree, plants, globe, rug and wall decor added; the kit batches by material appearance and the NPC meshes merge by material, so the scene costs 59 draw calls with both NPCs (`1401415`, `798f0d9`, `da165f9`). Fixed equipped accessories never rendering live (`3b47cf4`). Updated `createConfiguredGltfLoader` to use `TextureLoader` instead of `ImageBitmapLoader` so embedded GLB images (`pets/cat/body.glb`) load under `img-src` without violating `connect-src`, updated the Michi proximity E2E to `Acariciar a Michi` / `npc:interact`, switched `buildBatchedKit` cloning to TypedArray slices, wired door/NPC GLB load failures into `onAssetError`, and recorded the FD8 triangle-budget exception.
- **Reason:** Use the #137 and #139 assets in the running classroom and bring the pet and tutor bot to life; back counterpart integratec-final-back#147.
- **Verification:** Per-task strict TDD on touched tests, lint, typecheck, format, build, `security:check`, `assets:check`, `check_docs.py`, Vitest suites, and hardware-GPU Playwright E2E specs.
- **Next step:** Final team review and merge into `develop`.

## 2026-11-24 — Modular avatar and classroom assets (#135, covers #58)

- **Status:** completed (pending CI and merge of the PR)
- **Area / files:** `src/features/world/avatar/` (part composer, accessory catalog, part plan, avatar model), `src/features/world/classroom/` (modular kit loader and material batching, shell and furniture placements, invisible picking proxies), `src/features/profile/` (new style catalog, locked paid styles), `src/features/shop/` ("Peinados y ropa"), `src/realtime/`, `src/api/schema.generated.ts`, `public/models/` (legacy avatar GLBs removed), `docs/classroom-workspace.md`
- **Change:** The avatar is composed from body, hair, top and equipped head/face/back parts with fixed accessory colors, headwear-aware hair hiding and the back-tuck morph (`9f01a8b`, `51fe6a2`, `94e2195`); new hair/top catalog with free and shop-locked styles (`995c1f7`, `82915f8`); legacy avatar models removed (`9a696ae`). The classroom is assembled from Alejo's modular kit: shell (`ecb7611`) and furniture (`9c760fd`), batched by material so the kit costs 21 draw calls instead of 85 (`649630c`, `5db5ae0`, `22c3780`). Merged `develop` with the immersive 3D classroom (#128).
- **Reason:** Use the assets merged in #132 and #134 in the running app for the demo; back counterpart integratec-final-back#145.
- **Verification:** Per-task strict TDD on touched tests, lint and typecheck; once before the PR `--changed origin/develop` (only load timeouts in 3 untouched files, passing alone), build and `security:check`; native review approved on each task; visual approval by Agustin. E2E specs not run locally (CI).
- **Next step:** CI green and merge.

## 2026-11-24 — UI polish pass for classroom panels (#131)

- **Status:** completed (pending review and merge; stacked on PR #129)
- **Area / files:** `src/features/classrooms/` (activities, materials, announcements, grades, roster/directory, bot, settings, chat), `src/features/shop/`, `src/features/chat-dock/`, `src/components/ui/{dropdown-menu,initials-avatar}.tsx`, `src/styles/tokens.css`, `src/test/msw/handlers.ts`, `src/api/schema.generated.ts`, `e2e/{study-materials,announcements}.spec.ts`
- **Change:**
  - Activities: roomy rows with a shared overflow menu, and grouping by state (`52148c5`).
  - Material: ordered modules with lazy lists, "Sin módulo", create, rename, delete, reorder, upload into a module and move. Uses back #142 (`55f965d`, `8f0cd65`).
  - Notices: a notice board of paper notes (`bbe9c8a`).
  - Grades: a sticky gradebook for staff and a report card for students (`33d627f`).
  - Members: a grouped directory (`f472d22`).
  - Bot: chat bubbles and suggested prompts (`21d2513`).
  - Shop: a storefront with real item previews (`47ee105`).
  - Wide panels (`2505e62`).
  - Settings: a working panel for name, subject, adult mode and chat mute, plus access (`b2757ed`). The panel stays open after saving (`789df7e`).
  - Chat dock: open/close animation, a continuous surface and a chat-like empty state (`efc8d44`). The moderation action sits beside the bubble (`7e014bc`). The composer grows automatically up to four lines (`f512fc3`).
- **Reason:** Every panel looked like the same thin card, wasted space and did not represent its content. Material could not be organized, and Settings was a placeholder.
- **Verification:**
  - Each task used strict TDD.
  - Per task, the checks were lint, typecheck and prettier, plus the affected tests. The early tasks also ran `--changed`, build and `security:check`.
  - Playwright passed for the touched specs.
  - Before/after screenshots are in the local `odd/screens/ui-polish/`.
  - Agustin approved the visuals.
- **Next step:** Review, then retarget to `develop` once PR #129 merges.

## 2026-11-24 — Immersive 3D classroom (#128)

- **Status:** completed (pending CI and merge of the PR)
- **Area / files:** `src/features/classrooms/` (3D stage, floating HUD and top bar, presence pill, proximity prompt, E key, back-to-list link, panels overlay), `src/features/world/` (follow camera, avatar yaw and clip blending, proximity tracker), `src/features/notifications/notification-host.tsx`, `src/features/profile/profile-nav-link.tsx`, `src/app/router/app-shell.tsx`, `src/app/pages/{profile,chats}-page.tsx`, `src/components/ui/dialog.tsx`, `e2e/classroom-{interactables,workspace}.spec.ts`
- **Change:** In 3D mode the world fills the screen with floating rounded UI: top navbar (back, classroom, wallet, mode toggle, profile icon, messages, notifications), standalone side buttons (Activities, Material, Grades, Notices / Members, Bot, Shop), compact presence pill bottom-left, and centered panels with a translucent overlay (`d096df1`, `9011016`, `f38eba0`). Chat is reached only through the chat dock (removed from the side group and the 2D layout); the hint strip and pet button are gone and the pet greeting auto-dismisses; `/profile` and `/chats` get the back-to-list link (`b572207`). Follow camera with a fixed closer zoom that keeps the avatar centered (`46cef87`, `1b7b27e`). `Run` clip with crossfade and smooth shortest-path turning for local and remote avatars (`839031b`). Proximity highlight with an "E" prompt and the E key to interact (`a0a0770`).
- **Reason:** The 3D world had no leading role (a card below the header), the camera was far and static, avatars looked stiff and turned abruptly, and objects could only be used by click or the bar.
- **Verification:** Per-task strict TDD; `--changed origin/develop`, lint, typecheck, build and `security:check` on each task (only load flakes in untouched files, passing alone); native review approved on each task (T1–T4); visual approval by Agustin on each task. E2E specs not run locally (CI).
- **Next step:** CI green and merge.

## 2026-11-21 — Review and fixes on PR #115 (#57, inventory selector)

- **Status:** completed (pending CI and merge of PR #115)
- **Area / files:** `src/features/inventory/`, `src/features/shop/`, `src/features/profile/`, `src/test/msw/handlers.ts`, `e2e/inventory.spec.ts`, `docs/ui-inventory.md`, `docs/assets/inventory/`, `changelogs/tracker-alejo.md`
- **Change:** Merged `develop` (`6e8fd52`, tracker conflict). Review fixes: `81a2260` resolves the slot from the catalog item `metadata.slot` and makes the MSW store return 409 like the back end; `ec87eca` keeps concurrent equips (each confirmation merges only its slot) and loads every purchase and catalog page; `59807b4` replaces the selector with a per-slot grid with accessibility (radiogroup, roving tabindex, status region; visual approved by Agustin); T4 (this commit) updates `docs/ui-inventory.md` and the trackers.
- **Reason:** Review findings on PR #115.
- **Verification:** inventory, shop and profile tests 87/87; `--changed origin/develop` 872/872; `e2e/inventory.spec.ts` 2/2; lint, typecheck, build and `security:check` pass.
- **Next step:** CI green and merge.

## 2026-11-21 — Review and fixes on PR #114 (#56, runtime performance monitor)

- **Status:** completed (pending CI and merge of PR #114)
- **Area / files:** `src/features/world/` (performance monitor, probe, overlay, GPU estimate), `src/features/classrooms/` (performance offer banner, workspace, messages), `e2e/performance-offer.spec.ts`, `docs/3d-performance-monitor.md`, `docs/technical-justification.md`, `docs/assets/classroom-workspace/performance-offer-{1280,360}.png`, `changelogs/tracker-alejo.md`
- **Change:** Merged `develop` (`3db911e`; the performance probe is now a child of `ClassroomWorld`, which forwards `children`). Review fixes: `400dc16` estimates GPU memory only on a stats refresh instead of every frame; `8545735` offers 2D mode on very slow devices (`minDecisionSpanMs` of 6000 ms); `1889277` banner behavior (focus returns after a decline, a manual 2D switch resolves the offer, full-width mobile buttons, clearer copy). Re-measure and docs (this commit): numbers now come from the populated classroom scene (56 draw calls, 66206 triangles, about 3 MB GPU estimate; 3.8 fps desktop and 4.5 fps mobile at 20x CPU throttle with the offer shown), the FD8 open item is updated, and the overlay is documented as runtime-gated by `appEnv !== 'production'` instead of removed from production bundles.
- **Reason:** Review findings on PR #114; the earlier numbers described the empty stage.
- **Verification:** Per-task strict TDD, `--changed origin/develop`, lint, typecheck, build, `security:check`; native review approved on each task commit; `e2e/performance-offer.spec.ts` 5 passed, 1 skipped by design (desktop and mobile).
- **Next step:** CI green and merge.

## 2026-11-20 — Review and fixes on PR #113 (#51, classroom chat)

- **Status:** completed (pending CI and Agustin's visual check before merging PR #113)
- **Area / files:** `src/features/classrooms/chat/`, `src/features/chat-dock/`, `src/features/chat-inbox/`, `src/features/chat-page/`, `src/app/pages/chats-page.tsx`, `src/app/router/`, `src/realtime/classroom-realtime-manager.ts`, `src/realtime/classroom-realtime-provider.tsx`, `src/api/query-keys.ts`, `src/api/schema.generated.ts`, `src/realtime/contracts.generated.ts`, `docs/ui-chat.md`
- **Change:** Merged `develop` (MSW handlers conflict, both sides kept). The chat now reads like a messenger: oldest to newest with infinite scroll up, fixed composer, Enter sends. Messages arrive live through the classroom Colyseus room (one ref-counted connection per classroom). Composer hardening: uncertain sends reconcile instead of duplicating, debounced mention lookup in its own query domain, accessible mention listbox, 429 cooldown. New floating chat dock (bottom-right, unread counts, read markers) and an all-chats page `/chats` reached from a navbar button next to notifications. Toasts moved to the bottom-left so they don't cover the dock.
- **Reason:** Review findings on PR #113 plus Agustin's product decision (2026-11-20) to turn the chat into LinkedIn/Facebook-style messaging with unread counts. Backend counterpart: back PR #125 (issue #124), merged.
- **Verification:** Per-task strict TDD; `--changed origin/develop` up to 887/887 (only known load timeouts that pass in isolation on some runs); lint, typecheck, build, `security:check`, `check_docs.py`. Native review approved on each task commit. Browser smoke tests (desktop 1366x768 and mobile 375x740) of the dock and the `/chats` page against the local backend.
- **Next step:** CI green, Agustin's visual check, merge.

## 2026-11-19 — Review and fixes on PR #110 (#55, daily review modal)

- **Status:** completed (pending CI and merge of PR #110)
- **Area / files:** `src/features/daily-review/daily-review-dialog.tsx`, `src/features/daily-review/messages.ts`, `src/features/daily-review/daily-review-dialog.test.tsx`
- **Change:** Merged `develop` into the branch (no conflicts). Daily question flow: a `409 already_answered` now locks the card, a failed submit has its own message, a synchronous guard prevents double submits, and while the question is unanswered Escape and outside clicks no longer dismiss the dialog (only the close button does; owner decision, since the server already recorded the delivery). Accessibility and content: the dialog description is linked again, item keys are stable, the radio group is named once by the prompt, headings follow the dialog title (h3/h4), focus moves to the answer result with a persistent live region, and empty sections use per-section copy.
- **Reason:** Review findings on PR #110. The provisional contract stays (back #42 open, proposal back #119); against the local backend the endpoint answers 404 and the dialog stays closed without blocking the app.
- **Verification:** Per-task affected tests (daily-review 30/30; `--changed` with only the known flaky `classroom-invitations-panel` timeout, which passes in isolation), lint, typecheck, build, `security:check`. Native review approved on each task commit.
- **Next step:** CI green and merge.

## 2026-11-19 — Review and fixes on PR #109 (#43, student exam answering)

- **Status:** completed (pending CI and merge of PR #109)
- **Area / files:** `src/features/classrooms/activities/exam/`, `src/api/schema.generated.ts`, `src/features/notifications/`, `src/features/classrooms/activities/submission/submission-schema.ts`, `src/test/msw/handlers.ts`, `e2e/exam-answering.spec.ts`, `docs/exam-answering.md`
- **Change:** Merged `develop` into the branch (tracker conflict, both entries kept). Fixed the reconcile flow (a failed verification read now reports "unverifiable" instead of "nothing stored") and kept a confirmed result visible when the background refresh fails. Improved form accessibility (prompt describes each radio group, option keys, focus on the result and on validation errors, inputs disabled when the window is blocked). Rewired the panel from the never-shipped provisional `/exam-answers` endpoints to the real back #47 contract (`POST /activities/{id}/submissions` with a JSON `answers` field, `GET .../submissions/me`, `autoScore`), synced contracts with back `develop` and adapted notifications to the synced schema (`badge_awarded`, nullable `classroomId`).
- **Reason:** Review findings on PR #109; the visual check against the local backend returned 404 on every submission because back #47 shipped a different contract.
- **Verification:** Per-task affected tests (exam suites 32/32, `--changed` 715 pass), lint, typecheck, build, `security:check`, `check_docs.py`, Playwright exam/submission/notification specs 16/16; live submission against the local backend stored `autoScore` 7/10. Native review approved on each task commit.
- **Next step:** CI green and merge. MC auto-scores do not credit points until a teacher grades (back behavior, out of scope).

## 2026-11-19 — 3D classroom scene and local avatar navigation (front #36)

- **Status:** in-progress (branch `feat/36-classroom-scene`, cut from `feat/35-avatar-3d-preview` because the scene reuses `AvatarModel`; no PR yet)
- **Area / files:** `src/features/world/movement/`, `src/features/world/input/`, `src/features/world/classroom/`, `src/features/world/camera.ts`, `src/features/world/world-canvas.tsx`, `src/lib/input-arbitration.ts`, `src/features/classrooms/classroom-3d-stage.tsx`, `src/features/classrooms/classroom-workspace.tsx`, `docs/classroom-workspace.md`
- **Change:** The 3D classroom view now shows a placeholder room built from the shared `CLASSROOM_LAYOUT` (desks match server collisions) with the user's own avatar. It moves locally with W/A/S/D or arrows and by clicking or tapping the floor (grid A* path, no false arrival on unreachable targets), with Walk/Idle clips, a destination marker and `Escape` to cancel. Input arbitration is shared with the `Alt+M` shortcut. The movement intent is exposed for `#37`.
- **Reason:** First visible step of HU-ESP-001: users can see and move their avatar in the classroom before realtime presence lands.
- **Verification:** Per-task affected tests, lint, typecheck, build and `security:check`; RDD reviews of each task commit approved. Look and feel still need a visual check in a real browser.
- **Next step:** Visual check, then open the PR to `develop`; `#37` sends the intent to the room.

## 2026-11-18 — 3D avatar preview and shared avatar component (front #35)

- **Status:** in-progress (branch `feat/35-avatar-3d-preview`, no PR yet)
- **Area / files:** `src/features/world/avatar/`, `src/features/world/world-canvas.tsx`, `src/features/world/camera.ts`, `src/features/world/world-lighting.tsx`, `src/features/profile/avatar-preview-view.tsx`, `src/features/profile/avatar-preview-3d.tsx`, `src/features/profile/avatar-form.tsx`, `docs/3d-assets.md`
- **Change:** Added the shared `AvatarModel` (modular body + hair + top GLBs, per-instance tints, part and body failure handling, Idle clip that respects reduced motion and keeps the demand frame loop alive). The profile avatar form now shows the draft in 3D, with the 2D preview as the fallback when WebGL is unavailable or lost, the body file fails, or the 3D chunk cannot load. `WorldCanvas` gained optional avatar framing, role, sizing, loading and `onUnavailable` props with unchanged defaults. Documented the modular avatar layout in `docs/3d-assets.md`.
- **Reason:** Every 3D surface (profile, own avatar, remote players, accessories) needs one config-to-model mapping instead of per-screen drawings.
- **Verification:** Per-task affected tests, lint, typecheck, build, `security:check` and `assets:check`. Framing and look still need a visual check in a real browser.
- **Next step:** Visual check of the preview framing, then open the PR to `develop`.

## 2026-11-18 — Review and fixes on PR #92 (#49, announcements notice board)

- **Status:** completed (pending merge of PR #92)
- **Area / files:** `src/features/classrooms/announcements/`, `docs/threat-model.md`
- **Change:** Reviewed TheKade's PR #92 and merged `develop` into it (threat model entries renumbered to TM-028..TM-030 after two develop merges). Fixes on the PR branch: stale edit form on 404 and row actions locked during submit (0943560), duplicate guard after an uncertain create (ed1c105), delete 404 treated as already removed and focus restored after edit (53856c4), corrected threat model mitigations and friendlier content helper copy (d657473), card actions wrapping below the title on narrow screens (c85f3a3).
- **Reason:** Verified review findings against the code before applying them.
- **Verification:** Per-task affected tests, lint, typecheck, build and `security:check`; RDD review of 0943560..53856c4 approved.
- **Next step:** Mobile card header layout, then open the review for merge.

## 2026-11-18 — Local verification scope

- **Status:** completed
- **Area / files:** `README.md`, `docs/testing.md`
- **Change:** Local checks before pushing now run only the affected tests (`pnpm vitest run --changed origin/develop`) plus lint, typecheck, build and `security:check`. The full test suite runs in the CI `checks` job.
- **Reason:** Full local runs were slow and timed out randomly under load, and CI already runs the full suite on every pull request.
- **Next step:** None.

## 2026-11-18 — Review and fixes on PR #86 (#34, 3D / 2D Classic Mode switch)

- **Status:** completed (pending merge of PR #86)
- **Area / files:** `src/features/classrooms/classroom-workspace.tsx`, `src/features/classrooms/classroom-2d-layout.tsx`, `src/features/classrooms/classroom-list-page.tsx`, `src/components/ui/button.tsx`, `src/components/ui/dialog.tsx`, `src/styles/tokens.css`, `src/styles/index.css`, docs
- **Change:** Reviewed Mati's PR #86 and merged `develop` into it (threat model entries renumbered to TM-023/TM-024). Added a back-to-list arrow in the classroom header (route `/`), a single join-by-code action on the empty classroom list, themed scrollbars with design tokens, and a dialog layout whose scroll area stays clear of the rounded corners and the close button. Polished the mode switch: panel buttons named by their title, visible `Alt+M` hint, mode badge removed, toggle as `outline`, duplicate session cleanup removed.
- **Reason:** Verified review findings plus visual issues found while testing the merged branch locally.
- **Open points:** Opening panels from the 3D view belongs to #38; classroom deletion has no defined path yet (`back/rules/data.md`, open decision).
- **Next step:** Merge PR #86 once CI passes and close #34.

## 2026-11-17 — Amplify Hosting live (#22, tasks T2 to T5)

- **Status:** in-progress (pending pull request)
- **Area / files:** `docs/ci.md`, `changelogs/tracker-agustin.md`
- **Change:** The frontend is published at `https://develop.d61i488hxxotx.amplifyapp.com` from Amplify app `d61i488hxxotx` (`us-east-2`, branch `develop`, stage `PRODUCTION`). The app was connected once from the Amplify console through the GitHub App (no tokens), then imported into the backend Terraform (back PR #108). The backend CORS origin and the password reset URL point to it (`/password-reset` route), and back PR #109 fixed the API and realtime base URLs to include the Caddy paths (`/api`, `/realtime`). `docs/ci.md` now holds the deployment record: environment, job ids, commit, URLs, how deploys happen and the smoke results.
- **Reason:** Issue #22 requires a public HTTPS URL and a deployment record naming the environment and commit.
- **Open points:** A real login smoke is not done. Promotion to `main` and the #58 pipeline are pending.
- **Next step:** Close #22 after this pull request merges.

## 2026-11-17 — Amplify Hosting build spec (#22, task T1)

- **Status:** in-progress
- **Area / files:** `amplify.yml`, `.gitignore`, `scripts/ci/test_checks.py`, `docs/security.md`, `docs/routing.md`, `docs/ci.md`, `docs/development.md`, `docs/technical-justification.md`, `rules/deployment-and-operations.md`, `README.md`
- **Change:** Added the Amplify build specification (pinned Node and pnpm, frozen install, `security:sync`, `build`, `security:check --require-root-match`, artifacts from `dist/`, project-local pnpm store cache) with a regression test for its contract. Docs now state `us-east-2`, the keyless GitHub App connection made once in the console, and that the backend Terraform owns the app, connected branch, branch variables and SPA rewrite rule.
- **Reason:** The frontend is not published yet; Amplify needs a versioned build spec, and the docs still described `sa-east-1` and GitHub OIDC.
- **Next step:** Connect the app from the Amplify console (T2), then import it into backend Terraform (T3). Nothing is deployed yet.

## 2026-11-11 — Visual pass: split auth layout and illustrated error views (#20, task 6)

- **Status:** in-progress (feature complete, pending pull request)
- **Area / files:** `PRODUCT.md`, `src/app/router/auth-layout.tsx`, `src/app/router/focus-on-navigation.tsx`, `src/app/router/app-shell.tsx`, `src/app/router/routes.tsx`, `src/app/router/error-boundaries.tsx`, `src/app/router/go-home-link.tsx`, `src/app/pages/`, `src/components/illustrations/scenes.tsx`, `src/components/layout/skip-link.tsx`, `src/app/messages.ts`, router tests, `e2e/ui-foundations.spec.ts`, `docs/routing.md`
- **Change:** Login, register, password reset and invitation acceptance now use their own split-screen layout without a sidebar (a brand panel with a classroom scene drawn in inline SVG from the design tokens, and a form column ready for the feature forms). The 404, forbidden, unexpected-error and stale-version views are illustrated with the same scene style and have clear actions; the root fallback stays plain markup but is styled. The shell no longer shows the component showcase link (the `/dev/ui` route is unchanged and still dropped from production builds) and renders no empty sidebar. The skip link and focus-on-navigation moved into shared pieces so both layouts use them. Added `PRODUCT.md` with the confirmed product context.
- **Reason:** The first pass had no design: placeholders lived inside the app shell, a dev-only link showed on every page and the error views were bare text.
- **Next step:** Open the pull request to `develop`.

## 2026-11-11 — Skip link, focus, document title and router review gaps (#20, task 5)

- **Status:** in-progress (feature complete, pending pull request)
- **Area / files:** `src/app/router/app-shell.tsx`, `src/app/router/document-title.ts`, `src/app/router/error-boundaries.tsx`, `src/app/router/routes.tsx`, `src/app/pages/placeholder-page.tsx`, `src/app/ui-foundations.tsx`, `src/features/classrooms/use-classroom-capabilities.ts`, `src/session/redirect.ts`, `src/app/router/return-target.ts`, router tests, `docs/routing.md`, `docs/development.md`, `docs/ui-showcase.md`, `package.json`
- **Change:** The main landmark now has a stable id used by the skip link on every route; after a client-side navigation focus moves to the new page heading (never on first load or on the login redirect that resolves it); `document.title` is `<page> · IntegrarTec` through one hook, including not-found, forbidden and error views. The root error fallback is plain markup so it survives a broken shared component. The capability hook wraps any non-`ApiError` instead of casting it. `safeSessionRedirect` takes an optional allowlist (tests only; production stays `/`). The showcase route object is now created per router (react-router mutates route objects, and sharing one broke a second router). Added tests for axe on every page, the skip link, titles, the showcase link, the return-target round trip, loader error retry and the capability gate edge cases. Added `docs/routing.md` (route table, guards, errors, capability gate, adding a protected route, hosting rewrite for deep links).
- **Reason:** Close the accessibility scope and the review gaps of tasks 1 to 4 so the router shell meets the issue acceptance criteria.
- **Next step:** Open the pull request to `develop`; issue #22 owns the Amplify SPA rewrite that deep links need.

## 2026-11-11 — Server-derived capability gating (#20, task 4)

- **Status:** in-progress
- **Area / files:** `src/features/classrooms/use-classroom-capabilities.ts`, `src/app/router/require-capability.tsx`, `src/api/query-keys.ts`, `src/app/messages.ts`, `src/test/msw/handlers.ts`, `src/app/router/fake-session.ts`
- **Change:** Added `useClassroomCapabilities(classroomId)`, a TanStack Query read of `GET /classrooms/{id}` through the session client that returns the role and capabilities the server granted (typed from the generated schema, keyed by user and classroom, nothing persisted), and the `RequireCapability` gate. The gate shows loading while pending, forbidden when the capability is missing or on 403, not found on 404 (so a foreign classroom looks like a missing one) and the generic error view for anything else; it never redirects to login.
- **Reason:** Role-based screens must follow what the server allows in the current classroom, never a role name or stored value in the client.
- **Next step:** Skip link, focus on navigation and document title per route (task 5).

## 2026-11-11 — Error boundaries and not-found/forbidden views (#20, task 3)

- **Status:** in-progress
- **Area / files:** `src/app/router/error-boundaries.tsx`, `src/app/router/route-errors.ts`, `src/app/router/routes.tsx`, `src/app/pages/not-found-page.tsx`, `src/app/pages/forbidden-page.tsx`, `src/app/messages.ts`
- **Change:** Added a root error boundary above the shell (minimal fallback with reload and home) and a per-page boundary inside the shell, so a page error or a failed lazy chunk keeps the banner, navigation and toast host. Route errors are classified (404 to not found, 403 to forbidden, stale chunk to reload, anything else to a generic error with retry); 401 is never handled there. Added notFound()/forbidden() throw helpers and a forbidden view. Error text, stack and server data are never rendered.
- **Reason:** One place decides how failures look, without login loops or leaked internals.
- **Next step:** Capability gating, skip link/focus/title (tasks 4-5).

## 2026-11-11 — Session guards for the router (#20, task 2)

- **Status:** in-progress
- **Area / files:** `src/app/router/guards.tsx`, `src/app/router/return-target.ts`, `src/app/router/routes.tsx`, `src/app/messages.ts`
- **Change:** Added `RequireAuth` (loading while the session initializes, redirect to `/login?next=` when signed out, retry state when it cannot be verified) on the protected branch, and `PublicOnly` on login, register and password reset. Invitation acceptance stays reachable signed in or out. The return target is built and read through `safeSessionRedirect`.
- **Reason:** One guard decides session access so screens never flash protected content or loop through login.
- **Next step:** Error boundaries and not-found/forbidden views, capability gating, skip link/focus/title (tasks 3-5).

## 2026-11-11 — React Router app shell (#20, task 1)

- **Status:** in-progress
- **Area / files:** `src/app/router/`, `src/app/pages/`, `src/app/messages.ts`, `src/main.tsx`, `e2e/`, `docs/development.md`, `docs/ui-showcase.md`, `package.json`
- **Change:** Added `react-router` 8.5.1 (exact pin) in data mode: a shared route table with lazy placeholder pages (login, register, password reset, invitation landing, protected home), a layout route on `BaseLayout` with `<Outlet />` and the toast host, a 404 catch-all, and the dev showcase moved to `/dev/ui`, registered only when `__UI_SHOWCASE__` is true. `main.tsx` renders `RouterProvider`; `App` was replaced by the route tests.
- **Reason:** Navigation foundation for every upcoming screen (FD4).
- **Next step:** Session guards, error boundaries, capability gating, skip link/focus/title (tasks 2-5).

## 2026-11-09 — Native Colyseus join credential (FD3) and realtime contract sync path

- **Status:** completed
- **Area / files:** `docs/technical-justification.md`, `rules/realtime-and-presence.md`, `scripts/api-sync/sync-contracts.mjs`, `src/api/sync-contracts.test.ts`, `README.md`, `docs/architecture.md`
- **Change:** FD3 now sends the access token as `client.auth.token` (SDK `Authorization: Bearer` header on matchmaking) instead of in the `join` options, which carry only `classroomId`. `pnpm api:sync` reads the room state from `packages/contracts/src/realtime/generated/ClassroomState.ts`, the path published by backend #24 (#71).
- **Reason:** Match the backend implementation of the Colyseus join gate (backend PR #77): framework-native auth path, same Bearer shape as REST, credentials kept out of room options and URLs.
- **Verification:** lint, typecheck, 147/147 unit tests, format check, docs check; a real sync against the backend #24 branch writes all three generated files with no warnings.
- **Next step:** After backend #77 merges, run `pnpm api:sync` and commit the generated types together with the Colyseus client dependency (`@colyseus/schema`).

## 2026-11-05 — Tactile design pass for the base UI components

- **Status:** completed
- **Area / files:** `src/styles/tokens.css`, `src/styles/index.css`, `src/components/ui/*`, `src/components/layout/`, `src/app/App.tsx`, `docs/ui-*.md`, `package.json`
- **Change:** Self-hosted Fredoka and Figtree fonts, tactile depth tokens (bevels, lavender ambient, inset wells), resin-key buttons, recessed inputs, tray tabs, pill badges with palette variants, tinted alerts with icon chip, clay table/dialog/sheet, shimmer skeleton and pill sidebar nav. Contrast pairs recorded in `docs/ui-foundations.md`.
- **Reason:** The components looked like stock shadcn; they now follow the painted-toy / soft-resin art direction.
- **Follow-up:** The toast now drops Sonner's stock styling for a clay panel with a display title, a per-type icon chip and an in-panel close key (`src/components/ui/toast.tsx`, `docs/ui-overlays.md`).
- **Verification:** lint, typecheck, 146/146 unit tests, build and 16/16 Playwright scenarios against the showcase preview; manual keyboard focus pass. Screenshots in `docs/assets/ui-foundations/`.
- **Next step:** Team review on PR #68.

## 2026-11-04 — Move frontend hosting to us-east-2 with keyless Amplify deploy (FD5 update)

- **Status:** completed
- **Area / files:** `docs/technical-justification.md` (FD5, D5/D6 impact), `docs/architecture.md`, `rules/deployment-and-operations.md`
- **Change:** Recorded the FD5 update: Amplify Hosting in `us-east-2` and deployment through the Amplify GitHub App connection instead of GitHub Actions OIDC, with no AWS credentials in GitHub. Mirrored the backend D5/D6 updates. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** The AWS account (new sign-up experience) assigns `us-east-2` and denies other Regions and the GitHub OIDC provider through AWS-managed policies (backend #16, PR #57); frontend issue #22 was updated accordingly.
- **Verification:** Amplify availability in `us-east-2` and the GitHub App connection checked in the AWS documentation on 2026-11-04; docs link check passed. Cost and Free Tier limits are not assessed.
- **Next step:** Provision Amplify Hosting under frontend issue #22.

## 2026-11-02 — Record multiple-choice quizzes and mention autocomplete source (FD12)

- **Status:** completed
- **Area / files:** `docs/technical-justification.md`, `docs/functional-requirements.md`, `rules/` (activities-and-grading, communication-and-notifications)
- **Change:** Recorded FD12: auto-graded multiple choice is MVP Core and rendered as a quiz or exam UI with server-provided results (never graded client-side); mention autocomplete consumes backend `GET /classrooms/:id/members`. Mirrored backend D11 and D12 and fixed the requirements wording on self-assessed quizzes. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** The requirements contradicted themselves on multiple-choice scope, and the chat composer needs a defined, minimal source for mention suggestions (frontend issue #51, backend issue #52).
- **Next step:** Build the quiz/exam interface and the mention autocomplete against the published contract and MSW handlers (FD9).

## 2026-11-02 — Record contract mocks, UI language and deadline time zone (FD9–FD11)

- **Status:** completed
- **Area / files:** `docs/technical-justification.md`, `docs/architecture.md`, `rules/` (api-contracts, quality-and-testing, frontend-conventions, data-and-time, deployment-and-operations)
- **Change:** Recorded FD9 (MSW handlers built from the published contract; dev and test only), FD10 (UI in Spanish `es-AR`, centralized strings, single locale), FD11 (deadlines shown in the school's IANA time zone with the zone indicated; server decides lateness in UTC) and mirrored backend D9 and D10. Fixed the Amplify `sa-east-1` wording to "verified" in the deployment rule. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** UI work must proceed before backend endpoints land, and the interface language and deadline time zone were undecided.
- **Next step:** Centralize strings and add MSW handlers when the application is scaffolded.

## 2026-11-02 — Record contract sync, 3D performance budget and verified hosting region

- **Status:** completed
- **Area / files:** `docs/technical-justification.md`, `docs/architecture.md`, `README.md`, `rules/` (api-contracts, realtime-and-presence, 3d-world-and-camera, art-direction, and the rules that listed realtime contract distribution as open)
- **Change:** Recorded FD7 (backend commits `openapi.json` and realtime type artifacts; `pnpm api:sync` pulls them and generated types are committed in `src/api/` and `src/realtime/`), FD8 (conservative 3D performance budget with an automatic offer of the 2D Classic Mode), and marked the Amplify availability in `sa-east-1` as verified (FD5). Closed the FD2 open sub-choice and the realtime type distribution items. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Contract changes must be visible in pull requests without a running backend, and school hardware needs measurable 3D limits.
- **Next step:** Implement `pnpm api:sync` and the runtime performance check when the application is scaffolded.

## 2026-11-02 — Record frontend decisions and sync with backend

- **Status:** completed
- **Area / files:** `README.md`, `master-document.md`, `docs/functional-requirements.md`, `docs/requirements-decision.md`, `docs/technical-justification.md`, `docs/architecture.md`, `rules/index.md`, `rules/README.md`, `rules/authentication-and-session.md`, `rules/api-contracts.md`, `rules/realtime-and-presence.md`, `rules/classrooms-and-roles.md`, `rules/security.md`, `rules/deployment-and-operations.md`, `AGENTS.md`
- **Change:** Removed leftover office-model wording; synced the shared requirements and master document with the backend; recorded backend decisions D1-D7 and new frontend decisions FD1-FD6 (token storage, API types, Colyseus join credential, router, hosting, repository layout); updated the affected rules (session, contracts, join credential, classroom join code, CSP); added the rule routing index and pointed agent instructions at it. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Keep the frontend documentation consistent with the approved backend decisions and make agents read only the rules relevant to a task.
- **Next step:** Verify Amplify Hosting availability in `sa-east-1`; decide whether generated API types are committed or generated in CI.

## 2026-10-30 — Realign frontend rules with the school niche

- **Status:** completed
- **Area / files:** `rules/classrooms-and-roles.md`, `rules/activities-and-grading.md`, `rules/communication-and-notifications.md`, `rules/points-and-shop.md`, `rules/live-classroom-tools.md`, `rules/ai-bot-and-daily-briefing.md`, `rules/realtime-and-presence.md`, `rules/3d-world-and-camera.md`, `rules/movement-and-interactions.md`, `rules/avatars-and-customization.md`, `rules/art-direction.md`, `rules/ui-and-accessibility.md`, `rules/state-management.md`, `rules/README.md`, `master-document.md` (section 13)
- **Change:** Renamed the rooms, tasks, and meetings rules to classrooms-and-roles, activities-and-grading, and communication-and-notifications and rewrote them for the interface of the school model (role-specific UI, 2D/3D mode, parent area, review and grading, chat moderation and mute, announcements, in-app notifications). Added points-and-shop and live-classroom-tools. Updated the other rules to the classroom scene, keeping the classroom pet and the AI bot separate. Updated the rules index and master section 13. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Align the frontend rules with master document v0.3 and the already realigned backend rules.
- **Next step:** Realign `docs/` (functional requirements, user stories, requirements decision, technical justification, architecture) with the school model.

## 2026-10-30 — Rewrite master document for the school niche

- **Status:** completed
- **Area / files:** `master-document.md`
- **Change:** Rewrote the product scope for schools (teachers, students, parents, school owner/admin): organization paths, roles, activities and grades, points and shop, classroom controls, 2D classic mode, RAG-based AI bot, MVP split into core and extended, updated R1-R8 checks, and version 0.3. Removed offices/rooms, Kanban, generic tasks, and meetings. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** The team narrowed the product to an education niche; the master document must match before the data model and rules are derived from it.
- **Next step:** Realign the `rules/` files with the new scope (classrooms and roles, activities and grading, points and shop, live classroom tools, notifications, data, AI bot); decide the candidate technologies in `docs/technical-justification.md`.

## 2026-10-28 — Record Terraform decision in master document

- **Status:** completed
- **Area / files:** `master-document.md`
- **Change:** Added Terraform to the stack table and deployment section and listed the backend-owned infrastructure-as-code rule in section 13. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Keep the master document synchronized with the backend after adopting Terraform.
- **Next step:** None.

## 2026-10-27 — Confirm rendering technology and complete frontend rules

- **Status:** completed
- **Area / files:** `rules/`, `rules/3d-world-and-camera.md`, `docs/technical-justification.md`, `docs/ai-usage.md`, `docs/architecture.md`, `master-document.md`, `AGENTS.md`
- **Change:** Replaced "undecided rendering engine" wording with the agreed Three.js + React Three Fiber decision; added the 3D world and camera rule and the technical justification, AI usage declaration, and architecture docs; aligned the master document rule index with real filenames; required tracker updates in agent instructions. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Close the gaps between master document section 13 and the existing rules, and resolve the contradiction about the rendering technology.
- **Next step:** Team to fill the real cases in `docs/ai-usage.md`, then open a pull request to `develop`.
