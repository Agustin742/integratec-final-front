# Local UI foundations showcase

The current `App` composes [BaseLayout](ui-layout.md) with `UiFoundations` to make
the accepted warm component set inspectable. The original IntegrarTec heading and
bootstrap text remain in main, preserving the existing smoke contract. This is a
local component demonstration, not a classroom flow or a completed business action.

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
| Loading      | Disabled busy `Button`, containing `aria-busy` and decorative `Skeleton`.                                                                                               |
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

- `App.test.tsx` protects the prior heading/text and checks integrated landmarks,
  showcase anchor, one notification region and axe semantics (not contrast).
- `ui-foundations.test.tsx` checks the five labeled states, validation associations
  and editable text, table semantics, keyboard tab selection, modal descriptions,
  background removal from accessible queries and focus restoration.
- `e2e/ui-foundations.spec.ts` checks 360px/1280px fit and long-text wrapping,
  real keyboard skip focus, dialog Tab boundaries, Escape/restoration and Sheet
  interaction. Additional cases exercise 200% CSS zoom, coordinate clicks on
  background actions behind both modals, and 360px touch-equivalent modal/notice
  interaction. It uses the existing Playwright configuration and leaves
  `e2e/smoke.spec.ts` unchanged.

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
lifecycle. The parent owns final T4 disposition and must rerun affected checks
after any separately authorized develop integration; none was performed here.
