import { useEffect, useState } from 'react';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { pitchMessages as copy } from './messages';
import { PITCH_LAUNCH_LOADING_MS } from './pitch-config';

export interface PitchLaunchScreenProps {
  readonly onComplete: () => void;
}

/**
 * Rapid classroom loading screen shown after clicking or advancing on the
 * final slide (`4.2`), right before opening `PITCH_LIVE_DEPLOY_URL`.
 */
export function PitchLaunchScreen({ onComplete }: PitchLaunchScreenProps) {
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    const midTimer = window.setTimeout(() => setProgress(72), 260);
    const fullTimer = window.setTimeout(() => setProgress(100), 620);
    const doneTimer = window.setTimeout(() => {
      onComplete();
    }, PITCH_LAUNCH_LOADING_MS);

    return () => {
      window.clearTimeout(midTimer);
      window.clearTimeout(fullTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <main className="pitch-keynote-root flex h-screen w-screen items-center justify-center overflow-hidden bg-[#181622] p-2 sm:p-4">
      <div
        role="status"
        aria-live="polite"
        className="pitch-stage-enter relative flex aspect-video max-h-full w-full max-w-[177.78vh] flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border-2 border-border bg-card px-6 text-center text-foreground shadow-float"
      >
        <div
          aria-hidden="true"
          className="pitch-warm-grid-bg pointer-events-none absolute inset-0 opacity-75"
        />

        <span className="pitch-anim-pop relative z-10 rounded-full border-2 border-[#D5B54B] bg-[#F7D86B] px-4 py-1 font-display text-xs font-bold text-foreground shadow-panel sm:text-sm">
          {copy.launch.eyebrow}
        </span>

        <h1 className="pitch-anim-up relative z-10 font-display text-3xl font-bold sm:text-5xl">
          {copy.launch.title}
        </h1>

        <p className="pitch-anim-up relative z-10 max-w-lg text-sm font-medium text-muted-foreground sm:text-base">
          {copy.launch.subtitle}
        </p>

        {/* Rapid progress bar */}
        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-full border-2 border-border bg-background p-1 shadow-panel">
          <div
            className="h-3.5 rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ul className="relative z-10 flex flex-wrap items-center justify-center gap-2.5">
          {copy.launch.steps.map((step) => (
            <li
              key={step}
              className="rounded-xl border border-edge bg-background/90 px-3 py-1.5 font-display text-xs font-bold text-foreground shadow-panel"
            >
              {step}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onComplete}
          className={cn(
            buttonStyles({ variant: 'default', size: 'lg' }),
            'relative z-10 mt-1',
          )}
        >
          {copy.launch.openNow}
        </button>
      </div>
    </main>
  );
}
