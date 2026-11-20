import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { classroomMessages } from './messages';
import { usePerformanceOfferStore } from './performance-offer-store';

/**
 * Non-blocking offer to switch to 2D Classic Mode when the device cannot
 * sustain the 3D budget (issue #56, FD8). Rendered by the classroom
 * workspace only in 3D mode: `role="status"` announces it politely to
 * assistive technology, and it never steals focus or blocks interaction
 * (`rules/ui-and-accessibility.md`).
 *
 * Accepting calls the HU-ESP-003 mode action chosen by the host; declining
 * dismisses the offer for the rest of the session. The app never switches
 * modes by itself.
 */
export function PerformanceOfferBanner({
  onAccept,
}: {
  readonly onAccept: () => void;
}) {
  const status = usePerformanceOfferStore((state) => state.status);
  const accept = usePerformanceOfferStore((state) => state.accept);
  const decline = usePerformanceOfferStore((state) => state.decline);

  if (status !== 'offering') {
    return null;
  }

  const messages = classroomMessages.performanceOffer;

  const handleAccept = () => {
    accept();
    onAccept();
  };

  return (
    <Alert
      variant="info"
      role="status"
      aria-live="polite"
      data-testid="performance-offer"
    >
      <AlertTitle as="h3">{messages.title}</AlertTitle>
      <AlertDescription>
        {messages.body}
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button type="button" size="sm" onClick={handleAccept}>
            {messages.accept}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={decline}>
            {messages.decline}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
