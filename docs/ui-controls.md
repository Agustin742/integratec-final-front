# UI controls

Use `Button`, `Input`, `Label` and `Field` for native form interactions with the
warm [foundation tokens](ui-foundations.md). Import named exports directly from
lowercase files in `src/components/ui/`; there is no barrel. Native props,
including React 19 refs, are passed through. These components contain no built-in
UI copy: callers provide centralized es-AR labels, descriptions, errors and content.

## Interactive controls

- `Button` (`ButtonProps`): native button, default `type="button"`. Set
  `type="submit"` explicitly in forms. Variants: `default`, `secondary`, `outline`,
  `ghost`, `destructive`, `link`; sizes: `default`, `sm`, `lg`, `icon`.
  `busy` displays a decorative spinner, sets `aria-busy`, and disables activation;
  retain an accessible name and supply visible pending copy. `disabled` also uses
  native semantics. Icon-only buttons require a caller-provided accessible name.
- `Input` (`InputProps`): native input, default text type; supports controlled and
  uncontrolled values, validation attributes, disabled state, and refs.
- `Label` (`LabelProps`): Radix label; connect standalone controls with `htmlFor`.
- `Field` (`FieldProps`, `FieldControlProps`): layout and accessible associations,
  not a form framework. Its render function supplies props that **must be spread
  onto the actual input**, not onto a wrapper. `id` is the input ID; otherwise a
  stable React ID is generated. `description` and `error` get corresponding IDs;
  errors set `aria-invalid` and are announced. `describedBy` includes additional
  caller-owned help IDs. An absent/empty error clears the invalid state without
  changing the input value. Caller IDs must be unique. Required indicators and
  native `required` remain the caller's responsibility.

```tsx
// Import these components from their individual files; messages is caller-owned.
<Field label={messages.name} description={messages.nameHelp} error={nameError}>
  {(controlProps) => (
    <Input {...controlProps} required value={name} onChange={handleNameChange} />
  )}
</Field>
<Button type="submit" busy={saving}>
  {saving ? messages.saving : messages.save}
</Button>
```

## Verification boundary

The colocated `controls.test.tsx` exercises public semantics, pending/disabled
transitions, form activation, label/help/error associations, independent IDs,
refs and axe checks (excluding contrast in jsdom). Existing global focus and
reduced-motion styles remain unchanged. Semantic color pairs reuse the tested
foundation tokens; this is not a new visual contrast measurement.

Browser keyboard activation, contrast on rendered backgrounds, layout integration,
360px/desktop overflow, full regression checks and build remain parent integration
checks, not proven by these jsdom tests. See
[UI accessibility](../rules/ui-and-accessibility.md) and
[quality requirements](../rules/quality-and-testing.md).
