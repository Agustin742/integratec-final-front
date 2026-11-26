import { useDeferredValue, useEffect, useState } from 'react';
import type { Avatar } from '@/features/profile/avatar-options';
import { AvatarModel } from '../avatar/avatar-model';
import { GlbAsset } from '../glb-asset';
import { usePrefersReducedMotion } from '../use-prefers-reduced-motion';
import { WorldCanvas } from '../world-canvas';
import { WarmLighting } from '../world-lighting';
import { planPreviewScene, type RandomSource } from './preview-scene-plan';

/** Time on each body animation; the outfit changes every second step. */
export const PREVIEW_STEP_MS = 3500;
/** Own cache scope: leaving the public screens frees every preview model. */
const SCOPE_KEY = 'auth-preview';
const BACKGROUND = '#FFF9EB';

/** Steps through the show; stays on the first one under reduced motion. */
function useShowStep(running: boolean): number {
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

/** Keeps the previous outfit on screen while the next one downloads. */
function Character({
  avatar,
  animation,
  onUnavailable,
}: {
  readonly avatar: Avatar;
  readonly animation: string;
  readonly onUnavailable: () => void;
}) {
  const shown = useDeferredValue(avatar);
  return (
    <AvatarModel
      avatar={shown}
      animation={animation}
      scopeKey={SCOPE_KEY}
      onBodyError={onUnavailable}
    />
  );
}

export interface PreviewScene3DProps {
  readonly label: string;
  readonly random?: RandomSource | undefined;
  /** No WebGL, a lost context or a body that cannot load. */
  readonly onUnavailable: () => void;
}

/**
 * Front view of a random character that waves, plays a second animation and
 * changes outfits, with scenery beside it. The plan is drawn once per mount,
 * so each page load differs. Loaded lazily by `PreviewScene`.
 */
export function PreviewScene3D({
  label,
  random = Math.random,
  onUnavailable,
}: PreviewScene3DProps) {
  const [plan] = useState(() => planPreviewScene(random));
  const reducedMotion = usePrefersReducedMotion();
  const step = useShowStep(!reducedMotion);
  const clips = ['Wave', plan.extraClip, 'Idle'];
  const animation = reducedMotion ? 'Idle' : clips[step % clips.length]!;
  const avatar = plan.avatars[Math.floor(step / 2) % plan.avatars.length]!;

  return (
    <WorldCanvas
      label={label}
      role="img"
      framing="preview"
      scopeKey={SCOPE_KEY}
      hostClassName="h-full"
      canvasClassName="h-full w-full"
      loading={null}
      onUnavailable={onUnavailable}
    >
      <color attach="background" args={[BACKGROUND]} />
      <WarmLighting />
      <Character
        avatar={avatar}
        animation={animation}
        onUnavailable={onUnavailable}
      />
      {plan.pieces.map((piece) => (
        <GlbAsset
          key={piece.url}
          url={piece.url}
          scopeKey={SCOPE_KEY}
          position={piece.position}
          scale={piece.scale}
          // An empty element: `null` would draw the placeholder box.
          errorFallback={<></>}
        />
      ))}
    </WorldCanvas>
  );
}
