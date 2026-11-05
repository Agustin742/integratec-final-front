# Tabs and transient notifications

Use local Radix UI 1.8.1 tabs for associated panels and Sonner 2.0.8 for transient
feedback. Import from each lowercase module in `src/components/ui/`; there is no
barrel. Both require the application [semantic tokens](ui-foundations.md) and
global styles, not routing, persistence or backend integration. Intrinsic Spanish
notification and dismiss labels come from `ui-messages.ts`, introduced with
[dialogs and sheets](ui-dialogs.md).

## Quick path

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Toast, toast } from '../components/ui/toast';

// messages is the consuming feature's centralized es-AR catalog.
<Tabs defaultValue="detail">
  <TabsList aria-label={messages.activitySections}>
    <TabsTrigger value="detail">{messages.details}</TabsTrigger>
    <TabsTrigger value="history">{messages.history}</TabsTrigger>
  </TabsList>
  <TabsContent value="detail">{messages.instructions}</TabsContent>
  <TabsContent value="history">{messages.noChangesYet}</TabsContent>
</Tabs>

<Toast /> // Mount once in the application shell, outside modal content.
toast.success(messages.changesSaved); // Call from an event or completed operation.
```

## API and consumer responsibilities

Tabs preserve Radix `value`/`onValueChange`, `orientation`, `activationMode`,
disabled triggers, roving focus and panel associations. Label every tab list.
Automatic activation is the default; use manual activation for expensive panels.
The active trigger is signalled by surface, weight and an underline in addition to
colour, so the selected state survives greyscale and colour-vision differences.

`Toast` wraps the Sonner toaster; `toast` is its native notification API, including
`error`, `loading`, `promise`, and `dismiss(id)`. Feature messages and action
labels remain centralized consumer content in es-AR. The polite notification
region and dismiss label are centralized Spanish; Alt+T is Sonner's default focus
shortcut.

Feedback uses popover/foreground tokens, with primary and secondary token pairs
for actions rather than light text over bright accents. Rich colors and dark
mode are intentionally not exposed. Overrides and per-toast options can change
appearance; consumers must recheck any altered contrast. Toasts supplement,
not replace, persistent field errors or essential recovery instructions.

## Verification and limits

The colocated `tabs-toast.test.tsx` covers arrow navigation, disabled skipping,
panel associations and controlled/manual activation. Toast tests cover polite
live-region markup, consumer content, localized keyboard-focusable dismissal and
success/error variants. These are component checks, not speech-output or
screen-reader interoperability proof.

jsdom does not emulate a browser's complete input pipeline or prove visual layout.
Browser keyboard/touch, mobile/desktop overflow and visual token contrast
integration remain parent checks. Sonner motion inherits the global reduced-motion
rule. Data fetching, validation, empty and loading states belong to consuming
features, not these containers. See
[UI accessibility rules](../rules/ui-and-accessibility.md) and
[verification policy](../rules/quality-and-testing.md).
