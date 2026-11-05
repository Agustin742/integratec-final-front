# Modal dialogs and sheets

Use these local Radix UI 1.8.1 primitives for modal panels. Import from each
lowercase module in `src/components/ui/`; there is no barrel. They require the
application [semantic tokens](ui-foundations.md) and global styles, but no sibling
controls, routing, persistence or backend integration.

## Quick path

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';

// messages is the consuming feature's centralized es-AR catalog.
<Dialog>
  <DialogTrigger asChild>
    <button type="button">{messages.openDetails}</button>
  </DialogTrigger>
  <DialogContent>
    <DialogTitle>{messages.activityDetails}</DialogTitle>
    <DialogDescription>{messages.reviewInstructions}</DialogDescription>
    <p>{messages.activityContent}</p>
  </DialogContent>
</Dialog>;
```

Feature labels belong in the consumer's Spanish message catalog. Intrinsic close
labels live in `ui-messages.ts`, which also owns notification labels for subsequent
consumers; that catalog has no dependency on those components.

## API and focus ownership

`Dialog` supports Radix controlled `open`/`onOpenChange` and uncontrolled
`defaultOpen`; it always enables modal behavior. `DialogTrigger` and
`DialogClose` support `asChild`. `DialogContent` owns the portal, backdrop and
localized close button. Supply a title and description using their semantic
components. If no description applies, explicitly pass
`aria-describedby={undefined}` to content. Content is a styled container, not
an `asChild` slot; use its children for controls and body content.

`sheet.tsx` exports `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`,
`SheetTitle`, and `SheetDescription` with the same contract. Replace the Dialog
names in the example and optionally pass `side="left"` to `SheetContent`;
default is right. Sheets are modal panels, not permanent navigation sidebars.
Both bodies scroll within the viewport; long consumer content must wrap.

Radix owns initial focus, trapping, Escape, outside dismissal, background
isolation, and focus restoration. Do not suppress its focus callbacks unless a
feature intentionally supplies and tests an equivalent accessible destination.
Both close buttons are 44px square native controls, independent of the controls
module, so they meet the minimum touch target in both modals.

## Verification and limits

The colocated `overlays.test.tsx` covers Dialog and Sheet names/descriptions,
initial and trapped focus, boundary Tab loops, close/Escape, trigger restoration
and background removal from accessible queries. It inspects public accessibility
and pointer-lock output rather than Radix private component state.

jsdom does not prove physical pointer blocking, browser Tab traversal, visual
layout, speech output or screen-reader interoperability. Tests dispatch boundary
keys and programmatic focus, not a browser's complete input pipeline. Browser
keyboard/touch, mobile/desktop overflow and rendered contrast remain parent
integration checks; these tests alone do not close the dialog acceptance criterion.
No new overlay animations are added. Data fetching, validation, empty and loading
states belong to consumers, not these containers. See
[UI accessibility rules](../rules/ui-and-accessibility.md) and
[verification policy](../rules/quality-and-testing.md).
