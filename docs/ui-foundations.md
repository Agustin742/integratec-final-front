# Warm, accessible UI foundations

Reuse the shared UI components and semantic tokens for application panels. The warm direction follows [art direction](../rules/art-direction.md) and [UI accessibility](../rules/ui-and-accessibility.md); it does not change the 3D world, introduce dark mode, or implement routing.

## Quick path

1. Use Node 22.23.4 and pnpm 10.34.9; install with `pnpm install --frozen-lockfile`.
2. Import components from `src/components/ui/` and use semantic classes such as `bg-card`, `text-foreground` and `rounded-lg`, rather than repeating palette values.
3. Run `pnpm dev` to inspect the application; run the checks in [testing](./testing.md) before delivery.

## Tailwind and shadcn setup

Tailwind CSS v4 runs through `@tailwindcss/vite`. `src/main.tsx` imports `src/styles/index.css`, which imports Tailwind with source scanning limited to `src/`, followed by `tokens.css`. No Tailwind v3 configuration or remote font is needed. The `@/` alias resolves to `src/` in Vite and TypeScript. `components.json` declares the repo-owned shadcn/ui component locations (Radix/new-york conventions).

The component source is maintained in this repository, not consumed as an opaque UI package. Radix supplies accessible interaction primitives; class-variance-authority, clsx and tailwind-merge support styles. Sonner supplies transient announcements. See [shadcn manual installation](https://ui.shadcn.com/docs/installation/manual) and [Vite installation](https://ui.shadcn.com/docs/installation/vite). Review any future registry update before replacing local behavior or centralized Spanish strings.

## Tokens and contrast

`src/styles/tokens.css` contains the palette, semantic foreground/background pairs, typography, spacing, radius and lavender-tinted panel shadow. Semantic colors may be darker than palette accents to make text readable; bright coral, teal and butter are not automatically safe with light text.

| Role            | Tokens / decision                                                      |
| --------------- | ---------------------------------------------------------------------- |
| Warm surfaces   | Cream background, pale cream card/popover, sand secondary              |
| Text            | Dark ink foreground; dark muted text on pale cream                     |
| Primary         | Dark green `#28603B`, pale cream text                                  |
| Error           | Dark coral `#A33630`, pale cream text; always pair color with text     |
| Accent          | Teal background with dark ink, not white text                          |
| Focus           | Dark green ring; 3px outline with 3px offset                           |
| Type            | Local system font stack; body 1rem, small 0.875rem, responsive heading |
| Shape / spacing | Base radius 0.75rem; spacing unit 0.25rem                              |

`src/styles/tokens.test.ts` checks eight text pairs at WCAG AA normal-text contrast (at least 4.5:1), plus focus against cream and pale cream (at least 3:1). These checks validate configured colors, not arbitrary future combinations, transparent overlays, or all rendered content. Browser verification must also inspect actual controls.

`src/styles/index.css` defines visible keyboard focus and respects `prefers-reduced-motion` by reducing nonessential animations/transitions and disabling smooth scrolling. Do not use color or motion as the only indication of a state.

## Verification status

The token setup, local component set, BaseLayout and explicitly local showcase are implemented. Usage: [controls](ui-controls.md), [feedback and tables](ui-display.md), [dialogs and sheets](ui-dialogs.md), [tabs and notifications](ui-overlays.md), [layout](ui-layout.md), and [showcase evidence](ui-showcase.md#observed-integration-evidence).

Component tests passed 45/45; lint, typecheck and build passed before develop integration. Chrome DevTools supplied 360px keyboard/focus/overflow proof. After the explicitly authorized Chromium installation, all 14 Playwright scenarios passed against the production preview: 360px/1280px fit, long banner text, 200% CSS zoom, keyboard focus, background pointer isolation and emulated touch/notice dismissal.

Earlier failed browser launches and timed-out Chrome captures/desktop emulation remain disclosed in the showcase evidence. The supported explicit preview URL bypasses the unchanged Windows auto-launcher limitation; the default launcher is not claimed fixed. Screenshots, native browser UI zoom, physical-device testing and a full accessibility audit are not claimed. Native assessment requested no additional review for the assessed UI work units; this is not native approval or merge readiness.

The subsequent local integration of develop (PR #65 public configuration and PR #66 contract sync) preserves Tailwind, semantic styles and the incoming validated configuration boundary. The integrated candidate passed 83 unit/component tests, lint, typecheck, build and 14 browser scenarios using safe CI public endpoints, not live backend services. Follow the [current configuration prerequisites](development.md) before starting/building; see [integration evidence](ui-showcase.md#develop-integration-evidence). No push, pull request or shared-branch merge is claimed.
