import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { classroomMessages } from './messages';
import { usePerformanceOfferStore } from './performance-offer-store';

/**
 * Non-blocking offer to switch to 2D Classic Mode when the device cannot
 * sustain the 3D budget (issue #56, FD8). Rendered by the classroom
 * workspace only in 3D mode: `Alert` announces it politely as a status, and
 * it never steals focus or blocks interaction (`rules/ui-and-accessibility.md`).
 *
 * Accepting calls the HU-ESP-003 mode action chosen by the host; declining
 * dismisses the offer for the rest of the session and lets the host restore
 * focus (the decline button unmounts). The app never switches modes by
 * itself.
 */
export function PerformanceOfferBanner({
  onAccept,
  onDecline,
}: {
  readonly onAccept: () => void;
  readonly onDecline?: () => void;
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

  const handleDecline = () => {
    decline();
    onDecline?.();
  };

  return (
    <Alert variant="info" data-testid="performance-offer">
      <AlertTitle as="h3">{messages.title}</AlertTitle>
      <AlertDescription>
        {messages.body}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleAccept}
          >
            {messages.accept}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleDecline}
          >
            {messages.decline}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
