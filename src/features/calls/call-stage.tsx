import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AvatarPreview } from '@/features/profile/avatar-preview';
import { cn } from '@/lib/utils';
import { toAvatar } from './call-appearance';
import type { CallParticipantState } from './call-session';
import { computeStageLayout } from './call-stage-layout';
import { tileRadius } from './rounded-rects-path';

const CallStageCanvas = lazy(() => import('./call-stage-canvas'));

const GAP = 12;

export const callStageMessages = {
  self: 'vos',
  speaking: 'hablando',
  muted: 'micrófono silenciado',
  speakingAnnouncement: (names: string) => `${names} está hablando`,
  speakingAnnouncementPlural: (names: string) => `${names} están hablando`,
} as const;

class CanvasBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const read = (width: number, height: number) =>
      setSize((prev) =>
        prev.width === Math.floor(width) && prev.height === Math.floor(height)
          ? prev
          : { width: Math.floor(width), height: Math.floor(height) },
      );
    const rect = element.getBoundingClientRect();
    read(rect.width, rect.height);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (box) read(box.width, box.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function MutedIcon() {
  return (
    <svg
      data-testid="muted-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.7-1.3" />
      <path d="M5 11a7 7 0 0 0 11.2 5.6M19 11a7 7 0 0 1-.6 2.8M12 18v3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export interface CallStageProps {
  readonly participants: readonly CallParticipantState[];
  /** Smoothed voice level (0..1), read per frame by the avatars. */
  readonly getLevel: (sessionId: string) => number;
  readonly className?: string;
}

function tileName(p: CallParticipantState, speaking: boolean): string {
  return [
    p.isSelf ? `${p.displayName} (${callStageMessages.self})` : p.displayName,
    ...(p.muted ? [callStageMessages.muted] : []),
    ...(speaking ? [callStageMessages.speaking] : []),
  ].join(', ');
}

/**
 * Video-call-like stage: adaptive rounded-square tiles with each participant's
 * avatar. DOM tiles carry labels and state; one lazily loaded WebGL canvas
 * behind them draws every avatar into its tile rect. If WebGL is unavailable
 * the tiles show the 2D avatar preview instead.
 */
export function CallStage({
  participants,
  getLevel,
  className,
}: CallStageProps) {
  const [ref, { width, height }] = useElementSize();
  const [webglFailed, setWebglFailed] = useState(false);
  const layout = useMemo(
    () =>
      computeStageLayout({
        width,
        height,
        count: participants.length,
        gap: GAP,
      }),
    [width, height, participants.length],
  );
  const shown = participants.slice(0, layout.rects.length);
  const radius = tileRadius(layout.tile);

  const speakers = shown
    .filter((p) => p.speaking && !p.muted)
    .map((p) => p.displayName);
  const announcement =
    speakers.length === 0
      ? ''
      : speakers.length === 1
        ? callStageMessages.speakingAnnouncement(speakers[0] ?? '')
        : callStageMessages.speakingAnnouncementPlural(speakers.join(', '));

  const tiles = useMemo(
    () =>
      shown.map((p) => ({
        sessionId: p.sessionId,
        avatar: toAvatar(p.appearance),
        speaking: p.speaking,
        muted: p.muted,
        emote: p.emote,
        emoteSeq: p.emoteSeq,
      })),
    // `shown` is derived from these two inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participants, layout.rects.length],
  );

  return (
    <div
      ref={ref}
      className={cn('relative size-full min-h-0 overflow-hidden', className)}
    >
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {!webglFailed && layout.rects.length > 0 && (
        <CanvasBoundary onError={() => setWebglFailed(true)}>
          <Suspense fallback={null}>
            <CallStageCanvas
              tiles={tiles}
              rects={layout.rects}
              width={width}
              height={height}
              getLevel={getLevel}
              onUnavailable={() => setWebglFailed(true)}
            />
          </Suspense>
        </CanvasBoundary>
      )}
      <ul className="absolute inset-0 m-0 list-none p-0">
        {shown.map((p, index) => {
          const rect = layout.rects[index];
          if (!rect) return null;
          const speaking = p.speaking && !p.muted;
          const avatar = tiles[index]?.avatar ?? null;
          return (
            <li
              key={p.sessionId}
              role="group"
              aria-label={tileName(p, speaking)}
              data-speaking={speaking}
              className={cn(
                'absolute overflow-hidden border-2 border-edge shadow-float',
                !webglFailed ? 'bg-transparent' : 'bg-card',
                speaking && 'call-tile-speaking border-accent',
              )}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.size,
                height: rect.size,
                borderRadius: radius,
              }}
            >
              {webglFailed &&
                (avatar ? (
                  <AvatarPreview
                    avatar={avatar}
                    className="mx-auto h-full w-auto"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-full items-center justify-center text-4xl font-semibold"
                  >
                    {p.displayName.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                ))}
              <span className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-lg bg-card/90 px-2 py-1 text-sm font-medium text-card-foreground">
                {p.muted && <MutedIcon />}
                <span className="truncate">{p.displayName}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
