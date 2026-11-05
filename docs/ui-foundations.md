# Warm, accessible UI foundations

Reuse the shared UI components and semantic tokens for application panels. The warm direction follows [art direction](../rules/art-direction.md) and [UI accessibility](../rules/ui-and-accessibility.md); it does not change the 3D world, introduce dark mode, or implement routing.

## Quick path

1. Use Node 22.23.4 and pnpm 10.34.9; install with `pnpm install --frozen-lockfile`.
2. Import components from `src/components/ui/` and use semantic classes such as `bg-card`, `text-foreground` and `rounded-lg`, rather than repeating palette values.
3. Run `pnpm dev` to inspect the application; run the checks in [testing](./testing.md) before delivery.

## Tailwind and shadcn setup

Tailwind CSS v4 runs through `@tailwindcss/vite`. `src/main.tsx` imports `src/styles/index.css`, which imports Tailwind with source scanning limited to `src/`, followed by `tokens.css`. No Tailwind v3 configuration or remote font is needed. The `@/` alias resolves to `src/` in Vite, TypeScript and Vitest; application modules import through it instead of climbing with `../`, except tests that must reach a repository script outside `src/`. `components.json` declares the repo-owned shadcn/ui component locations (Radix/new-york conventions).

## Showcase gate

The component showcase in `src/app/ui-foundations.tsx` is a development aid, not product surface. `vite.config.ts` replaces the `__UI_SHOWCASE__` constant at build time: `true` for the dev server and for `vite build --mode showcase`, `false` for every other build. A production build therefore resolves the constant to `false` and drops the lazy showcase chunk entirely, while `pnpm build:e2e` produces the showcase bundle the browser suite exercises. `src/vite-env.d.ts` declares the constant so feature code never reads `import.meta.env` directly.

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

`src/styles/tokens.test.ts` enforces nine text pairs at WCAG AA normal-text contrast (at least 4.5:1), four non-text pairs at 3:1, and the focus ring against cream, pale cream and sand at 3:1. Measured ratios in the delivered palette:

| Pair                                                  | Ratio | Requirement |
| ----------------------------------------------------- | ----- | ----------- |
| Ink on cream (`foreground`/`background`)              | 11.36 | AA text     |
| Ink on pale cream (`card-foreground`/`card`)          | 12.15 | AA text     |
| Pale cream on primary green                           | 7.08  | AA text     |
| Ink on sand (`secondary-foreground`/`secondary`)      | 8.07  | AA text     |
| Muted text on pale cream (`muted-foreground`/`muted`) | 7.68  | AA text     |
| Muted text on sand (`muted-foreground`/`secondary`)   | 5.10  | AA text     |
| Ink on teal accent (`accent-foreground`/`accent`)     | 6.84  | AA text     |
| Pale cream on destructive coral                       | 6.40  | AA text     |
| Wood border on cream                                  | 3.24  | non-text    |
| Wood border on pale cream                             | 3.46  | non-text    |
| Input outline on cream                                | 4.93  | non-text    |
| Input outline on pale cream                           | 5.27  | non-text    |
| Focus ring on cream                                   | 6.62  | non-text    |
| Focus ring on sand                                    | 4.70  | non-text    |

`--muted-foreground` is `#5c4b59`: the previous tone reached only 4.43:1 on sand secondary, below AA for body text, so it was darkened rather than restricted. The checks validate configured colors, not arbitrary future combinations, transparent overlays, or all rendered content. Browser verification must also inspect actual controls.

`src/styles/index.css` is the single source of the visible keyboard focus ring: a 3px outline with a 3px offset on the ring token. Components do not redeclare outline width or offset. The stylesheet respects `prefers-reduced-motion` by reducing nonessential animations/transitions and disabling smooth scrolling. Do not use color or motion as the only indication of a state.

## Verification status

The token setup, local component set, BaseLayout and explicitly local showcase are implemented. Usage: [controls](ui-controls.md), [feedback and tables](ui-display.md), [dialogs and sheets](ui-dialogs.md), [tabs and notifications](ui-overlays.md), [layout](ui-layout.md), and [showcase evidence](ui-showcase.md#observed-integration-evidence).

Component tests passed 45/45; lint, typecheck and build passed before develop integration. Chrome DevTools supplied 360px keyboard/focus/overflow proof. After the explicitly authorized Chromium installation, all 14 Playwright scenarios passed against the production preview: 360px/1280px fit, long banner text, 200% CSS zoom, keyboard focus, background pointer isolation and emulated touch/notice dismissal.

Earlier failed browser launches and timed-out Chrome captures/desktop emulation remain disclosed in the showcase evidence. The supported explicit preview URL bypasses the unchanged Windows auto-launcher limitation; the default launcher is not claimed fixed. Screenshots, native browser UI zoom, physical-device testing and a full accessibility audit are not claimed. Native assessment requested no additional review for the assessed UI work units; this is not native approval or merge readiness.

The subsequent local integration of develop (PR #65 public configuration and PR #66 contract sync) preserves Tailwind, semantic styles and the incoming validated configuration boundary. The integrated candidate passed 83 unit/component tests, lint, typecheck, build and 14 browser scenarios using safe CI public endpoints, not live backend services. Follow the [current configuration prerequisites](development.md) before starting/building; see [integration evidence](ui-showcase.md#develop-integration-evidence). The result is proposed to `develop` in [PR #68](https://github.com/Agustin742/integratec-final-front/pull/68); no merge or deployment is claimed.

The review follow-up on PR #68 changed this state: the showcase is gated, `--muted-foreground` is darkened, focus and active-tab signals are unified, `lucide-react` is removed, and `AlertTitle` accepts a heading level. The candidate then passed **91/91** unit/component tests, lint, typecheck, a production build with no showcase chunk, and **16/16** browser scenarios. Exact evidence and remaining limits are in [the showcase guide](ui-showcase.md#review-follow-up-on-pr-68).
