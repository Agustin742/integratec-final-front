import { useEffect, useState } from 'react';

/** Time on each body animation of a preview show. */
export const PREVIEW_STEP_MS = 3500;

/**
 * Steps through a preview show while the page is visible; stays on the first
 * step, with no timer, when not running (reduced motion). Free of Three.js.
 */
export function useShowStep(running: boolean): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!document.hidden) setStep((current) => current + 1);
    }, PREVIEW_STEP_MS);
    return () => clearInterval(timer);
  }, [running]);
  return running ? step : 0;
}
