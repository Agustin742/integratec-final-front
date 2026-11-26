import { useEffect, useRef, type CSSProperties } from 'react';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { pitchMessages as copy } from './messages';

function delay(ms: number): CSSProperties {
  return { '--pitch-delay': `${ms}ms` } as CSSProperties;
}

export interface PitchIntroScreenProps {
  readonly onStart: () => void;
}

/** Simple animated classroom emblem: board, desks and a rising star. */
function ClassroomEmblem() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 150"
      className="pitch-intro-emblem h-36 w-56 sm:h-44 sm:w-72"
    >
      <rect x="20" y="128" width="200" height="8" rx="4" fill="#AF7B52" />
      <rect
        x="62"
        y="18"
        width="116"
        height="62"
        rx="8"
        fill="#28603B"
        stroke="#F4E6D2"
        strokeWidth="5"
      />
      <path
        d="M80 42h44M80 56h70"
        stroke="#FFF9EB"
        strokeWidth="4"
        strokeLinecap="round"
        className="pitch-intro-chalk"
      />
      <g className="pitch-intro-desk" style={{ animationDelay: '120ms' }}>
        <rect x="38" y="100" width="44" height="10" rx="3" fill="#F7D86B" />
        <rect x="44" y="110" width="5" height="18" fill="#AF7B52" />
        <rect x="71" y="110" width="5" height="18" fill="#AF7B52" />
      </g>
      <g className="pitch-intro-desk" style={{ animationDelay: '240ms' }}>
        <rect x="98" y="100" width="44" height="10" rx="3" fill="#62CFC7" />
        <rect x="104" y="110" width="5" height="18" fill="#AF7B52" />
        <rect x="131" y="110" width="5" height="18" fill="#AF7B52" />
      </g>
      <g className="pitch-intro-desk" style={{ animationDelay: '360ms' }}>
        <rect x="158" y="100" width="44" height="10" rx="3" fill="#F5B5AB" />
        <rect x="164" y="110" width="5" height="18" fill="#AF7B52" />
        <rect x="191" y="110" width="5" height="18" fill="#AF7B52" />
      </g>
      <path
        className="pitch-intro-star"
        d="M200 14l4.5 9.2 10.1 1.5-7.3 7.1 1.7 10.1-9-4.8-9 4.8 1.7-10.1-7.3-7.1 10.1-1.5z"
        fill="#F7D86B"
        stroke="#D5B54B"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * Branded entry screen shown before the Meet simulation. Brief by design:
 * product name, one-line hook, an emblem and a single start action.
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
        <ClassroomEmblem />
        <p className="pitch-anim-up font-display text-xs font-bold tracking-[0.2em] text-[#F7D86B] uppercase sm:text-sm">
          {copy.intro.eyebrow}
        </p>
        <h1
          className="pitch-anim-up font-display text-4xl font-bold sm:text-6xl"
          style={delay(90)}
        >
          {copy.intro.title}
        </h1>
        <p
          className="pitch-anim-up max-w-lg text-base font-medium text-[#FFF9EB]/85 sm:text-lg"
          style={delay(160)}
        >
          {copy.intro.tagline}
        </p>
        <div
          style={delay(220)}
          className="pitch-anim-up flex flex-wrap items-center justify-center gap-2"
        >
          {copy.intro.highlights.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#524B63] bg-[#231E29]/90 px-3 py-1 font-display text-xs font-semibold text-[#FFF9EB]"
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
            'pitch-anim-pop mt-2',
          )}
          style={delay(280)}
        >
          {copy.intro.start}
        </button>
      </div>
    </main>
  );
}
