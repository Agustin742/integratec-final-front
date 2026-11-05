# UI feedback and tables

Use these local primitives for feedback, decorative loading placeholders and
semantic tables. They reuse the warm [foundation tokens](ui-foundations.md) and
`cn`/CVA helpers. Import named exports directly from lowercase files in
`src/components/ui/`; there is no barrel. Native props, including React 19 refs,
are passed through. Callers supply centralized es-AR content; these components do
not fabricate messages or data. For form interactions, see [UI controls](ui-controls.md).

## Display and tables

- `Alert`, `AlertTitle`, `AlertDescription`: default polite `status`; destructive
  variant defaults to urgent `alert`. Override `role` for static content or other
  announcement needs. Title uses `h2`; place it in a suitable heading hierarchy.
  Supply actionable failure text; do not duplicate the same live announcement.
- `Badge` (`BadgeProps`): non-interactive span with `default`, `secondary`,
  `destructive`, or `outline` variant. Communicate state in text, not color alone.
- `Skeleton`: decorative, `aria-hidden`, caller-sized using `className`; pulse is
  motion-safe only. Put loading copy and `aria-busy` on the containing view rather
  than announcing each placeholder. Never put focusable content inside it.
- `Table` (`TableProps`): native table inside a keyboard-focusable horizontal
  overflow region. Required `containerLabel` names that region; name the table
  separately with `TableCaption` or `aria-label`. The surrounding flex/grid layout
  must allow shrinking (`min-w-0`). `className` styles the table, not its container.
  Exports: `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`,
  `TableCell`, `TableCaption`. `TableHead` defaults to `scope="col"`; use
  `scope="row"` for row headers. Native props support `colSpan` and complex header
  associations. Loading, empty, error and data rows are caller-owned; no data
  fetching, sorting or pagination is included.

## Verification boundary

The colocated `display.test.tsx` exercises status/error announcements, explicit
roles, non-interactive badges, decorative loading, table captions/headers, empty
rows and axe checks (excluding contrast in jsdom). Focusing the overflow region
and checking its classes do not prove actual scrolling or viewport fit.

Existing global focus and reduced-motion styles remain unchanged. Semantic color
pairs reuse the tested foundation tokens; this is not a new visual contrast
measurement. Browser keyboard access, actual overflow at 360px/desktop, contrast on
rendered backgrounds, layout integration, full regression checks and build remain
parent integration checks. See [UI accessibility](../rules/ui-and-accessibility.md)
and [quality requirements](../rules/quality-and-testing.md).
