import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent,
} from 'react';
import { useNavigate } from 'react-router';
import { useDocumentTitle } from '@/app/router/document-title';
import { MAIN_CONTENT_ID } from '@/app/router/focus-on-navigation';
import { cn } from '@/lib/utils';
import { WorldCanvas } from '../world/world-canvas';
import { pitchMessages as copy } from './messages';
import {
  PITCH_SCOPE_KEY,
  Pitch3DStage,
  type Pitch3DStageProps,
} from './pitch-3d-stage';
import { PITCH_LIVE_DEPLOY_URL } from './pitch-config';
import { PitchHudOverlays } from './pitch-hud-overlays';
import { PitchIntroScreen } from './pitch-intro-screen';
import './pitch-keynote.css';
import { PitchLaunchScreen } from './pitch-launch-screen';
import {
  PITCH_AUTONOMY_SWATCHES,
  PITCH_BEATS,
  PITCH_FOCUS_SPECS,
  PITCH_SHOP_ITEMS,
  actFirstBeatIndex,
  type PitchActorId,
  type PitchFocusKey,
  type PitchShopTryOnItem,
} from './pitch-script';

const WHEEL_COOLDOWN_MS = 620;
const WHEEL_THRESHOLD_PX = 15;

/**
 * Full-bleed 16:9 Keynote 3D pitch deck aligned with Part 1 (`0:00–6:00`) of
 * the presentation script. Opens on a brief branded intro before Meet, runs
 * through the 17 animated beats via scroll, click, or keyboard, and finishes
 * with a rapid classroom loading screen that opens `PITCH_LIVE_DEPLOY_URL`.
 */
export function PitchDeckPage() {
  useDocumentTitle(copy.pageTitle);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'intro' | 'deck' | 'launching'>('intro');

  const handleOpenDeploy = useCallback(() => {
    if (/^https?:\/\//i.test(PITCH_LIVE_DEPLOY_URL)) {
      window.location.assign(PITCH_LIVE_DEPLOY_URL);
      return;
    }
    void navigate(PITCH_LIVE_DEPLOY_URL);
  }, [navigate]);

  if (phase === 'intro') {
    return <PitchIntroScreen onStart={() => setPhase('deck')} />;
  }
  if (phase === 'launching') {
    return <PitchLaunchScreen onComplete={handleOpenDeploy} />;
  }
  return <PitchDeck onLaunchDeploy={() => setPhase('launching')} />;
}

function PitchDeck({
  onLaunchDeploy,
}: {
  readonly onLaunchDeploy: () => void;
}) {
  const [beatIndex, setBeatIndex] = useState(0);
  const [selectedShopId, setSelectedShopId] =
    useState<PitchShopTryOnItem['id']>('helmet');
  const [shopPaused, setShopPaused] = useState(false);
  const [selectedSwatchId, setSelectedSwatchId] = useState<string>(
    PITCH_AUTONOMY_SWATCHES[0].id,
  );
  const [swatchPaused, setSwatchPaused] = useState(false);
  const [focusStep, setFocusStep] = useState(0);

  const mainRef = useRef<HTMLElement>(null);
  const lastWheelAtRef = useRef(0);
  const completedFocusToursRef = useRef<Set<string>>(new Set());
  const bubbleElementsRef = useRef<Record<PitchActorId, HTMLDivElement | null>>(
    {
      sofia: null,
      lucas: null,
      mateo: null,
      docente: null,
    },
  );

  // Move focus into the deck after the intro so keyboard control works at once.
  useEffect(() => {
    mainRef.current?.focus();
  }, []);

  const setBubbleRef = useCallback(
    (actorId: PitchActorId, el: HTMLDivElement | null) => {
      bubbleElementsRef.current[actorId] = el;
    },
    [],
  );

  const getBubbleElement = useCallback(
    (actorId: PitchActorId) => bubbleElementsRef.current[actorId],
    [],
  );

  const beat = PITCH_BEATS[beatIndex] ?? PITCH_BEATS[0];
  const isLast = beatIndex === PITCH_BEATS.length - 1;
  const isCold = beat.lighting === 'cold';
  const focusKeys = beat.focusables ?? [];
  const focusedKey: PitchFocusKey | null =
    focusStep >= 0 && focusStep < focusKeys.length
      ? (focusKeys[focusStep] ?? null)
      : null;

  const prepareForBeatIndex = useCallback(
    (nextIndex: number) => {
      const currentBeat = PITCH_BEATS[beatIndex];
      if (currentBeat?.focusables?.length) {
        completedFocusToursRef.current.add(currentBeat.id);
      }
      const nextBeat = PITCH_BEATS[nextIndex];
      const alreadyToured =
        Boolean(nextBeat) && completedFocusToursRef.current.has(nextBeat.id);
      setShopPaused(false);
      setSwatchPaused(false);
      setFocusStep(alreadyToured ? -1 : 0);
    },
    [beatIndex],
  );

  const goNext = useCallback(() => {
    if (beatIndex >= PITCH_BEATS.length - 1) {
      onLaunchDeploy();
      return;
    }
    const nextIndex = Math.min(PITCH_BEATS.length - 1, beatIndex + 1);
    prepareForBeatIndex(nextIndex);
    setBeatIndex(nextIndex);
  }, [beatIndex, onLaunchDeploy, prepareForBeatIndex]);

  const goPrev = useCallback(() => {
    const prevIndex = Math.max(0, beatIndex - 1);
    prepareForBeatIndex(prevIndex);
    setBeatIndex(prevIndex);
  }, [beatIndex, prepareForBeatIndex]);

  const jumpToAct = useCallback(
    (act: 1 | 2 | 3 | 4) => {
      const targetIndex = actFirstBeatIndex(act);
      prepareForBeatIndex(targetIndex);
      setBeatIndex(targetIndex);
    },
    [prepareForBeatIndex],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (Math.abs(event.deltaY) < WHEEL_THRESHOLD_PX) return;
      const now = performance.now();
      if (now - lastWheelAtRef.current < WHEEL_COOLDOWN_MS) return;
      lastWheelAtRef.current = now;
      if (event.deltaY > 0) {
        goNext();
      } else {
        goPrev();
      }
    },
    [goNext, goPrev],
  );

  const handleSelectShopId = useCallback((id: PitchShopTryOnItem['id']) => {
    setShopPaused(true);
    setSelectedShopId(id);
  }, []);

  const handleSelectSwatchId = useCallback((id: string) => {
    setSwatchPaused(true);
    setSelectedSwatchId(id);
  }, []);

  // Automatically tour close-up views once across the slide's classroom spots, then settle on the main framing.
  useEffect(() => {
    const count = beat.focusables?.length ?? 0;
    if (count === 0 || completedFocusToursRef.current.has(beat.id)) return;
    const timer = window.setInterval(() => {
      setFocusStep((current) => {
        if (current < 0 || current >= count) {
          completedFocusToursRef.current.add(beat.id);
          window.clearInterval(timer);
          return count;
        }
        const next = current + 1;
        if (next >= count) {
          completedFocusToursRef.current.add(beat.id);
          window.clearInterval(timer);
        }
        return next;
      });
    }, 2750);
    return () => window.clearInterval(timer);
  }, [beat.id, beat.focusables]);

  // Cycle all 3 characters' outfits, hairstyles & accessories once on Beat 2.4.
  useEffect(() => {
    if (beat.hud !== 'shop-carousel' || shopPaused) return;
    let steps = 0;
    const timer = window.setInterval(() => {
      steps += 1;
      setSelectedShopId((current) => {
        const idx = PITCH_SHOP_ITEMS.findIndex((item) => item.id === current);
        const next = PITCH_SHOP_ITEMS[(idx + 1) % PITCH_SHOP_ITEMS.length];
        return next?.id ?? 'helmet';
      });
      if (steps >= PITCH_SHOP_ITEMS.length - 1) {
        window.clearInterval(timer);
      }
    }, 1850);
    return () => window.clearInterval(timer);
  }, [beat.hud, shopPaused]);

  // Cycle all 4 characters' outfits, hairstyles, accessories & teacher view once on Beat 3.1.
  useEffect(() => {
    if (beat.hud !== 'sdt-autonomy' || swatchPaused) return;
    let steps = 0;
    const timer = window.setInterval(() => {
      steps += 1;
      setSelectedSwatchId((current) => {
        const idx = PITCH_AUTONOMY_SWATCHES.findIndex(
          (swatch) => swatch.id === current,
        );
        const next =
          PITCH_AUTONOMY_SWATCHES[(idx + 1) % PITCH_AUTONOMY_SWATCHES.length];
        return next?.id ?? PITCH_AUTONOMY_SWATCHES[0].id;
      });
      if (steps >= PITCH_AUTONOMY_SWATCHES.length - 1) {
        window.clearInterval(timer);
      }
    }, 1750);
    return () => window.clearInterval(timer);
  }, [beat.hud, swatchPaused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Escape' && focusedKey) {
        event.preventDefault();
        setFocusStep(-1);
        return;
      }
      if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        event.key === 'PageDown'
      ) {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === ' ') {
        if (target instanceof HTMLElement && target.closest('button, a')) {
          return;
        }
        event.preventDefault();
        goNext();
        return;
      }
      if (
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowUp' ||
        event.key === 'PageUp'
      ) {
        event.preventDefault();
        goPrev();
        return;
      }
      if (
        event.key === '1' ||
        event.key === '2' ||
        event.key === '3' ||
        event.key === '4'
      ) {
        event.preventDefault();
        jumpToAct(Number(event.key) as 1 | 2 | 3 | 4);
        return;
      }
      if (
        event.key === 'Enter' &&
        isLast &&
        !(target instanceof HTMLElement && target.closest('button, a'))
      ) {
        event.preventDefault();
        onLaunchDeploy();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, jumpToAct, isLast, onLaunchDeploy, focusedKey]);

  const selectedShopItem = PITCH_SHOP_ITEMS.find(
    (item) => item.id === selectedShopId,
  );
  const selectedSwatch = PITCH_AUTONOMY_SWATCHES.find(
    (swatch) => swatch.id === selectedSwatchId,
  );

  let actorOverrides: Pitch3DStageProps['actorOverrides'];
  if (beat.hud === 'shop-carousel' && selectedShopItem) {
    actorOverrides = {
      sofia: {
        avatar: selectedShopItem.sofiaAvatar,
        equipped: selectedShopItem.equipped,
      },
      lucas: {
        avatar: selectedShopItem.lucasAvatar,
        equipped: selectedShopItem.lucasEquipped,
      },
      mateo: {
        avatar: selectedShopItem.mateoAvatar,
        equipped: selectedShopItem.mateoEquipped,
      },
    };
  } else if (beat.hud === 'sdt-autonomy' && selectedSwatch) {
    actorOverrides = {
      sofia: {
        avatar: {
          hairId: selectedSwatch.sofiaHair,
          topId: selectedSwatch.sofiaTop,
          hairColor: selectedSwatch.hairColor,
          clothingColor: selectedSwatch.clothingColor,
        },
        equipped: selectedSwatch.sofiaEquipped,
      },
      lucas: {
        avatar: {
          hairId: selectedSwatch.lucasHair,
          topId: selectedSwatch.lucasTop,
          clothingColor: selectedSwatch.lucasColor,
        },
        equipped: selectedSwatch.lucasEquipped,
      },
      mateo: {
        avatar: {
          hairId: selectedSwatch.mateoHair,
          topId: selectedSwatch.mateoTop,
          clothingColor: selectedSwatch.mateoColor,
        },
        equipped: selectedSwatch.mateoEquipped,
      },
      docente: {
        avatar: {
          hairId: selectedSwatch.docenteHair,
          topId: selectedSwatch.docenteTop,
          clothingColor: selectedSwatch.docenteColor,
        },
        equipped: selectedSwatch.docenteEquipped,
      },
    };
  }

  const cameraOverride = focusedKey
    ? PITCH_FOCUS_SPECS[focusedKey].camera
    : null;

  const slideNum = String(beatIndex + 1).padStart(2, '0');
  const slideTotal = String(PITCH_BEATS.length).padStart(2, '0');

  return (
    <main
      ref={mainRef}
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      onWheel={handleWheel}
      className="pitch-keynote-root flex h-screen w-screen items-center justify-center overflow-hidden bg-[#181622] p-2 text-foreground outline-none sm:p-4"
    >
      <h1 className="sr-only">{copy.deckHeading}</h1>
      <p role="status" aria-live="polite" className="sr-only">
        {copy.controls.stepStatus(
          beatIndex + 1,
          PITCH_BEATS.length,
          beat.speaker,
          beat.title,
        )}
      </p>

      {/* Pure 16:9 Keynote stage: no chrome bars, only scroll/click + slide number */}
      <div
        className={cn(
          'pitch-stage-enter relative aspect-video max-h-full w-full max-w-[177.78vh] overflow-hidden rounded-3xl border-2 shadow-float transition-colors duration-500',
          isCold ? 'border-[#524B63] bg-[#15131E]' : 'border-border bg-card',
        )}
      >
        <WorldCanvas
          label={copy.canvasLabel}
          framing="follow"
          scopeKey={PITCH_SCOPE_KEY}
          hostClassName="h-full w-full"
          canvasClassName="h-full w-full"
        >
          <Pitch3DStage
            beat={beat}
            actorOverrides={actorOverrides}
            getBubbleElement={getBubbleElement}
            cameraOverride={cameraOverride}
            focusedKey={focusedKey}
          />
        </WorldCanvas>

        {/* Semantic click-to-advance backdrop behind interactive z-20 controls (on final slide triggers launch screen) */}
        <button
          type="button"
          aria-label={copy.controls.advanceStage}
          onClick={goNext}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-ring"
        />

        <PitchHudOverlays
          beat={beat}
          selectedShopId={selectedShopId}
          onSelectShopId={handleSelectShopId}
          selectedSwatchId={selectedSwatchId}
          onSelectSwatchId={handleSelectSwatchId}
          setBubbleRef={setBubbleRef}
          focusedKey={focusedKey}
          onLaunchDeploy={onLaunchDeploy}
        />

        {/* Minimal bottom-right slide counter badge */}
        <div
          className={cn(
            'pointer-events-none absolute right-4 bottom-4 z-30 flex flex-col items-end gap-1.5 rounded-2xl border px-3.5 py-2 shadow-panel backdrop-blur-sm',
            isCold
              ? 'border-[#524B63] bg-[#231E29]/90 text-[#FFF9EB]'
              : 'border-edge bg-card/90 text-foreground',
          )}
        >
          <span className="font-display text-sm font-bold tabular-nums">
            {slideNum} / {slideTotal}
          </span>
          <div
            aria-hidden="true"
            className={cn(
              'h-1.5 w-20 overflow-hidden rounded-full',
              isCold ? 'bg-[#353849]' : 'bg-edge',
            )}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{
                width: `${((beatIndex + 1) / PITCH_BEATS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
