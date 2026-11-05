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

Implementation and integration checks are in progress. Passing token tests are not a completed accessibility audit. Component interaction, responsive browser evidence, full checks and native review outcomes will be recorded before completion.
