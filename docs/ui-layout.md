# Reusable application layout

`BaseLayout` provides the shared header, main landmark, optional named sidebar and
keyboard skip link. It reuses the accepted warm [foundation tokens](ui-foundations.md)
without routing, guards, theme configuration or feature dependencies.

## Quick path

Import `BaseLayout` from `src/components/layout/base-layout.tsx` and supply the
page heading inside its children. Mount one layout per application shell.

```tsx
// messages is the consuming feature's centralized es-AR catalog.
<BaseLayout
  header={<p>{messages.title}</p>}
  sidebar={<a href="#examples">{messages.examples}</a>}
  sidebarLabel={messages.navigation}
>
  <h1>{messages.title}</h1>
  <section id="examples">{messages.content}</section>
</BaseLayout>
```

## Contract

| Prop                    | Responsibility                                                                |
| ----------------------- | ----------------------------------------------------------------------------- |
| `header: ReactNode`     | Required content of the semantic banner; not another header landmark.         |
| `children: ReactNode`   | Main content; consumer owns its heading hierarchy.                            |
| `sidebar?: ReactNode`   | Optional complementary landmark; absent/null/false omits it.                  |
| `sidebarLabel?: string` | Contextual accessible name; defaults to the centralized es-AR layout label.   |
| `mainId?: string`       | Unique caller-owned skip destination; otherwise generated with React `useId`. |
| `className?: string`    | Root extension merged with `cn`; consumer must recheck overrides.             |

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
subsequent showcase slice. They target 360px/desktop overflow, long text and
keyboard focus. Browser execution, zoom and visual inspection remain
parent-owned acceptance evidence, not claimed by component tests.
See [UI accessibility](../rules/ui-and-accessibility.md).
