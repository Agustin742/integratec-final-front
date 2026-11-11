# Local UI foundations showcase

The app shell composes [BaseLayout](ui-layout.md) and, in the `/dev/ui` route, renders
`UiFoundations` to make the accepted warm component set inspectable. The IntegrarTec
name is a single `h1` in the banner and page titles are `h2` in main, so the app name
is not duplicated and the existing smoke contract still reads a level-one heading. The
`/dev/ui` route is registered only when `__UI_SHOWCASE__` is true (see
[the showcase gate](ui-foundations.md#showcase-gate)): the dev server and
`pnpm build:e2e` include it, a production build does not. This is a local
component demonstration, not a classroom flow or a completed business action.

## Inspect the examples

1. Follow the sidebar anchor to the component section or use the first keyboard
   skip link to focus main.
2. Inspect the loading, empty, success, validation and error examples.
3. Switch tabs using arrows; open a Dialog or Sheet, then close with Escape.
4. Trigger the local notification; it explicitly says no data was saved.

All visible copy comes from the grouped es-AR `messages.showcase` catalog in
`src/app/messages.ts`; layout and intrinsic control copy retain their separate
catalogs. Code, tests and this documentation stay English.

## Composition and state ownership

| Area         | Usage                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading      | Busy `Button` with `aria-busy`/`aria-disabled` that ignores clicks yet keeps keyboard focus, plus decorative `Skeleton`.                                                |
| Success      | Textual `Badge` identifying component readiness as an example, not a saved operation.                                                                                   |
| Empty        | Captioned `Table` with a named keyboard-focusable overflow region and explicit empty row.                                                                               |
| Validation   | `Field` render-prop attributes spread directly onto editable `Input`; associated fixed illustrative error and help. Typing does not submit or clear that demonstration. |
| Error        | Destructive `Alert` with explanatory copy and a real available next action: continue trying other examples. No fake retry.                                              |
| Overlays     | Named and described local modal `Dialog` and `Sheet`; Radix owns containment, background isolation and restoration.                                                     |
| Tabs / toast | Named tab list; notification invoked only by a button event. Exactly one `Toast` mounts in App outside modals.                                                          |

No fetch, storage, server state, router, guards, 3D or dark mode is introduced.
Input state stays in the native input; tabs and modals use the existing primitives'
local state. Long labels wrap, containers can shrink, and surfaces use semantic
color pairs instead of new palette values. Existing token contrast tests remain
the source of numeric pair evidence; no new visual contrast measurement is claimed.

Component contracts: [controls](ui-controls.md), [feedback and tables](ui-display.md),
[dialogs and sheets](ui-dialogs.md), [tabs and notifications](ui-overlays.md).

## Verification and remaining proof

- `src/app/router/routes.test.tsx` renders the shared route table in a memory router
  and protects the banner heading, page headings inside the shell, one notification
  region, axe, the skip link and the document title on every page, the `/dev/ui`
  showcase route (including a sidebar click that navigates client-side) and its
  absence when the gate is off. Focus after navigation is covered in
  `app-shell.test.tsx`; see [routing](routing.md).
- `ui-foundations.test.tsx` checks the five labeled states, validation associations
  and editable text, table semantics, keyboard tab selection, modal descriptions,
  background removal from accessible queries and focus restoration.
- `e2e/ui-foundations.spec.ts` checks 360px/1280px fit and long-text wrapping,
  real keyboard skip focus, dialog Tab boundaries, Escape/restoration and Sheet
  interaction. Additional cases exercise 200% CSS zoom, coordinate clicks on
  background actions behind both modals, 360px touch-equivalent modal/notice
  interaction, and the reduced-motion preference for animation and scrolling. It
  runs against the `showcase` build and leaves `e2e/smoke.spec.ts` on the production
  contract.

## Observed integration evidence

The writer passed 45/45 component tests, lint, typecheck and build; the parent
spot check also passed 45/45 tests. Chrome DevTools against the production preview
at 360px confirmed no page overflow, a visible 3px focus outline on the keyboard
skip link, activation focusing main, Dialog/Sheet containment and Escape focus
restoration, keyboard tab selection and background pointer hit-test isolation.
The modal widths were 328px (Dialog) and 324px (Sheet), within the 360px viewport.
Computed foreground/background colors matched the tested semantic tokens;
reduced-motion preference was active. This is not a full accessibility audit.

### Earlier failed attempts and corrected prerequisite

The default Playwright preview launcher failed before tests because Node was
given a Windows `pnpm.exe`. Using the supported `PLAYWRIGHT_BASE_URL` with the
already-running local preview bypassed that launcher, but all eight scenarios
then failed at browser startup because the matching Chromium executable was
absent. Those attempts supplied no application proof. Subsequently, Alejo
explicitly authorized the Chromium download into
the default user-local Playwright cache (`%LOCALAPPDATA%/ms-playwright`); the parent reported installation
exit 0 before the run below. No additional download or cache maintenance was run
by this verification unit. The launcher/configuration was not modified.

Chrome screenshot capture and subsequent desktop emulation each timed out.
Neither tool was retried. The successful Playwright run below supplies rendered
browser evidence instead; it does not retroactively turn those attempts into passes.

### Completed rendered-browser checks

Against the parent's current built preview (`03a53d9`) at
`http://127.0.0.1:4180`, the full Playwright suite passed **14/14**, no skips or
retries, in **11.3s** (one worker, desktop and mobile Chromium projects):

| Scope                           | Observed proof                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S4 layout / S6 widths           | Both 360px and 1280px cases passed page-width assertions before and after replacing rendered banner text with 30 repetitions of an unbroken string. Landmarks, original heading/bootstrap text and table region remained visible.                                                                                                                  |
| S6 focus / background isolation | Keyboard skip activation, dialog forward/reverse Tab containment, Escape focus restoration, keyboard tab selection and Sheet restoration passed. Physical mouse clicks at the rendered background notice button, outside each modal's bounds, dismissed the backdrop without triggering a notice; clicking the notice action after closing worked. |
| S6 zoom                         | At 1280px with `html.style.zoom = '2'`, page width fit, input editing and validation visibility, fully in-viewport Dialog, close-button activation and trigger focus restoration passed. This is **200% CSS zoom**, not browser UI zoom.                                                                                                           |
| S6 touch / notice               | A touch-enabled 360px context tapped the tab, opened and closed Dialog and Sheet with their close buttons, restored trigger focus, then showed and dismissed the exact local-only notice. Both project runs passed. This is emulated touch, not a physical-device test.                                                                            |

This is verification of already implemented behavior: there was no meaningful
pre-implementation behavioral RED and no product source change. All new checks
passed on their first run; no assertion or application correction was needed.
The earlier 45/45 component tests supply the five-state and semantic coverage;
they were not rerun for this test/docs-only unit. S4 token numeric contrast and
component inventory evidence remain in the linked component guides, not newly
measured by this browser run.

### Exact verification commands

All commands below exited **0**, with no stderr diagnostic. The user-specific
browser cache path is shown through `LOCALAPPDATA` instead of a private absolute
path (Git Bash syntax). Command output was
captured in the agent execution transcript; no separate stdout/stderr log file
was created. Playwright's configured ignored result metadata is at
`e2e/test-results/.last-run.json`; there are no failure artifact paths from this
passing run.

```sh
PLAYWRIGHT_BROWSERS_PATH="$LOCALAPPDATA/ms-playwright" PLAYWRIGHT_BASE_URL=http://127.0.0.1:4180 pnpm --config.use-node-version=22.23.4 e2e
pnpm --config.use-node-version=22.23.4 exec eslint e2e/ui-foundations.spec.ts
pnpm --config.use-node-version=22.23.4 typecheck
pnpm --config.use-node-version=22.23.4 exec prettier --check e2e/ui-foundations.spec.ts docs/ui-showcase.md docs/ui-layout.md
```

E2E stdout: `14 passed (11.3s)`; ESLint produced no output; typecheck invoked
`tsc --noEmit` with no diagnostics; Prettier reported all matched files formatted.
Changed-document relative links were also checked locally. No unit suite or build
was rerun because product code was unchanged.

### Remaining limits

No screenshots, browser UI zoom, physical touch hardware, full accessibility
audit or remote-deployment proof is claimed. Long-text stress targets the banner,
not every possible consumer payload. Automated Chromium desktop checks replace
missing functional desktop proof, not visual design approval. This bounded writer
is not a replacement independent verifier and does not close review or tracker
lifecycle. That run preceded develop integration. The later, separately authorized
integration checks are recorded below.

## Develop integration evidence

The local merge combines UI candidate `b4deb9b` with develop `5a6ee7b`
(PR #65 public configuration and PR #66 contract sync). Four conflicts were
reconciled by preserving both parents: manifest scripts/dependencies, exact lock
blocks, startup validation plus stylesheet, and Vite validation/React/Tailwind/alias.
No package versions were upgraded. Frozen installation added the incoming pinned
`zod` and `openapi-typescript`; an initial offline attempt reported a missing cache
tarball. Before installation, missing `zod` prevented typecheck/build/test collection;
those failed attempts are not counted as passes.

After installation, lint, typecheck, **83/83 unit/component tests** and build exited 0. Build used only CI's safe public placeholders: `VITE_APP_ENV=test`,
`VITE_API_BASE_URL=https://api.example.invalid` and
`VITE_REALTIME_URL=wss://realtime.example.invalid`. No backend connectivity is claimed.
The new production preview then passed the same **14/14 browser scenarios** in
**8.9s**, with no retries or skipped cases, through the supported preview-URL command.

Global formatting and documentation checks (58 files) passed. Six incoming files
initially failed formatting only because of checkout CRLF; their local line endings
were normalized after proving equality with the merged index. This added no authored
changes to those incoming files and did not change Git configuration.
No additional review agent, dependency upgrade, remote contract sync, push or PR
was run for this integration. The screenshot/device/audit limits above still apply.

### Independent integration verification

The four reconciled files were verified in an isolated tree rather than in place.
`git archive --format=tar -o` wrote the 94 MB candidate tree to disk (an earlier
in-memory pipe had exceeded a subprocess's 32 MiB buffer), the archive was extracted
outside the repository, and `pnpm install --frozen-lockfile --offline` ran on Node
22.23.4 with pnpm 10.34.9 without changing any resolution. The isolated copy then
passed, once each: lint, typecheck, build (exit 0) and the full unit/component
suite (11 files, **83/83 tests**).

The candidate was also compared against both parents of `c6d2d1e`:

- `package.json`: exact superset — nine scripts, nine dependencies and 23
  devDependencies; no key lost from either parent and no conflicting value.
- `pnpm-lock.yaml`: exact union — 498 packages and 513 snapshots; none missing from
  either parent, no merged-only entry and no conflicting specifier.
- `src/main.tsx`: both parents' startup behavior — public-config validation and the
  stylesheet/StrictMode entry point.
- `vite.config.ts`: both parents' configuration — public-config validation plus
  React, Tailwind and the `@` alias.

This check ran in a separate isolated snapshot, not in the conflict writer's working
tree. No code change resulted from it.

## Review follow-up on PR #68

The review asked for the showcase to be kept out of the delivered bundle, the
reduced-motion behavior to be proven in a browser, the contrast numbers to be
recorded and weak pairs enforced, one focus-ring definition, a non-colour active
tab, the unused icon dependency removed, and a set of component nits fixed. The
delivered behavior is described in [the foundations guide](ui-foundations.md),
[controls](ui-controls.md), [feedback](ui-display.md),
[dialogs](ui-dialogs.md), [tabs and notifications](ui-overlays.md) and
[layout](ui-layout.md).

Checks on the current candidate, once each:

| Check            | Observed result                                                                     |
| ---------------- | ----------------------------------------------------------------------------------- |
| `pnpm lint`      | exit 0, no output                                                                   |
| `pnpm typecheck` | exit 0, no diagnostics                                                              |
| `pnpm test`      | 11 files, **91/91** tests passed                                                    |
| `pnpm build`     | `index-*.js` 366.31 kB; **no** `ui-foundations-*.js` chunk, showcase marker count 0 |
| `pnpm build:e2e` | emits `ui-foundations-*.js` 64.37 kB; showcase marker count 1                       |
| Playwright suite | **16/16** passed, desktop and mobile projects, no retries or skips                  |

The Playwright run used `pnpm build:e2e` followed by
`pnpm exec playwright test` against a preview started with
`node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort`
and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173`. The bundled `pnpm e2e` script
performs the same two steps; it was split here because this environment's Node
version does not satisfy the manifest engine range.

### Environment deviation

These checks ran on Node **v24.15.0** with pnpm 10.34.9, not the declared
`>=22.23.4 <23`. The repository sets `engine-strict=true`, so pnpm was invoked with
`--config.engine-strict=false`; the nested `pnpm build:e2e` inside `pnpm e2e`
therefore refuses to run under this Node. No dependency version was changed and the
lockfile was not resolved against a different Node. The declared Node 22 toolchain
is the supported one; this run is evidence of behavior, not a claim that Node 24 is
supported.

### Remaining limits

No screenshots are committed by this work; the author attaches them in the pull
request because the API cannot upload images. Browser UI zoom, physical touch
hardware, a full accessibility audit, screen-reader interoperability and remote
deployment are still not claimed. The 200% check uses CSS `zoom`. The size
exception for this branch needs maintainer approval in the pull request thread; it
is not self-approved here.
