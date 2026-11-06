# Warm, accessible UI foundations

Reuse the shared UI components and semantic tokens for application panels. The warm direction follows [art direction](../rules/art-direction.md) and [UI accessibility](../rules/ui-and-accessibility.md); it does not change the 3D world, introduce dark mode, or implement routing.

## Quick path

1. Use Node 22.23.4 and pnpm 10.34.9; install with `pnpm install --frozen-lockfile`.
2. Import components from `src/components/ui/` and use semantic classes such as `bg-card`, `text-foreground` and `rounded-lg`, rather than repeating palette values.
3. Run `pnpm dev` to inspect the application; run the checks in [testing](./testing.md) before delivery.

## Tailwind and shadcn setup

Tailwind CSS v4 runs through `@tailwindcss/vite`. `src/main.tsx` imports `src/styles/index.css`, which imports Tailwind with source scanning limited to `src/`, followed by `tokens.css`. No Tailwind v3 configuration or remote font is needed; the two variable fonts are bundled from `@fontsource-variable/*` packages. The `@/` alias resolves to `src/` in Vite, TypeScript and Vitest; application modules import through it instead of climbing with `../`, except tests that must reach a repository script outside `src/`. `components.json` declares the repo-owned shadcn/ui component locations (Radix/new-york conventions).

## Showcase gate

The component showcase in `src/app/ui-foundations.tsx` is a development aid, not product surface. `vite.config.ts` replaces the `__UI_SHOWCASE__` constant at build time: `true` for the dev server and for `vite build --mode showcase`, `false` for every other build. A production build therefore resolves the constant to `false` and drops the lazy showcase chunk entirely, while `pnpm build:e2e` produces the showcase bundle the browser suite exercises. `src/vite-env.d.ts` declares the constant so feature code never reads `import.meta.env` directly.

The component source is maintained in this repository, not consumed as an opaque UI package. Radix supplies accessible interaction primitives; class-variance-authority, clsx and tailwind-merge support styles. Sonner supplies transient announcements. See [shadcn manual installation](https://ui.shadcn.com/docs/installation/manual) and [Vite installation](https://ui.shadcn.com/docs/installation/vite). Review any future registry update before replacing local behavior or centralized Spanish strings.

## Tokens and contrast

`src/styles/tokens.css` contains the palette, semantic foreground/background pairs, typography, spacing, radius and lavender-tinted panel shadow. Semantic colors may be darker than palette accents to make text readable; bright coral, teal and butter are not automatically safe with light text.

| Role            | Tokens / decision                                                    |
| --------------- | -------------------------------------------------------------------- |
| Warm surfaces   | Cream background, pale cream card/popover, sand secondary            |
| Text            | Dark ink foreground; dark muted text on pale cream                   |
| Primary         | Dark green `#28603B`, pale cream text                                |
| Error           | Dark coral `#A33630`, pale cream text; always pair color with text   |
| Accent          | Teal background with dark ink, not white text                        |
| Focus           | Dark green ring; 3px outline with 3px offset                         |
| Type            | Self-hosted Fredoka (display) and Figtree (body); see Tactile design |
| Shape / spacing | Base radius 0.75rem; spacing unit 0.25rem                            |

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

## Tactile design: resin keys and clay panels

The base components follow the "painted toy / soft resin / clean clay" direction of [art direction](../rules/art-direction.md): matte warm surfaces, broad corners, discreet sand borders and lavender-tinted shadows. Everything stays inside the palette and the semantic tokens; no black shadows and no zero-offset glow.

**Fonts** (self-hosted, no CDN): `--font-display` = `'Fredoka Variable'` (Tailwind `font-display`; headings, button labels, badges, tab triggers, dialog/sheet titles, table headers, nav pills) and `--font-body` = `'Figtree Variable'`. Headings use `text-wrap: balance` and letter-spacing of at most -0.01em. Scale: body 1rem, title 1.375rem (`h2`), heading clamp(1.75rem, 4vw, 2.5rem) (`h1`); display weight 600, wordmark 700.

**Depth tokens** (`tokens.css`):

| Token                                      | Value                                                     | Use                          |
| ------------------------------------------ | --------------------------------------------------------- | ---------------------------- |
| `--shadow-ambient` / `--panel-shadow`      | `0 8px 20px -6px #b5a7d655`                               | cards, panels, table, header |
| `--shadow-float`                           | `0 18px 40px -12px #b5a7d699, 0 6px 14px -6px #af7b5233`  | dialog, sheet, toast         |
| `--shadow-inset` / `--shadow-inset-deep`   | `inset 0 2px 4px #af7b5233` / `inset 0 3px 6px #af7b5240` | input wells, tab tray        |
| `--shadow-raised`                          | `0 2px 0 #dcbf8e, 0 6px 10px -4px #b5a7d666`              | active tab, current nav pill |
| `--key-primary/secondary/destructive/sand` | `#173a24` / `#b98a5a` / `#6e211d` / `#d4b17c`             | hard 3px bevel under a key   |
| `--key-shadow-ambient`                     | `0 8px 14px -8px #b5a7d6aa`                               | lavender shadow under keys   |

Surface tokens: `--edge #e8d3ac` (default 1px border, replaces wood on panels), `--tray #efd9b4`, `--tray-hover #f6e7c8`, `--field-border #a9835f`. Semantic tints (surface / ink / bevel): success `#e0f1cc`/`#24542f`/`#b9d996`, info `#d8f3f0`/`#1d5a58`/`#a0dbd5`, warning `#fdf0bd`/`#5e4a0a`/`#e8cb62`, danger `#fde3dc`/`#8a2a25`/`#f0aa9f`. Text is darkened rather than the surface.

`key-bevel` (resting bevel) and `motion-press` (hover lift 1px, press travel 2px with the bevel shrinking 3px to 1px and scale .98) work together; disabled keys are flat with no press, busy keys keep the bevel without motion. `prefers-reduced-motion` removes scale and travel; the bevel change remains as the pressed cue.

Contrast measured for the new pairs (`tokens.test.ts` enforces them):

| Pair                                                       | Ratio                     | Requirement |
| ---------------------------------------------------------- | ------------------------- | ----------- |
| Muted text on tab tray `#efd9b4`                           | 5.85                      | AA text     |
| Muted text on tray hover `#f6e7c8`                         | 6.59                      | AA text     |
| Ink on tray hover                                          | 10.44                     | AA text     |
| Success ink on success tint                                | 7.39                      | AA text     |
| Info ink on info tint                                      | 6.78                      | AA text     |
| Warning ink on warning tint                                | 7.47                      | AA text     |
| Danger ink on danger tint                                  | 7.05                      | AA text     |
| Pale cream glyph on danger / success / info / warning chip | 8.20 / 8.39 / 7.53 / 8.13 | AA text     |
| Field border `#a9835f` on cream / pale cream               | 3.07 / 3.28               | non-text    |

The field border is wood-light but kept at 3:1 so the input boundary stays identifiable; a sand-only border would measure about 1.4:1. The previous `--border` and `--input` tokens are unchanged.
