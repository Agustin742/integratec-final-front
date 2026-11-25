import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OrthographicCamera } from 'three';
import type { Avatar } from '@/features/profile/avatar-options';
import {
  AvatarModel,
  WarmLighting,
  WorldCanvas,
  resolveAvatarParts,
  type AvatarReadyInfo,
} from '@/features/world';
import { usePrefersReducedMotion } from '@/features/world/use-prefers-reduced-motion';
import { createBlinkScheduler } from './blink-scheduler';
import { createAvatarRig, type AvatarRig } from './call-avatar-rig';
import type { TileRect } from './call-stage-layout';
import { roundedRectsPath, tileRadius } from './rounded-rects-path';
import { useEmotePlayback } from './use-emote-playback';

const SCOPE_KEY = 'call-stage';
const BACKGROUND = '#FFF9EB';
/** World distance between avatars: far beyond the 1 m camera window, so no avatar leaks into a neighbor's viewport. */
const SLOT_SPACING = 4;
/** Head-and-shoulders window: half of the visible height, centered on the upper chest. */
const FRAME_HALF = 0.5;
const FRAME_CENTER_Y = 1.36;

export interface StageTile {
  readonly sessionId: string;
  /** `null` when the appearance is unusable: a neutral placeholder is drawn. */
  readonly avatar: Avatar | null;
  readonly speaking: boolean;
  readonly muted: boolean;
  readonly emote: string;
  readonly emoteSeq: number;
}

export interface CallStageCanvasProps {
  readonly tiles: readonly StageTile[];
  readonly rects: readonly TileRect[];
  readonly width: number;
  readonly height: number;
  readonly getLevel: (sessionId: string) => number;
  readonly onUnavailable: () => void;
}

function Placeholder() {
  return (
    <mesh position={[0, 1.2, 0]}>
      <capsuleGeometry args={[0.28, 0.5, 8, 16]} />
      <meshStandardMaterial color="#D8CBB0" roughness={1} />
    </mesh>
  );
}

function StageAvatar({
  tile,
  slot,
  getLevel,
}: {
  readonly tile: StageTile;
  readonly slot: number;
  readonly getLevel: (sessionId: string) => number;
}) {
  const reduced = usePrefersReducedMotion();
  const [clipNames, setClipNames] = useState<readonly string[]>([]);
  const { animation, morph } = useEmotePlayback({
    emote: tile.emote,
    emoteSeq: tile.emoteSeq,
    clipNames,
    reduced,
  });
  const rig = useRef<AvatarRig | null>(null);
  const morphRef = useRef(morph);
  const blink = useMemo(() => createBlinkScheduler(), []);

  useEffect(() => {
    morphRef.current = morph;
    rig.current?.setExpression(morph);
  }, [morph]);

  const onReady = ({ root, clipNames: names }: AvatarReadyInfo) => {
    rig.current = createAvatarRig(root);
    rig.current.setExpression(morphRef.current);
    setClipNames(names);
  };

  // Priority 1 runs after the animation mixers (priority 0), so the nod is
  // applied on top of this frame's pose; the stage renders at priority 2.
  useFrame((state, dt) => {
    rig.current?.update({
      dt,
      level: tile.speaking && !tile.muted ? getLevel(tile.sessionId) : 0,
      animated: !reduced,
      blink: blink.advance(dt),
    });
    state.invalidate();
  }, 1);

  const fallbackClipsUrl =
    tile.avatar?.bodyId === 'female'
      ? resolveAvatarParts({
          bodyId: 'male',
          hairId: 'afro',
          topId: 'hoodie',
          hairColor: tile.avatar.hairColor,
          clothingColor: tile.avatar.clothingColor,
        }).bodyUrl
      : undefined;

  return (
    <group position={[slot * SLOT_SPACING, 0, 0]}>
      {tile.avatar ? (
        <AvatarModel
          avatar={tile.avatar}
          scopeKey={SCOPE_KEY}
          animation={animation}
          fallbackClipsUrl={fallbackClipsUrl}
          onReady={onReady}
          fallback={<Placeholder />}
          errorFallback={<Placeholder />}
        />
      ) : (
        <Placeholder />
      )}
    </group>
  );
}

/**
 * One scene holds every avatar, one slot each, far apart. The single canvas is
 * rendered once per tile with its own viewport and scissor rect and a camera
 * framed on that slot's head and shoulders.
 */
function StageScene({
  tiles,
  rects,
  getLevel,
}: Pick<CallStageCanvasProps, 'tiles' | 'rects' | 'getLevel'>) {
  const camera = useMemo(
    () =>
      new OrthographicCamera(
        -FRAME_HALF,
        FRAME_HALF,
        FRAME_HALF,
        -FRAME_HALF,
        0.1,
        50,
      ),
    [],
  );
  const rectsRef = useRef(rects);
  useEffect(() => {
    rectsRef.current = rects;
  }, [rects]);

  useFrame(({ gl, scene, size }) => {
    gl.setScissorTest(true);
    rectsRef.current.forEach((rect, slot) => {
      const y = size.height - rect.y - rect.size; // WebGL origin is bottom-left
      gl.setViewport(rect.x, y, rect.size, rect.size);
      gl.setScissor(rect.x, y, rect.size, rect.size);
      camera.position.set(slot * SLOT_SPACING, FRAME_CENTER_Y, 10);
      camera.lookAt(slot * SLOT_SPACING, FRAME_CENTER_Y, 0);
      camera.updateMatrixWorld(true);
      gl.render(scene, camera);
    });
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
  }, 2);

  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <WarmLighting />
      {tiles.slice(0, rects.length).map((tile, slot) => (
        <StageAvatar
          key={tile.sessionId}
          tile={tile}
          slot={slot}
          getLevel={getLevel}
        />
      ))}
    </>
  );
}

/**
 * The stage's only WebGL canvas, absolutely positioned behind the DOM tiles
 * and clipped to their rounded shapes. Loaded lazily so Three.js stays out of
 * the main chunk.
 */
export default function CallStageCanvas({
  tiles,
  rects,
  width,
  height,
  getLevel,
  onUnavailable,
}: CallStageCanvasProps) {
  const radius = rects[0] ? tileRadius(rects[0].size) : 0;
  const clip = roundedRectsPath(rects, radius);
  return (
    <div
      className="absolute inset-0"
      style={{
        width,
        height,
        clipPath: clip ? `path('${clip}')` : 'inset(50%)',
      }}
    >
      <WorldCanvas
        label="Avatares de la llamada"
        role="img"
        framing="follow"
        scopeKey={SCOPE_KEY}
        hostClassName="absolute inset-0"
        canvasClassName="h-full w-full"
        loading={null}
        onUnavailable={onUnavailable}
      >
        <StageScene tiles={tiles} rects={rects} getLevel={getLevel} />
      </WorldCanvas>
    </div>
  );
}
