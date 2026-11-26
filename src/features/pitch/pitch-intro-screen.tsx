import { useEffect, useRef, type CSSProperties } from 'react';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import bankitoLogoUrl from './assets/bankito-logo.jpg';
import { pitchMessages as copy } from './messages';

function delay(ms: number): CSSProperties {
  return { '--pitch-delay': `${ms}ms` } as CSSProperties;
}

export interface PitchIntroScreenProps {
  readonly onStart: () => void;
}

/**
 * Branded entry screen shown before the Meet simulation. Brief by design:
 * Bankito emblem, title, one-line hook, highlights and a single start action.
 */
export function PitchIntroScreen({ onStart }: PitchIntroScreenProps) {
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    startRef.current?.focus();
  }, []);

  return (
    <main className="pitch-keynote-root flex h-screen w-screen items-center justify-center overflow-hidden bg-[#181622] p-2 sm:p-4">
      <div className="pitch-intro-stage relative flex aspect-video max-h-full w-full max-w-[177.78vh] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-[#524B63] bg-[#15131E] px-6 text-center text-[#FFF9EB] shadow-float">
        <div
          aria-hidden="true"
          className="pitch-intro-glow pointer-events-none absolute inset-0"
        />
        <div className="pitch-anim-pop relative z-10 size-40 overflow-hidden rounded-[2rem] border-2 border-[#E9C99B]/60 bg-[#F5EDE1] shadow-[0_24px_56px_-16px_rgba(247,216,107,0.34)] sm:size-48">
          <img
            src={bankitoLogoUrl}
            alt={copy.intro.logoAlt}
            className="h-full w-full scale-[1.18] object-cover"
          />
        </div>
        <h1
          className="pitch-anim-up relative z-10 font-display text-4xl font-bold tracking-tight sm:text-6xl"
          style={delay(90)}
        >
          {copy.intro.title}
        </h1>
        <p
          className="pitch-anim-up relative z-10 max-w-lg text-base font-medium text-[#FFF9EB]/85 sm:text-lg"
          style={delay(160)}
        >
          {copy.intro.tagline}
        </p>
        <div
          style={delay(220)}
          className="pitch-anim-up relative z-10 flex flex-wrap items-center justify-center gap-2"
        >
          {copy.intro.highlights.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#524B63] bg-[#231E29]/90 px-3.5 py-1 font-display text-xs font-semibold text-[#FFF9EB]"
            >
              {item}
            </span>
          ))}
        </div>
        <button
          ref={startRef}
          type="button"
          onClick={onStart}
          className={cn(
            buttonStyles({ variant: 'default', size: 'lg' }),
            'pitch-anim-pop relative z-10 mt-2',
          )}
          style={delay(280)}
        >
          {copy.intro.start}
        </button>
      </div>
    </main>
  );
}
