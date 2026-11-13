import { PlaceholderPage, type PlaceholderPageProps } from './placeholder-page';

/**
 * Placeholder for the signed-out screens: the page copy plus a ghost of the
 * form that will take its place (two fields and a button), so the column
 * already has its final shape. Purely visual and hidden from assistive tech.
 */
export function AuthPlaceholderPage(props: PlaceholderPageProps) {
  return (
    <PlaceholderPage {...props}>
      <div aria-hidden="true" className="space-y-4 pt-3">
        <div className="h-11 rounded-xl border-2 border-dashed border-edge bg-background" />
        <div className="h-11 rounded-xl border-2 border-dashed border-edge bg-background" />
        <div className="h-11 rounded-xl bg-tray" />
      </div>
    </PlaceholderPage>
  );
}
