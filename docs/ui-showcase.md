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
- `e2e/ui-foundations.spec.ts` adds 360px/1280px fit and long-text checks, real
  keyboard skip focus, dialog Tab boundaries/background pointer-lock output,
  Escape/restoration, Sheet and notification interaction. It uses the existing
  Playwright configuration and leaves `e2e/smoke.spec.ts` unchanged.

## Observed integration evidence

The writer passed 45/45 component tests, lint, typecheck and build; the parent
spot check also passed 45/45 tests. Chrome DevTools against the production preview
at 360px confirmed no page overflow, a visible 3px focus outline on the keyboard
skip link, activation focusing main, Dialog/Sheet containment and Escape focus
restoration, keyboard tab selection and background pointer hit-test isolation.
The modal widths were 328px (Dialog) and 324px (Sheet), within the 360px viewport.
Computed foreground/background colors matched the tested semantic tokens;
reduced-motion preference was active. This is not a full accessibility audit.

Verification remains **partial**. The default Playwright preview launcher failed
before tests because Node was given a Windows `pnpm.exe`. Using the supported
`PLAYWRIGHT_BASE_URL` with the already-running local preview bypassed that
launcher, but all eight scenarios failed at browser startup because the matching
Playwright Chromium executable was absent. No application scenario passed in
Playwright. No browser download or repeated run followed that missing prerequisite.

Chrome screenshot capture timed out; a subsequent desktop emulation request also
timed out. Desktop, zoom, long-content stress, screenshots and the remaining
notification/touch checks are therefore unverified, not passed. Browser-tool
availability and Playwright setup require resolution before final acceptance.
The parent must also rerun affected checks after any separately authorized develop
integration; this change was implemented without that integration.
