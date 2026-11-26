import { useDeferredValue } from 'react';
import { AvatarModel, WarmLighting, WorldCanvas } from '@/features/world';
import type { AvatarEquipped } from '@/features/world/avatar/avatar-part-plan';
import { useShowStep } from '@/features/world/preview/use-show-step';
import { usePrefersReducedMotion } from '@/features/world/use-prefers-reduced-motion';
import { describeAvatar, type Avatar } from './avatar-options';
import { profileMessages } from './messages';

/** Frees only the preview's cached avatar files when the preview unmounts. */
const PREVIEW_SCOPE = 'profile-avatar-preview';
/** Same cream as the 2D preview's tray, so the canvas reads as one surface. */
const BACKGROUND = '#FFF9EB';
/** A wave, then a longer rest. */
const SHOW = ['Wave', 'Idle', 'Idle'] as const;

/**
 * Keeps the previous avatar on screen while the files of a new hair or top
 * load, instead of flashing an empty stage for every option change.
 */
function DeferredAvatar({
  avatar,
  equipped,
  animation,
  onBodyError,
}: Pick<AvatarPreview3DProps, 'avatar' | 'equipped' | 'onBodyError'> & {
  readonly animation: string;
}) {
  const shown = useDeferredValue(avatar);
  return (
    <AvatarModel
      avatar={shown}
      equipped={equipped}
      scopeKey={PREVIEW_SCOPE}
      animation={animation}
      fallback={<AvatarPlaceholder />}
      onBodyError={onBodyError}
    />
  );
}

/**
 * Neutral silhouette shown in the scene while the avatar files download, so
 * the canvas is never an empty stage (`rules/3d-world-and-camera.md`).
 */
function AvatarPlaceholder() {
  // Capsule spans y 0.1 to 1.66, inside `AVATAR_FRAME` (-0.05 to 1.8).
  return (
    <mesh position={[0, 0.88, 0]}>
      <capsuleGeometry args={[0.28, 1, 8, 16]} />
      <meshStandardMaterial color="#D8CBB0" roughness={1} />
    </mesh>
  );
}

export interface AvatarPreview3DProps {
  readonly avatar: Avatar;
  /** Accessories of the classroom chosen in the inventory. */
  readonly equipped?: AvatarEquipped | undefined;
  /** WebGL cannot be used (no support, creation failed or context lost). */
  readonly onUnavailable: () => void;
  /** The body file failed, so there is nothing recognizable to draw in 3D. */
  readonly onBodyError: () => void;
}

/**
 * 3D rendering of the draft avatar for the profile form. The host is one
 * decorative image named like the 2D preview; a missing hair or top file only
 * leaves that part out (`AvatarModel`). Loaded lazily, so Three.js stays out of
 * the profile route's main chunk.
 */
export function AvatarPreview3D({
  avatar,
  equipped,
  onUnavailable,
  onBodyError,
}: AvatarPreview3DProps) {
  const reducedMotion = usePrefersReducedMotion();
  const step = useShowStep(!reducedMotion);
  const animation = reducedMotion ? 'Idle' : SHOW[step % SHOW.length]!;
  return (
    <WorldCanvas
      label={`${profileMessages.avatar.previewAlt} ${describeAvatar(avatar)}`}
      role="img"
      framing="avatar"
      scopeKey={PREVIEW_SCOPE}
      canvasClassName="aspect-[4/5] w-full overflow-hidden rounded-xl"
      onUnavailable={onUnavailable}
    >
      <color attach="background" args={[BACKGROUND]} />
      <WarmLighting />
      <DeferredAvatar
        avatar={avatar}
        equipped={equipped}
        animation={animation}
        onBodyError={onBodyError}
      />
    </WorldCanvas>
  );
}
