import { useEffect, useState, type CSSProperties } from 'react';
import { buttonStyles } from '@/components/ui/button';
import type { Avatar } from '@/features/profile/avatar-options';
import { cn } from '@/lib/utils';
import { pitchMessages as copy } from './messages';
import {
  PITCH_AUTONOMY_SWATCHES,
  PITCH_FOCUS_SPECS,
  PITCH_SHOP_ITEMS,
  type PitchActorId,
  type PitchBeat,
  type PitchFocusKey,
  type PitchShopTryOnItem,
} from './pitch-script';

export interface PitchHudOverlaysProps {
  readonly beat: PitchBeat;
  readonly selectedShopId: PitchShopTryOnItem['id'];
  readonly onSelectShopId: (id: PitchShopTryOnItem['id']) => void;
  readonly selectedSwatchId: string;
  readonly onSelectSwatchId: (id: string) => void;
  readonly setBubbleRef: (
    actorId: PitchActorId,
    el: HTMLDivElement | null,
  ) => void;
  /** Currently focused prop in the automatic slide camera tour, if any. */
  readonly focusedKey?: PitchFocusKey | null;
  /** Triggers the rapid classroom loading screen before opening the live deploy. */
  readonly onLaunchDeploy?: () => void;
}

const ZONE_TONE_CLASSES = {
  teal: 'bg-[#62CFC7]/95 text-foreground border-[#3FAEA6]',
  butter: 'bg-[#F7D86B]/95 text-foreground border-[#D5B54B]',
  coral: 'bg-[#E66861]/95 text-foreground border-[#C34B44]',
  peach: 'bg-[#F5B5AB]/95 text-foreground border-[#D48D82]',
} as const;

const ACT_ORB_COLORS: Readonly<
  Record<PitchBeat['act'], readonly [string, string]>
> = {
  1: ['bg-[#75B7DA]/20', 'bg-[#B5A7D6]/20'],
  2: ['bg-[#62CFC7]/22', 'bg-[#F7D86B]/22'],
  3: ['bg-[#B5A7D6]/24', 'bg-[#E66861]/18'],
  4: ['bg-[#65B96A]/22', 'bg-[#F7D86B]/24'],
};

const ACTOR_SPEECH_META: Readonly<
  Record<
    PitchActorId,
    {
      readonly name: string;
      readonly badgeClass: string;
      readonly dotClass: string;
      readonly borderClass: string;
      readonly tailStroke: string;
      readonly defaultLeft: string;
      readonly defaultTop: string;
    }
  >
> = {
  sofia: {
    name: 'Sofía',
    badgeClass: 'bg-[#5B4F96] text-[#FFF9EB]',
    dotClass: 'bg-[#F7D86B]',
    borderClass: 'border-[#5B4F96]',
    tailStroke: '#5B4F96',
    defaultLeft: '50%',
    defaultTop: '30%',
  },
  lucas: {
    name: 'Lucas',
    badgeClass: 'bg-[#28603B] text-[#FFF9EB]',
    dotClass: 'bg-[#62CFC7]',
    borderClass: 'border-[#28603B]',
    tailStroke: '#28603B',
    defaultLeft: '24%',
    defaultTop: '35%',
  },
  mateo: {
    name: 'Mateo',
    badgeClass: 'bg-[#AF7B52] text-[#FFF9EB]',
    dotClass: 'bg-[#FFF0D8]',
    borderClass: 'border-[#AF7B52]',
    tailStroke: '#AF7B52',
    defaultLeft: '76%',
    defaultTop: '35%',
  },
  docente: {
    name: 'Docente',
    badgeClass: 'bg-[#382F3F] text-[#FFF9EB]',
    dotClass: 'bg-[#F5B5AB]',
    borderClass: 'border-[#382F3F]',
    tailStroke: '#382F3F',
    defaultLeft: '38%',
    defaultTop: '30%',
  },
};

const ACTOR_RENDER_ORDER: readonly PitchActorId[] = [
  'docente',
  'sofia',
  'lucas',
  'mateo',
];

function staggerStyle(delayMs: number): CSSProperties {
  return { '--pitch-delay': `${delayMs}ms` } as CSSProperties;
}

function MicOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0"
    >
      <path d="M9 5a3 3 0 0 1 6 0v5" />
      <path d="M5 10a7 7 0 0 0 11.9 5" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M12 3q1 4 4 6.5t3 5.5a7 7 0 1 1-14 0c0-2.2 1-4.2 2.6-5.7.3 1.7 1.3 2.7 2.4 3.2C10.5 9 11 5.5 12 3Z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function AnimatedScoreCounter() {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 680;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * 450));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <span>+{value} puntos</span>;
}

function MeetPersonSvg({
  role,
  phase,
}: {
  readonly role: 'hand' | 'phone' | 'bored' | 'teacher' | 'off';
  readonly phase: '1.0' | '1.1' | '1.2';
}) {
  if (role === 'hand') {
    const handUp = phase === '1.0';
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 160 112"
        className="h-24 w-32 shrink-0 sm:h-28 sm:w-36"
      >
        {/* Subtle room wall & shelf silhouette behind webcam */}
        <rect
          x="10"
          y="10"
          width="42"
          height="28"
          rx="4"
          fill="#221F30"
          opacity="0.7"
        />
        <rect
          x="112"
          y="22"
          width="36"
          height="4"
          rx="2"
          fill="#3E3954"
          opacity="0.75"
        />
        {/* Shoulders & sweater */}
        <path d="M28 112c2-22 18-34 44-34s42 12 44 34Z" fill="#5B4F96" />
        <path d="M62 78h20l-4 10h-12Z" fill="#463C78" />
        <rect x="65" y="64" width="14" height="16" rx="7" fill="#F8C6AF" />
        {/* Hair back */}
        <path
          d="M44 46c0-18 12-30 28-30s28 12 28 30v26c0 6-6 10-12 10H56c-6 0-12-4-12-10Z"
          fill="#6C4D48"
        />
        {/* Face */}
        <ellipse cx="72" cy="46" rx="20" ry="21" fill="#F8C6AF" />
        {/* Hair front sweep */}
        <path
          d="M50 42c2-15 13-22 24-22 10 0 18 5 20 15-8-5-16-6-26-4-7 2-13 6-18 11Z"
          fill="#573C38"
        />
        {/* Blush & features */}
        <ellipse
          cx="59"
          cy="51"
          rx="3.8"
          ry="2"
          fill="#EFA5AE"
          opacity="0.55"
        />
        <ellipse
          cx="85"
          cy="51"
          rx="3.8"
          ry="2"
          fill="#EFA5AE"
          opacity="0.55"
        />
        <circle cx="64" cy="46" r="2.3" fill="#382F3F" />
        <circle cx="80" cy="46" r="2.3" fill="#382F3F" />
        {handUp ? (
          <path
            d="M67 55q5 3.5 10 0"
            fill="none"
            stroke="#382F3F"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M67 57q5-2.5 10 0"
            fill="none"
            stroke="#382F3F"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}
        {handUp && (
          <g className="pitch-hand-wave">
            <path
              d="M114 96c2-16 4-28 4-38"
              fill="none"
              stroke="#5B4F96"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <rect
              x="111"
              y="34"
              width="13"
              height="20"
              rx="6.5"
              fill="#F8C6AF"
            />
            <circle cx="117.5" cy="31" r="7" fill="#F8C6AF" />
          </g>
        )}
      </svg>
    );
  }

  if (role === 'phone') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 160 112"
        className="h-24 w-32 shrink-0 sm:h-28 sm:w-36"
      >
        {/* Dark bedroom backdrop */}
        <rect
          x="14"
          y="16"
          width="36"
          height="50"
          rx="4"
          fill="#1E1B2B"
          opacity="0.8"
        />
        {/* Shoulders & hoodie */}
        <path d="M34 112c3-22 19-34 46-34s43 12 46 34Z" fill="#3E6E8E" />
        <rect x="73" y="65" width="14" height="15" rx="7" fill="#ECA786" />
        {/* Head tilted slightly down */}
        <ellipse cx="80" cy="48" rx="20" ry="20" fill="#ECA786" />
        <path
          d="M58 45c1-15 11-23 22-23s21 8 22 23c-7-5-14-7-22-7s-15 2-22 7Z"
          fill="#353849"
        />
        {/* Eyes looking down at phone */}
        <circle cx="72" cy="51" r="2.2" fill="#382F3F" />
        <circle cx="88" cy="51" r="2.2" fill="#382F3F" />
        <path
          d="M75 59h10"
          fill="none"
          stroke="#382F3F"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Cool screen glow on face */}
        <ellipse
          cx="80"
          cy="56"
          rx="14"
          ry="9"
          fill="#A9E7F4"
          opacity="0.16"
          className="pitch-phone-glow"
        />
        {/* Smartphone held up */}
        <rect
          x="68"
          y="72"
          width="24"
          height="34"
          rx="5"
          fill="#1A1724"
          stroke="#75B7DA"
          strokeWidth="2"
        />
        <rect
          x="72"
          y="76"
          width="16"
          height="24"
          rx="2.5"
          fill="#A9E7F4"
          className="pitch-phone-glow"
        />
      </svg>
    );
  }

  if (role === 'teacher') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 160 112"
        className="h-24 w-32 shrink-0 sm:h-28 sm:w-36"
      >
        {/* Subtle classroom board behind teacher */}
        <rect
          x="16"
          y="10"
          width="128"
          height="54"
          rx="6"
          fill="#1F3B36"
          stroke="#4E4863"
          strokeWidth="2"
          opacity="0.85"
        />
        <path
          d="M28 24h34M28 34h22M106 24h26"
          stroke="#A9E7F4"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.45"
        />
        {/* Shirt, collar & tie */}
        <path d="M34 112c3-22 19-34 46-34s43 12 46 34Z" fill="#F4E6D2" />
        <path d="M75 78h10l-2.5 22h-5Z" fill="#E66861" />
        <path
          d="M68 78l12 9 12-9"
          fill="none"
          stroke="#D7C3A5"
          strokeWidth="2.5"
        />
        <rect x="73" y="64" width="14" height="16" rx="7" fill="#CB8966" />
        {/* Head */}
        <ellipse cx="80" cy="44" rx="20" ry="21" fill="#CB8966" />
        <path
          d="M59 40c1-14 10-22 21-22s20 8 21 22c-7-5-14-7-21-7s-14 2-21 7Z"
          fill="#6C4D48"
        />
        {/* Glasses */}
        <circle
          cx="71"
          cy="45"
          r="6"
          fill="none"
          stroke="#382F3F"
          strokeWidth="2.2"
        />
        <circle
          cx="89"
          cy="45"
          r="6"
          fill="none"
          stroke="#382F3F"
          strokeWidth="2.2"
        />
        <line
          x1="77"
          y1="45"
          x2="83"
          y2="45"
          stroke="#382F3F"
          strokeWidth="2.2"
        />
        <circle cx="71" cy="45" r="1.9" fill="#382F3F" />
        <circle cx="89" cy="45" r="1.9" fill="#382F3F" />
        <ellipse cx="80" cy="56" rx="4.5" ry="2.8" fill="#382F3F" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 112"
      className="h-24 w-32 shrink-0 sm:h-28 sm:w-36"
    >
      {/* Muted wall frame behind */}
      <rect
        x="110"
        y="14"
        width="34"
        height="26"
        rx="4"
        fill="#211E2F"
        opacity="0.75"
      />
      {/* Slouched hoodie */}
      <path d="M36 112c3-21 19-32 44-32s41 11 44 32Z" fill="#5D8A6B" />
      <rect x="73" y="66" width="14" height="16" rx="7" fill="#ECA786" />
      {/* Head */}
      <ellipse cx="80" cy="47" rx="20" ry="20" fill="#ECA786" />
      <path
        d="M59 42c1-14 10-21 21-21s20 7 21 21c-7-4-14-6-21-6s-14 2-21 6Z"
        fill="#AF6D63"
      />
      {/* Heavy-lidded weary eyes */}
      <path
        d="M68 47h7M85 47h7"
        stroke="#382F3F"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="71.5" cy="48.5" r="1.6" fill="#382F3F" />
      <circle cx="88.5" cy="48.5" r="1.6" fill="#382F3F" />
      <path
        d="M74 57q6-2 12 0"
        fill="none"
        stroke="#382F3F"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Hand supporting chin */}
      <ellipse cx="62" cy="70" rx="8" ry="6" fill="#ECA786" />
    </svg>
  );
}

function MeetCallDock({ className }: { readonly className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none flex items-center gap-2 rounded-full border border-[#343046] bg-[#181623]/95 px-3 py-1.5 shadow-float',
        className,
      )}
    >
      {/* Mic muted */}
      <span className="flex size-8 items-center justify-center rounded-full bg-[#3D242B] text-[#F5B5AB]">
        <MicOffIcon />
      </span>
      {/* Camera off */}
      <span className="flex size-8 items-center justify-center rounded-full bg-[#3D242B] text-[#F5B5AB]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
        >
          <path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
          <path d="m16 10 5-3v10l-5-3" />
          <path d="m2 2 20 20" />
        </svg>
      </span>
      {/* Raise hand */}
      <span className="flex size-8 items-center justify-center rounded-full bg-[#2A2639] text-[#D5CEE0]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
        >
          <path d="M18 11V6a2 2 0 0 0-4 0v5" />
          <path d="M14 10V4a2 2 0 0 0-4 0v6" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.7-2.4L3.4 16a2 2 0 0 1 2.9-2.8L8 15" />
        </svg>
      </span>
      {/* Hang up */}
      <span className="flex h-8 w-11 items-center justify-center rounded-full bg-[#A33630] text-[#FFF9EB]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
        >
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.92.35 1.88.58 2.86.69A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.09 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72c.11.98.34 1.94.69 2.86a2 2 0 0 1-.45 2.11L9.06 10.95" />
        </svg>
      </span>
    </div>
  );
}

function LivingAmbientBackdrop({ beat }: { readonly beat: PitchBeat }) {
  const isCold = beat.lighting === 'cold';
  const [orbA, orbB] = ACT_ORB_COLORS[beat.act];
  const hasOpticalDof =
    beat.sceneMode === 'station-focus' || beat.sceneMode === 'showcase-trio';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      <div
        className={cn(
          'absolute inset-0 opacity-70',
          isCold ? 'pitch-cold-grid-bg' : 'pitch-warm-grid-bg',
        )}
      />
      <div
        className={cn(
          'pitch-float-slow absolute -top-20 -left-16 size-72 rounded-full blur-3xl',
          orbA,
        )}
      />
      <div
        className={cn(
          'pitch-float-reverse absolute -right-16 -bottom-20 size-80 rounded-full blur-3xl',
          orbB,
        )}
      />
      {hasOpticalDof && <div className="pitch-dof-vignette absolute inset-0" />}
      {beat.id === '1.3' && (
        <div className="pitch-anim-pop absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(247,216,107,0.28),transparent_62%)]" />
      )}
    </div>
  );
}

function MeetGridOverlay({ beat }: { readonly beat: PitchBeat }) {
  if (beat.act !== 1) return null;

  const isBroken = beat.gridState === 'broken';
  const phase: '1.0' | '1.1' | '1.2' =
    beat.id === '1.1' ? '1.1' : beat.id === '1.2' ? '1.2' : '1.0';

  return (
    <div
      aria-hidden={isBroken}
      className={cn(
        'pointer-events-none absolute inset-0 z-10 flex flex-col bg-[#14121D]',
        isBroken && 'pitch-grid-shatter',
      )}
    >
      {/* Sleek top meeting status bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[#2B273B] bg-[#191624]/95 px-4 py-2 text-xs">
        <div className="flex items-center gap-2.5 text-[#FFF9EB]">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-[#E66861]/85"
          />
          <span className="font-display font-bold tracking-tight">
            {copy.meetChrome.meetingTitle}
          </span>
          <span className="text-[#9E97B0]">·</span>
          <span className="font-medium tabular-nums text-[#D5CEE0]">
            {copy.meetChrome.meetingTime}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {phase !== '1.0' && (
            <span className="hidden rounded-full border border-[#4B3A4B] bg-[#281F29] px-2.5 py-0.5 font-medium text-[#F5B5AB] sm:inline-flex">
              {phase === '1.2'
                ? copy.meetChrome.disconnectedNotice
                : copy.meetChrome.silenceNotice}
            </span>
          )}
          <span className="rounded-full border border-[#322E44] bg-[#221E30] px-2.5 py-0.5 font-medium text-[#D5CEE0]">
            {copy.meetChrome.participantsCount}
          </span>
        </div>
      </div>

      {/* 3x3 webcam tile matrix */}
      <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-2.5 p-3 pb-24">
        {copy.meetTiles.map((tile, index) => {
          const isTeacher = tile.role === 'teacher';
          const cameraOn =
            isTeacher ||
            (phase === '1.0' && tile.role !== 'off') ||
            (phase === '1.1' &&
              (tile.role === 'hand' || tile.role === 'phone'));

          let statusText: string = copy.meetStatuses.cameraOff;
          if (isTeacher) {
            statusText =
              phase === '1.0'
                ? copy.meetStatuses.cameraOn
                : copy.meetStatuses.teacherSpeaking;
          } else if (cameraOn) {
            if (tile.role === 'hand') {
              statusText =
                phase === '1.0'
                  ? copy.meetStatuses.handRaised
                  : copy.meetStatuses.cameraOn;
            } else if (tile.role === 'phone') {
              statusText = copy.meetStatuses.watchingPhone;
            } else {
              statusText = copy.meetStatuses.cameraOn;
            }
          } else if (phase === '1.2') {
            statusText =
              tile.role === 'phone'
                ? copy.meetStatuses.missingWork
                : index % 2 === 0
                  ? copy.meetStatuses.absent
                  : copy.meetStatuses.cameraOff;
          }

          const showHandBadge =
            tile.role === 'hand' && phase === '1.0' && cameraOn;

          return (
            <div
              key={tile.id}
              style={staggerStyle(index * 35)}
              className={cn(
                'pitch-anim-up relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 transition-colors duration-300',
                isTeacher
                  ? 'border-[#62CFC7]/80 bg-gradient-to-b from-[#25283C] to-[#1C1A2A] ring-1 ring-[#62CFC7]/30'
                  : cameraOn
                    ? 'border-[#48435C] bg-gradient-to-b from-[#2A263C] to-[#1F1C2D]'
                    : 'border-[#2A2638] bg-[#181522]',
              )}
            >
              {/* Top row: hand-raised badge or spacer + mic/voice indicator */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                {showHandBadge ? (
                  <span className="rounded-full bg-[#F7D86B] px-2.5 py-0.5 font-display text-[11px] font-bold text-[#382F3F] shadow-sm">
                    {statusText}
                  </span>
                ) : (
                  <span />
                )}

                {isTeacher ? (
                  <span
                    className="flex h-5 items-end gap-0.5 rounded-full bg-[#15131E]/75 px-2 py-1"
                    aria-hidden="true"
                  >
                    <span className="pitch-voice-bar h-2.5 w-1 rounded-full bg-[#62CFC7]" />
                    <span
                      style={staggerStyle(150)}
                      className="pitch-voice-bar h-3 w-1 rounded-full bg-[#62CFC7]"
                    />
                    <span
                      style={staggerStyle(300)}
                      className="pitch-voice-bar h-2 w-1 rounded-full bg-[#62CFC7]"
                    />
                  </span>
                ) : (
                  <span className="flex size-6 items-center justify-center rounded-full bg-[#15131E]/75 text-[#D5CEE0]">
                    <MicOffIcon />
                  </span>
                )}
              </div>

              {/* Center webcam portrait or camera-off initials */}
              <div className="flex flex-1 items-center justify-center">
                {cameraOn ? (
                  <MeetPersonSvg role={tile.role} phase={phase} />
                ) : (
                  <div className="flex size-14 items-center justify-center rounded-full border border-[#3B364D] bg-[#242033] font-display text-sm font-bold text-[#D5CEE0] ring-4 ring-[#1D1A29]">
                    {tile.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Bottom row: clean translucent nameplate + muted status */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="truncate rounded-lg bg-[#15131E]/80 px-2 py-0.5 text-xs font-semibold text-[#FFF9EB]">
                  {tile.name}
                </span>
                {!showHandBadge && (
                  <span
                    className={cn(
                      'truncate rounded-lg px-2 py-0.5 text-[11px] font-medium',
                      tile.role === 'phone' && cameraOn
                        ? 'bg-[#253244] text-[#A9E7F4]'
                        : isTeacher
                          ? 'bg-[#22323A] text-[#A9E7F4]'
                          : 'bg-[#15131E]/70 text-[#D5CEE0]',
                    )}
                  >
                    {statusText}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Decorative call controls kept clear of the bottom-left headline and bottom-right slide counter */}
      <MeetCallDock className="absolute right-32 bottom-4 hidden md:flex" />
    </div>
  );
}

/**
 * Derives an initial 2D screen placement directly from the character's 3D world
 * coordinates so speech bubbles appear right above their speaker on frame 0
 * instead of jumping from an unrelated default position.
 */
function estimateInitialBubblePlacement(
  position: readonly [number, number, number],
  fallback: { readonly defaultLeft: string; readonly defaultTop: string },
): { readonly left: string; readonly top: string } {
  const [x, , z] = position;
  const leftPct = Math.min(86, Math.max(14, 50 + x * 14));
  const topPct = Math.min(76, Math.max(18, 34 + z * 7));
  return {
    left: Number.isFinite(leftPct)
      ? `${leftPct.toFixed(1)}%`
      : fallback.defaultLeft,
    top: Number.isFinite(topPct)
      ? `${topPct.toFixed(1)}%`
      : fallback.defaultTop,
  };
}

function OverheadSpeechBubbles({
  beat,
  setBubbleRef,
}: {
  readonly beat: PitchBeat;
  readonly setBubbleRef: (
    actorId: PitchActorId,
    el: HTMLDivElement | null,
  ) => void;
}) {
  if (beat.gridState !== 'broken') return null;

  const speakingActors = ACTOR_RENDER_ORDER.filter((actorId) =>
    Boolean(beat.actors[actorId]?.speech),
  );

  return (
    <>
      {speakingActors.map((actorId, turnIdx) => {
        const actor = beat.actors[actorId];
        if (!actor?.speech) return null;
        const meta = ACTOR_SPEECH_META[actorId];
        const initial = estimateInitialBubblePlacement(actor.position, meta);

        return (
          <div
            key={`${beat.id}-speech-${actorId}`}
            ref={(el) => setBubbleRef(actorId, el)}
            data-settled="true"
            style={{
              left: initial.left,
              top: initial.top,
              ...staggerStyle(550 + turnIdx * 2500),
            }}
            className="pitch-speech-bubble pointer-events-none absolute z-20 min-w-44 max-w-68 -translate-x-1/2 -translate-y-full sm:max-w-72"
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-full rounded-[1.25rem] border-2 bg-[#FFF9EB]/98 px-4 py-2.5 text-foreground shadow-[0_14px_30px_-10px_rgba(56,47,63,0.36)] sm:px-4.5 sm:py-3',
                  meta.borderClass,
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-display text-xs font-bold tracking-tight',
                      meta.badgeClass,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn('size-1.5 rounded-full', meta.dotClass)}
                    />
                    {meta.name}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
                  {actor.speech}
                </p>
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 12"
                className="-mt-[2px] h-3 w-6 shrink-0"
              >
                <path d="M2 0 L12 10 L22 0 Z" fill="#FFF9EB" />
                <path
                  d="M2 0 L12 10 L22 0"
                  fill="none"
                  stroke={meta.tailStroke}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        );
      })}
    </>
  );
}

function KeynoteHeadline({
  beat,
  align = 'left',
  large = false,
}: {
  readonly beat: PitchBeat;
  readonly align?: 'left' | 'center' | 'right';
  readonly large?: boolean;
}) {
  const isCold = beat.lighting === 'cold';
  const animClass =
    align === 'right'
      ? 'pitch-anim-right'
      : align === 'center'
        ? 'pitch-anim-up'
        : 'pitch-anim-left';

  return (
    <div
      className={cn(
        animClass,
        'pointer-events-none rounded-2xl border-2 p-3.5 shadow-float',
        large ? 'max-w-lg p-4' : 'max-w-sm',
        isCold
          ? 'border-[#524B63] bg-[#231E29]/95 text-[#FFF9EB]'
          : 'border-border bg-card/95 text-card-foreground',
      )}
    >
      {beat.chapterTag && (
        <span className="mb-1.5 inline-block rounded-full border border-[#D5B54B] bg-[#F7D86B] px-3 py-0.5 font-display text-xs font-bold text-foreground">
          {beat.chapterTag}
        </span>
      )}
      <h2
        className={cn(
          'font-display font-bold leading-tight',
          large ? 'text-xl sm:text-3xl' : 'text-base sm:text-xl',
        )}
      >
        {beat.title}
      </h2>
      <p
        className={cn(
          'mt-1 leading-snug',
          large ? 'text-xs sm:text-sm' : 'text-xs',
          isCold ? 'text-[#E4DFEC]' : 'text-muted-foreground',
        )}
      >
        {beat.supportText}
      </p>
    </div>
  );
}

function FocusHotspots({
  focusedKey,
}: {
  readonly focusedKey?: PitchFocusKey | null;
}) {
  const focused = focusedKey ? PITCH_FOCUS_SPECS[focusedKey] : null;
  if (!focused) return null;

  return (
    <div className="pointer-events-none absolute top-0 right-0 z-30 flex w-full max-w-xs flex-col items-end">
      <div
        key={focusedKey}
        role="note"
        className="pitch-anim-right rounded-2xl border-2 border-border bg-card/95 px-4 py-3 text-left text-foreground shadow-float"
      >
        <p className="font-display text-sm font-bold">
          {focused.label} ·{' '}
          <span className="font-semibold text-muted-foreground">
            {focused.where}
          </span>
        </p>
        <p className="mt-1 text-xs font-medium">{focused.purpose}</p>
      </div>
    </div>
  );
}

export function PitchHudOverlays({
  beat,
  selectedShopId,
  onSelectShopId,
  selectedSwatchId,
  onSelectSwatchId,
  setBubbleRef,
  focusedKey,
  onLaunchDeploy,
}: PitchHudOverlaysProps) {
  return (
    <>
      <LivingAmbientBackdrop beat={beat} />
      <MeetGridOverlay beat={beat} />

      <div key={beat.id} className="pointer-events-none absolute inset-4 z-20">
        {/* Camera rack-focus blur pull between scenes */}
        <div
          aria-hidden="true"
          className="pitch-rack-focus pointer-events-none fixed inset-0 z-10"
        />

        {/* Overhead 3D-tracked speech bubbles above each speaking character */}
        <OverheadSpeechBubbles beat={beat} setBubbleRef={setBubbleRef} />

        {/* Brief close-up card when the camera tours a classroom prop (no menu bar) */}
        <FocusHotspots focusedKey={focusedKey} />

        {/* 1.0 - 1.1: Opaque Meet Grid & Isolation */}
        {(beat.hud === 'call-grid' || beat.hud === 'call-grid-solo') && (
          <div className="flex h-full items-end justify-start">
            <KeynoteHeadline
              beat={beat}
              large={beat.hud === 'call-grid-solo'}
            />
          </div>
        )}

        {/* 1.2: Disconnection Domino Cascade */}
        {beat.hud === 'call-grid-fade' && (
          <div className="flex h-full flex-col justify-end gap-3">
            <KeynoteHeadline beat={beat} />
            <div className="flex flex-wrap items-center justify-start gap-2.5">
              {copy.cascadeSteps.map((step, idx) => (
                <span
                  key={step}
                  style={staggerStyle(idx * 130)}
                  className="pitch-anim-pop rounded-2xl border-2 border-[#75B7DA]/65 bg-[#231E29]/95 px-4 py-2 font-display text-sm font-bold text-[#FFF9EB] shadow-float"
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 1.3: Break the Grid Sunrise Reveal */}
        {beat.hud === 'break-reveal' && (
          <div className="flex h-full flex-col justify-end">
            <KeynoteHeadline beat={beat} large />
          </div>
        )}

        {/* 2.0: Sofía Split Profile */}
        {beat.hud === 'sofia-intro' && (
          <div className="flex h-full flex-col justify-end gap-3 sm:flex-row sm:items-end sm:justify-between sm:pr-28">
            <KeynoteHeadline beat={beat} />
            <div className="pitch-anim-right rounded-2xl border-2 border-border bg-card/95 p-3.5 shadow-float">
              <p className="font-display text-base font-bold text-foreground">
                {copy.sofiaBadge.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {copy.sofiaBadge.tags.map((tag, idx) => (
                  <span
                    key={tag}
                    style={staggerStyle(120 + idx * 100)}
                    className="pitch-anim-pop rounded-xl border border-edge bg-background px-2.5 py-1 font-display text-xs font-bold text-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2.1: Live Presence Badge (dialogues float above characters' heads) */}
        {beat.hud === 'peers-chat' && (
          <div className="flex h-full flex-col justify-between">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <KeynoteHeadline beat={beat} />
              <div className="pitch-anim-pop inline-flex w-fit items-center gap-2 rounded-full border-2 border-success-edge bg-success px-4 py-1.5 text-xs font-bold text-success-foreground shadow-float">
                <span
                  aria-hidden="true"
                  className="pitch-pulse-ring size-2.5 rounded-full bg-success-foreground"
                />
                {copy.peersChat.presence}
              </div>
            </div>
          </div>
        )}

        {/* 2.2: 2nd-Person Focus + Live Animated Task Board ("Tablera de Tareas") */}
        {beat.hud === 'room-zones' && (
          <div className="flex h-full flex-col justify-between">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <KeynoteHeadline beat={beat} />
              {!focusedKey && (
                <div
                  style={staggerStyle(120)}
                  className="pitch-anim-right w-full max-w-xs rounded-2xl border-2 border-border bg-card/95 p-3.5 shadow-float"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-sm font-bold text-foreground">
                      {copy.taskBoard.heading}
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-success-edge bg-success px-2 py-0.5 text-[11px] font-bold text-success-foreground">
                      <span
                        aria-hidden="true"
                        className="pitch-pulse-ring size-1.5 rounded-full bg-success-foreground"
                      />
                      {copy.taskBoard.livePill}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {copy.taskBoard.items.map((item, idx) => (
                      <div
                        key={item.id}
                        style={staggerStyle(160 + idx * 110)}
                        className={cn(
                          'pitch-anim-left rounded-xl border px-3 py-1.5',
                          ZONE_TONE_CLASSES[item.accent],
                        )}
                      >
                        <p className="font-display text-xs font-bold">
                          {item.title}
                        </p>
                        <p className="text-[11px] font-medium">{item.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4">
              {copy.roomZones.map((zone, idx) => (
                <div
                  key={zone.id}
                  style={staggerStyle(180 + idx * 80)}
                  className={cn(
                    'pitch-anim-up rounded-2xl border-2 px-3 py-2 shadow-float',
                    ZONE_TONE_CLASSES[zone.tone],
                  )}
                >
                  <p className="font-display text-xs font-bold sm:text-sm">
                    {zone.title}
                  </p>
                  <p className="text-[11px] font-medium">{zone.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2.3: Cascading Exam & Odometer +450 Points */}
        {beat.hud === 'exam-points' && (
          <div className="flex h-full flex-col justify-between sm:flex-row sm:items-end">
            <KeynoteHeadline beat={beat} />
            <div className="pitch-anim-right mr-28 w-full max-w-xs rounded-2xl border-2 border-border bg-card/95 p-4 shadow-float">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-base font-bold text-foreground">
                  {copy.examCard.title}
                </p>
                <span className="rounded-lg border border-success-edge bg-success px-2 py-0.5 font-display text-xs font-bold text-success-foreground">
                  {copy.examCard.score}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-primary">
                {copy.examCard.badge}
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {copy.examCard.items.map((item, idx) => (
                  <li
                    key={item}
                    style={staggerStyle(100 + idx * 120)}
                    className="pitch-anim-left flex items-center gap-2 text-xs font-semibold text-foreground"
                  >
                    <span className="text-primary">
                      <CheckIcon />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div
                style={staggerStyle(440)}
                className="pitch-anim-pop mt-3 rounded-xl border-2 border-warning-edge bg-warning px-3 py-2 text-center font-display text-xl font-bold text-warning-foreground"
              >
                <AnimatedScoreCounter />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {copy.examCard.footnote}
              </p>
            </div>
          </div>
        )}

        {/* 2.4: Frontal 3-Character 360° Showcase + Live Accessory & Outfit Dock */}
        {beat.hud === 'shop-carousel' && (
          <div className="flex h-full flex-col justify-between">
            <KeynoteHeadline beat={beat} />
            <div className="pitch-anim-up pointer-events-auto mr-28 w-full max-w-2xl rounded-2xl border-2 border-border bg-card/95 p-3.5 shadow-float">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-sm font-bold text-foreground">
                  {copy.shopTryOn.heading}
                </p>
                <p className="text-xs text-muted-foreground">
                  {copy.shopTryOn.prompt}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PITCH_SHOP_ITEMS.map((item, idx) => {
                  const selected = item.id === selectedShopId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      style={staggerStyle(80 + idx * 70)}
                      onClick={() => onSelectShopId(item.id)}
                      className={cn(
                        'pitch-anim-pop',
                        buttonStyles({
                          variant: selected ? 'default' : 'outline',
                          size: 'sm',
                        }),
                        'min-h-11 flex-col gap-0.5 px-2.5 py-1.5 text-xs',
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="opacity-85">{item.cost}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                {
                  PITCH_SHOP_ITEMS.find((item) => item.id === selectedShopId)
                    ?.summary
                }
              </p>
            </div>
          </div>
        )}

        {/* 3.0: Kinetic Balance Scale */}
        {beat.hud === 'motivation-balance' && (
          <div className="flex h-full flex-col justify-between">
            <KeynoteHeadline beat={beat} />
            <div className="grid max-w-4xl items-end gap-4 sm:grid-cols-2">
              <div
                style={staggerStyle(100)}
                className="pitch-anim-left rounded-2xl border-2 border-edge bg-card/90 p-4 opacity-90 shadow-float sm:-rotate-1"
              >
                <p className="font-display text-base font-bold text-foreground">
                  {copy.psychology.extrinsicTitle}
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {copy.psychology.extrinsicText}
                </p>
              </div>
              <div
                style={staggerStyle(220)}
                className="pitch-anim-right -translate-y-2 rounded-2xl border-2 border-success-edge bg-success/95 p-4 text-success-foreground shadow-float sm:rotate-1"
              >
                <p className="font-display text-base font-bold">
                  {copy.psychology.intrinsicTitle}
                </p>
                <p className="mt-1 text-xs font-medium sm:text-sm">
                  {copy.psychology.intrinsicText}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3.1 - 3.3: Progressive 3-Pillar SDT Triad + Color Swatches */}
        {(beat.hud === 'sdt-autonomy' ||
          beat.hud === 'sdt-competence' ||
          beat.hud === 'sdt-belonging') && (
          <div className="flex h-full flex-col justify-between">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <KeynoteHeadline beat={beat} />
              {beat.hud === 'sdt-autonomy' && (
                <div className="pitch-anim-right pointer-events-auto flex max-w-md flex-wrap items-center gap-2 rounded-2xl border-2 border-border bg-card/95 p-3 shadow-float">
                  <span className="w-full font-display text-xs font-bold text-foreground">
                    {copy.psychology.autonomyPickerLabel}
                  </span>
                  {PITCH_AUTONOMY_SWATCHES.map((swatch) => {
                    const active = swatch.id === selectedSwatchId;
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelectSwatchId(swatch.id)}
                        className={cn(
                          buttonStyles({
                            variant: active ? 'default' : 'outline',
                            size: 'sm',
                          }),
                          'min-h-9 gap-1.5 px-2.5 py-1 text-xs',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="size-3 rounded-full border border-foreground/40"
                          style={{
                            backgroundColor:
                              swatch.clothingColor satisfies Avatar['clothingColor'],
                          }}
                        />
                        {swatch.label}
                      </button>
                    );
                  })}
                  <p className="w-full text-xs font-semibold text-muted-foreground">
                    {
                      PITCH_AUTONOMY_SWATCHES.find(
                        (swatch) => swatch.id === selectedSwatchId,
                      )?.badge
                    }
                  </p>
                  {PITCH_AUTONOMY_SWATCHES.find(
                    (swatch) => swatch.id === selectedSwatchId,
                  )?.isTeacherFocus && (
                    <span className="w-full rounded-xl border border-info-edge bg-info px-2.5 py-1 font-display text-[11px] font-bold text-info-foreground">
                      {copy.psychology.teacherViewBadge}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid max-w-4xl gap-3 sm:grid-cols-3">
              {copy.psychology.pillars.map((pillar, idx) => {
                const isHighlighted =
                  (beat.hud === 'sdt-autonomy' && pillar.id === 'autonomy') ||
                  (beat.hud === 'sdt-competence' &&
                    pillar.id === 'competence') ||
                  (beat.hud === 'sdt-belonging' && pillar.id === 'belonging');
                return (
                  <div
                    key={pillar.id}
                    style={staggerStyle(idx * 90)}
                    className={cn(
                      'pitch-anim-up rounded-2xl border-2 p-3.5 shadow-float transition-transform duration-300',
                      isHighlighted
                        ? cn(
                            ZONE_TONE_CLASSES[pillar.tone],
                            '-translate-y-2 scale-[1.03]',
                          )
                        : 'border-edge bg-card/85 text-foreground opacity-75',
                    )}
                  >
                    <p className="font-display text-sm font-bold sm:text-base">
                      {pillar.title}
                    </p>
                    <p className="mt-1 text-xs font-medium">
                      {pillar.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3.4: Frontal 3-Character Golden Effort Showcase */}
        {beat.hud === 'effort-helmet' && (
          <div className="flex h-full flex-col justify-between">
            <KeynoteHeadline beat={beat} />
            <div
              style={staggerStyle(140)}
              className="pitch-anim-pop max-w-sm rounded-2xl border-2 border-[#D5B54B] bg-[#F7D86B]/95 p-4 text-foreground shadow-float"
            >
              <p className="font-display text-base font-bold">
                {copy.psychology.effortCard.title}
              </p>
              <p className="mt-0.5 text-xs font-semibold">
                {copy.psychology.effortCard.subtitle}
              </p>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-foreground/15">
                <div className="h-full w-full rounded-full bg-primary" />
              </div>
              <p className="mt-2.5 font-display text-sm font-bold">
                {copy.psychology.effortCard.quote}
              </p>
            </div>
          </div>
        )}

        {/* 4.0: 7-Day Domino Streak Wave */}
        {beat.hud === 'habit-streak' && (
          <div className="flex h-full flex-col justify-between">
            <KeynoteHeadline beat={beat} />
            <div className="pitch-anim-up max-w-4xl rounded-2xl border-2 border-border bg-card/95 p-4 shadow-float">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 font-display text-base font-bold text-foreground">
                  <FlameIcon />
                  {copy.habitStreak.title}
                </p>
                <span className="rounded-lg border border-info-edge bg-info px-2.5 py-1 text-xs font-bold text-info-foreground">
                  {copy.habitStreak.integrityBadge}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {copy.habitStreak.days.map((day, idx) => (
                  <div
                    key={day}
                    style={staggerStyle(80 + idx * 75)}
                    className="pitch-anim-pop flex flex-col items-center gap-1 rounded-xl border-2 border-success-edge bg-success px-2 py-2 text-center text-success-foreground"
                  >
                    <CheckIcon />
                    <span className="font-display text-xs font-bold">
                      {day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4.1: Vertical Institutional Cascade */}
        {beat.hud === 'school-bot' && (
          <div className="flex h-full flex-col justify-between sm:flex-row sm:items-end">
            <div className="self-start">
              <KeynoteHeadline beat={beat} />
            </div>
            <div className="mr-28 flex max-w-sm flex-col gap-2.5">
              {copy.schoolValue.cards.map((card, idx) => (
                <div
                  key={card.title}
                  style={staggerStyle(100 + idx * 120)}
                  className="pitch-anim-right rounded-2xl border-2 border-border bg-card/95 p-3.5 shadow-float"
                >
                  <p className="font-display text-sm font-bold text-foreground">
                    {card.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {card.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4.2: Grand Finale Manifesto + /login Handoff */}
        {beat.hud === 'closing-manifesto' && (
          <div className="flex h-full flex-col justify-between">
            <KeynoteHeadline beat={beat} />
            <div
              style={staggerStyle(160)}
              className="pitch-anim-up pointer-events-auto mr-28 flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-border bg-card/95 p-5 shadow-float sm:flex-row sm:items-center"
            >
              <div className="max-w-2xl">
                <p className="font-display text-base font-bold text-foreground sm:text-xl">
                  {copy.closing.manifesto}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {copy.closing.handoffNote}
                </p>
              </div>
              <button
                type="button"
                onClick={onLaunchDeploy}
                className={cn(buttonStyles({ size: 'lg' }), 'shrink-0')}
              >
                <span>{copy.controls.liveDemoCta}</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
