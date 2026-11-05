# Reusable application layout

`BaseLayout` provides the shared header, main landmark, optional named sidebar and
keyboard skip link. It reuses the accepted warm [foundation tokens](ui-foundations.md)
without routing, guards, theme configuration or feature dependencies.

## Quick path

Import `BaseLayout` from `src/components/layout/base-layout.tsx` and supply the
page heading either in the banner or in its children, never both. Mount one layout
per application shell.

```tsx
// messages is the consuming feature's centralized es-AR catalog.
// The delivered app keeps the single h1 in the banner, so main does not repeat it.
<BaseLayout
  header={<h1 className="font-semibold">{messages.title}</h1>}
  sidebar={<a href="#examples">{messages.examples}</a>}
  sidebarLabel={messages.navigation}
>
  <section id="examples">{messages.content}</section>
</BaseLayout>
```

## Contract

| Prop                    | Responsibility                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `header: ReactNode`     | Required content of the semantic banner; not another header landmark.                     |
| `children: ReactNode`   | Main content; consumer owns its heading hierarchy and must not repeat the banner heading. |
| `sidebar?: ReactNode`   | Optional complementary landmark; absent/null/false omits it.                              |
| `sidebarLabel?: string` | Contextual accessible name; defaults to the centralized es-AR layout label.               |
| `mainId?: string`       | Unique caller-owned skip destination; otherwise generated with React `useId`.             |
| `className?: string`    | Root extension merged with `cn`; consumer must recheck overrides.                         |

The skip link is the first control. It is visually hidden until focused, then
fixed above the content with the primary token pair. Activating it focuses main
(`tabIndex={-1}`), not just its fragment. Main remains outside the normal Tab order.
Global focus and reduced-motion styles remain unchanged.

The sidebar stacks above main on narrow screens and sits alongside it at the
large breakpoint. Shrinkable grid tracks, `min-w-0` and inherited anywhere-wrapping
handle long consumer text without concealing horizontal overflow. Consumers still
own media sizing and any intentional scroll regions, such as the local `Table`.
A permanent sidebar is not a modal [Sheet](ui-dialogs.md).

## Verification boundary

`base-layout.test.tsx` checks landmarks, omission/default/custom sidebar naming,
custom skip targets, first-control ordering, activation focus and axe semantics
(excluding contrast). These jsdom checks do not prove visual skip-link appearance,
physical Tab traversal, actual viewport fit or rendered contrast.

Integration scenarios live in `e2e/ui-foundations.spec.ts` alongside the
showcase slice. The full suite passed 16/16 against the showcase build:
360px/1280px fit, unbroken banner text, keyboard focus, physical background
pointer blocking, touch-equivalent modal/notice interaction, 200% CSS zoom and the
reduced-motion preference. CSS zoom is not browser UI zoom; emulated taps are not
physical-device proof.
See [observed integration evidence](ui-showcase.md#observed-integration-evidence)
for exact commands, earlier failed attempts and remaining limits. These are
rendered Chromium checks, not claims made by component tests or visual approval.
See [UI accessibility](../rules/ui-and-accessibility.md).
