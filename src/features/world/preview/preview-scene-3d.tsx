import { useState } from 'react';
import { AvatarModel } from '../avatar/avatar-model';
import { GlbAsset } from '../glb-asset';
import { usePrefersReducedMotion } from '../use-prefers-reduced-motion';
import { WorldCanvas } from '../world-canvas';
import { WarmLighting } from '../world-lighting';
import {
  planPreviewScene,
  type PreviewScenePlan,
  type RandomSource,
} from './preview-scene-plan';
import { useShowStep } from './use-show-step';

export { PREVIEW_STEP_MS } from './use-show-step';
/** Own cache scope: leaving the public screens frees every preview model. */
const SCOPE_KEY = 'auth-preview';

/**
 * One draw per page load (and per random source), so coming back to a public
 * screen without reloading shows the same character and scenery.
 */
const plans = new WeakMap<RandomSource, PreviewScenePlan>();
function pagePlan(random: RandomSource): PreviewScenePlan {
  const plan = plans.get(random) ?? planPreviewScene(random);
  plans.set(random, plan);
  return plan;
}

export interface PreviewScene3DProps {
  readonly label: string;
  readonly random?: RandomSource | undefined;
  /** No WebGL, a lost context or a body that cannot load. */
  readonly onUnavailable: () => void;
}

/**
 * Front view of a random character that waves and plays a second gesture, with
 * scenery beside it. Character, outfit and scenery stay the same until the
 * page reloads. Loaded lazily by `PreviewScene`.
 */
export function PreviewScene3D({
  label,
  random = Math.random,
  onUnavailable,
}: PreviewScene3DProps) {
  const [plan] = useState(() => pagePlan(random));
  const reducedMotion = usePrefersReducedMotion();
  const step = useShowStep(!reducedMotion);
  const clips = ['Wave', plan.extraClip, 'Idle'];
  const animation = reducedMotion ? 'Idle' : clips[step % clips.length]!;

  return (
    <WorldCanvas
      label={label}
      role="img"
      framing="preview"
      scopeKey={SCOPE_KEY}
      // The warm backdrop is CSS behind a see-through canvas.
      hostClassName="stage-backdrop h-full"
      transparent
      canvasClassName="h-full w-full"
      loading={null}
      onUnavailable={onUnavailable}
    >
      <WarmLighting />
      <AvatarModel
        avatar={plan.avatar}
        face="happy"
        animation={animation}
        scopeKey={SCOPE_KEY}
        onBodyError={onUnavailable}
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
