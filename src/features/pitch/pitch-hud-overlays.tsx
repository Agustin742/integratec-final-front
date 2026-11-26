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
      readonly defaultLeft: string;
      readonly defaultTop: string;
    }
  >
> = {
  sofia: {
    name: 'Sofía',
    badgeClass: 'bg-[#5B4F96] text-[#FFF9EB]',
    defaultLeft: '50%',
    defaultTop: '24%',
  },
  lucas: {
    name: 'Lucas',
    badgeClass: 'bg-[#28603B] text-[#FFF9EB]',
    defaultLeft: '24%',
    defaultTop: '30%',
  },
  mateo: {
    name: 'Mateo',
    badgeClass: 'bg-[#AF7B52] text-[#FFF9EB]',
    defaultLeft: '76%',
    defaultTop: '30%',
  },
  docente: {
    name: 'Docente',
    badgeClass: 'bg-[#382F3F] text-[#FFF9EB]',
    defaultLeft: '38%',
    defaultTop: '24%',
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
        viewBox="0 0 120 96"
        className="h-20 w-24 shrink-0"
      >
        <rect x="12" y="64" width="96" height="32" rx="16" fill="#5B4F96" />
        <circle cx="56" cy="40" r="20" fill="#F8C6AF" />
        <path
          d="M34 38c0-14 10-22 22-22s22 8 22 22c-6-6-14-8-22-8s-16 2-22 8Z"
          fill="#6C4D48"
        />
        <circle cx="49" cy="40" r="2.2" fill="#382F3F" />
        <circle cx="63" cy="40" r="2.2" fill="#382F3F" />
        {handUp ? (
          <path
            d="M49 49q7 4 14 0"
            fill="none"
            stroke="#382F3F"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M50 51q6-3 12 0"
            fill="none"
            stroke="#382F3F"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}
        {handUp && (
          <g className="pitch-hand-wave">
            <rect x="84" y="22" width="12" height="38" rx="6" fill="#F8C6AF" />
            <circle cx="90" cy="20" r="7" fill="#F8C6AF" />
          </g>
        )}
      </svg>
    );
  }

  if (role === 'phone') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 120 96"
        className="h-20 w-24 shrink-0"
      >
        <rect x="16" y="66" width="88" height="30" rx="14" fill="#75B7DA" />
        <circle cx="56" cy="44" r="19" fill="#ECA786" />
        <path
          d="M37 40c0-13 9-20 19-20s19 7 19 20c-6-5-13-7-19-7s-13 2-19 7Z"
          fill="#353849"
        />
        <circle cx="50" cy="47" r="2" fill="#382F3F" />
        <circle cx="62" cy="47" r="2" fill="#382F3F" />
        <rect
          x="44"
          y="60"
          width="24"
          height="32"
          rx="4"
          fill="#231E29"
          stroke="#75B7DA"
          strokeWidth="2"
        />
        <rect
          x="48"
          y="64"
          width="16"
          height="22"
          rx="2"
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
        viewBox="0 0 120 96"
        className="h-20 w-24 shrink-0"
      >
        <rect x="14" y="64" width="92" height="32" rx="14" fill="#F4E6D2" />
        <path d="M55 64h10l-3 18h-4Z" fill="#E66861" />
        <circle cx="60" cy="40" r="20" fill="#CB8966" />
        <path
          d="M40 36c0-13 9-20 20-20s20 7 20 20c-7-5-13-7-20-7s-13 2-20 7Z"
          fill="#6C4D48"
        />
        <circle
          cx="52"
          cy="41"
          r="5"
          fill="none"
          stroke="#382F3F"
          strokeWidth="2"
        />
        <circle
          cx="68"
          cy="41"
          r="5"
          fill="none"
          stroke="#382F3F"
          strokeWidth="2"
        />
        <line
          x1="57"
          y1="41"
          x2="63"
          y2="41"
          stroke="#382F3F"
          strokeWidth="2"
        />
        <circle cx="52" cy="41" r="1.8" fill="#382F3F" />
        <circle cx="68" cy="41" r="1.8" fill="#382F3F" />
        <ellipse cx="60" cy="51" rx="4.5" ry="2.8" fill="#382F3F" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 120 96" className="h-20 w-24 shrink-0">
      <rect x="18" y="66" width="84" height="30" rx="14" fill="#7EBA8B" />
      <circle cx="60" cy="42" r="19" fill="#ECA786" />
      <path
        d="M41 37c0-12 9-19 19-19s19 7 19 19c-6-4-13-6-19-6s-13 2-19 6Z"
        fill="#AF6D63"
      />
      <circle cx="53" cy="42" r="2" fill="#382F3F" />
      <circle cx="67" cy="42" r="2" fill="#382F3F" />
      <line
        x1="54"
        y1="50"
        x2="66"
        y2="50"
        stroke="#382F3F"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
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
        'pointer-events-none absolute inset-0 z-10 grid grid-cols-3 grid-rows-3 gap-2.5 bg-[#15131E] p-4 pb-20',
        isBroken && 'pitch-grid-shatter',
      )}
    >
      {copy.meetTiles.map((tile, index) => {
        const isTeacher = tile.role === 'teacher';
        const cameraOn =
          isTeacher ||
          (phase === '1.0' && tile.role !== 'off') ||
          (phase === '1.1' && (tile.role === 'hand' || tile.role === 'phone'));

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

        return (
          <div
            key={tile.id}
            style={staggerStyle(index * 40)}
            className={cn(
              'pitch-anim-up flex flex-col justify-between rounded-2xl border p-3 transition-colors duration-300',
              isTeacher
                ? 'border-[#75B7DA] bg-[#262336]'
                : cameraOn
                  ? 'border-[#524B63] bg-[#2D2940]'
                  : 'border-[#2E2A3B] bg-[#1D1A27]',
            )}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#FFF9EB]">
              <span className="truncate">{tile.name}</span>
              {isTeacher ? (
                <span
                  className="flex h-3.5 items-end gap-0.5"
                  aria-hidden="true"
                >
                  <span className="pitch-voice-bar h-3 w-1 rounded-full bg-[#62CFC7]" />
                  <span
                    style={staggerStyle(150)}
                    className="pitch-voice-bar h-3.5 w-1 rounded-full bg-[#62CFC7]"
                  />
                  <span
                    style={staggerStyle(300)}
                    className="pitch-voice-bar h-2.5 w-1 rounded-full bg-[#62CFC7]"
                  />
                </span>
              ) : (
                <span className="text-[#D5CEE0]">
                  <MicOffIcon />
                </span>
              )}
            </div>

            <div className="flex items-center justify-center">
              {cameraOn ? (
                <MeetPersonSvg role={tile.role} phase={phase} />
              ) : (
                <div className="flex size-11 items-center justify-center rounded-full border border-[#3E394E] bg-[#272334] font-display text-sm font-bold text-[#D5CEE0]">
                  {tile.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-medium',
                  tile.role === 'hand' && phase === '1.0'
                    ? 'bg-[#F7D86B] font-bold text-foreground'
                    : tile.role === 'phone' && cameraOn
                      ? 'bg-[#353849] text-[#A9E7F4]'
                      : isTeacher
                        ? 'bg-[#353849] text-[#FFF9EB]'
                        : 'text-[#D5CEE0]',
                )}
              >
                {statusText}
              </span>
            </div>
          </div>
        );
      })}
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
  const leftPct = Math.min(84, Math.max(16, 50 + x * 14));
  const topPct = Math.min(68, Math.max(18, 28 + z * 7));
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
            className="pitch-speech-bubble pointer-events-none absolute z-20 max-w-52 -translate-x-1/2 -translate-y-full"
          >
            <div className="rounded-2xl border-2 border-border bg-card/95 px-3 py-2 text-foreground shadow-float">
              <span
                className={cn(
                  'inline-block rounded-md px-1.5 py-0.5 font-display text-[11px] font-bold',
                  meta.badgeClass,
                )}
              >
                {meta.name}
              </span>
              <p className="mt-1 text-xs font-semibold leading-snug text-foreground">
                {actor.speech}
              </p>
            </div>
            <div
              aria-hidden="true"
              className="mx-auto size-2.5 -translate-y-1.5 rotate-45 border-r-2 border-b-2 border-border bg-card"
            />
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
