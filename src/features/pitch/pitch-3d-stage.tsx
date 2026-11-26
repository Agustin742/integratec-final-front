import { useFrame, useThree } from '@react-three/fiber';
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  AnimationClip,
  AnimationMixer,
  Group,
  MathUtils,
  Vector3,
  type AnimationAction,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Avatar } from '@/features/profile/avatar-options';
import {
  evictRejectedGlbAsset,
  readCachedGlbAsset,
} from '../world/asset-cache';
import {
  planAvatarParts,
  type AvatarEquipped,
} from '../world/avatar/avatar-part-plan';
import { composeAvatar } from '../world/avatar/compose-avatar';
import { resolveClip } from '../world/classroom/local-avatar-frame';
import { GlbAsset } from '../world/glb-asset';
import { WarmLighting } from '../world/world-lighting';
import { PitchCameraRig } from './pitch-camera-rig';
import {
  PITCH_CAST,
  PITCH_PROP_SPECS,
  type PitchActorId,
  type PitchActorState,
  type PitchBeat,
  type PitchFocusKey,
  type PitchSceneMode,
} from './pitch-script';

export const PITCH_SCOPE_KEY = 'pitch-deck';

const AVATAR_CROSSFADE_SECONDS = 0.36;
const DECOR_PLANTS_URL =
  '/models/scenes/classroom/decoration/plants-and-pots.glb';
const DECOR_GLOBE_URL = '/models/scenes/classroom/decoration/globe.glb';
const STUDENT_DESK_URL = '/models/scenes/classroom/furniture/student-desk.glb';
const STUDENT_CHAIR_URL =
  '/models/scenes/classroom/furniture/student-chair.glb';

const ACT_ACCENT_HEX: Readonly<Record<PitchBeat['act'], string>> = {
  1: '#75B7DA',
  2: '#62CFC7',
  3: '#F7D86B',
  4: '#65B96A',
};

const ORB_ANCHORS: readonly {
  readonly base: readonly [number, number, number];
  readonly radius: number;
  readonly speed: number;
  readonly phase: number;
}[] = [
  { base: [-5.4, 1.55, -3.3], radius: 0.14, speed: 1.1, phase: 0 },
  { base: [5.4, 1.65, -3.1], radius: 0.16, speed: 0.9, phase: 1.4 },
  { base: [-5.3, 1.05, 2.4], radius: 0.12, speed: 1.3, phase: 2.3 },
  { base: [5.3, 1.15, 2.4], radius: 0.13, speed: 1.0, phase: 3.7 },
  { base: [-1.6, 2.85, -3.8], radius: 0.14, speed: 0.85, phase: 4.5 },
  { base: [1.9, 2.75, -3.7], radius: 0.12, speed: 1.25, phase: 5.2 },
];

/** Damps an angle in radians along the shortest arc (`[-PI, PI]`) to prevent 360° spins. */
function dampAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  const delta =
    MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) -
    Math.PI;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export interface Pitch3DStageProps {
  readonly beat: PitchBeat;
  readonly actorOverrides?: Partial<
    Record<
      PitchActorId,
      {
        readonly avatar?: Partial<Avatar>;
        readonly equipped?: AvatarEquipped;
      }
    >
  >;
  readonly getBubbleElement?: (actorId: PitchActorId) => HTMLDivElement | null;
  /** Temporary close-up framing that replaces the beat camera while set. */
  readonly cameraOverride?: PitchBeat['camera'] | null;
  /** Active close-up focus key in the automatic slide camera tour, if any. */
  readonly focusedKey?: PitchFocusKey | null;
}

class AvatarErrorBoundary extends Component<
  {
    readonly url: string;
    readonly partUrls: readonly string[];
    readonly children: ReactNode;
  },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    evictRejectedGlbAsset(this.props.url, PITCH_SCOPE_KEY);
    for (const url of this.props.partUrls) {
      evictRejectedGlbAsset(url, PITCH_SCOPE_KEY);
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Read =
  | { readonly status: 'ready'; readonly gltf: GLTF }
  | { readonly status: 'pending'; readonly promise: Promise<unknown> }
  | { readonly status: 'failed'; readonly error: unknown };

function readAsset(url: string): Read {
  try {
    return {
      status: 'ready',
      gltf: readCachedGlbAsset(url, { scopeKey: PITCH_SCOPE_KEY }),
    };
  } catch (thrown) {
    if (thrown instanceof Promise) {
      return { status: 'pending', promise: thrown };
    }
    return { status: 'failed', error: thrown };
  }
}

const gltfIds = new WeakMap<GLTF, number>();
let nextGltfId = 0;
function gltfId(gltf: GLTF): number {
  let id = gltfIds.get(gltf);
  if (id === undefined) {
    id = nextGltfId++;
    gltfIds.set(gltf, id);
  }
  return id;
}

function LoadedPitchAvatar({
  avatar,
  equipped,
  animation,
  walkingRef,
}: {
  readonly avatar: Avatar;
  readonly equipped?: AvatarEquipped;
  readonly animation: string;
  readonly walkingRef: { readonly current: boolean };
}) {
  const plan = planAvatarParts(avatar, equipped);
  const body = readAsset(plan.bodyUrl);
  const reads = plan.parts.map((part) => readAsset(part.url));

  const failedUrls = plan.parts.flatMap((part, index) =>
    reads[index]?.status === 'failed' ? [part.url] : [],
  );
  const failedKey = failedUrls.join('|');
  useEffect(() => {
    return () => {
      if (failedKey === '') return;
      for (const url of failedKey.split('|')) {
        evictRejectedGlbAsset(url, PITCH_SCOPE_KEY);
      }
    };
  }, [failedKey]);

  if (body.status === 'failed') throw body.error;
  const pending = [body, ...reads].flatMap((item) =>
    item.status === 'pending' ? [item.promise] : [],
  );
  if (pending.length > 0) {
    throw Promise.all(pending.map((promise) => promise.catch(() => undefined)));
  }

  const bodyGltf = (body as Extract<Read, { status: 'ready' }>).gltf;
  const loaded = plan.parts.flatMap((part, index) => {
    const item = reads[index];
    return item?.status === 'ready' ? [{ part, gltf: item.gltf }] : [];
  });
  const compositionKey = JSON.stringify(
    loaded.map(({ part, gltf }) => [
      part.key,
      gltfId(gltf),
      part.tints,
      part.hiddenMeshes,
      part.morphs,
    ]),
  );

  const composed = useMemo(
    () =>
      composeAvatar({
        body: bodyGltf.scene,
        parts: loaded.map(({ part, gltf }) => ({
          key: part.key,
          scene: gltf.scene,
          tints: part.tints,
          hiddenMeshes: part.hiddenMeshes,
          morphs: part.morphs,
        })),
      }),
    // `loaded` is fully described by `compositionKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bodyGltf, compositionKey],
  );
  useEffect(() => () => composed.dispose(), [composed]);

  const clipNames = useMemo(
    () => bodyGltf.animations.map((clip) => clip.name),
    [bodyGltf],
  );

  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionRef = useRef<AnimationAction | null>(null);
  const activeClipNameRef = useRef<string | null>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const mixer = new AnimationMixer(composed.root);
    mixerRef.current = mixer;
    activeClipNameRef.current = null;
    actionRef.current = null;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(composed.root);
      mixerRef.current = null;
      actionRef.current = null;
      activeClipNameRef.current = null;
    };
  }, [composed]);

  useEffect(() => {
    invalidate();
  }, [animation, invalidate]);

  useFrame((state, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;

    const desired = walkingRef.current ? 'Walk' : animation;
    const resolvedName = resolveClip(desired, clipNames);

    if (resolvedName && resolvedName !== activeClipNameRef.current) {
      const clip = AnimationClip.findByName(bodyGltf.animations, resolvedName);
      if (clip) {
        const nextAction = mixer.clipAction(clip);
        const previous = actionRef.current;
        if (previous && previous !== nextAction) {
          nextAction.enabled = true;
          nextAction.setEffectiveTimeScale(1);
          nextAction.setEffectiveWeight(1);
          nextAction.time = 0;
          previous.crossFadeTo(nextAction, AVATAR_CROSSFADE_SECONDS, false);
          nextAction.play();
        } else {
          nextAction.reset().play();
        }
        actionRef.current = nextAction;
        activeClipNameRef.current = resolvedName;
      }
    }

    mixer.update(Math.min(delta, 0.05));
    state.invalidate();
  });

  return <primitive object={composed.root} />;
}

function PitchAnimatedAvatar({
  avatar,
  equipped,
  animation,
  walkingRef,
}: {
  readonly avatar: Avatar;
  readonly equipped?: AvatarEquipped;
  readonly animation: string;
  readonly walkingRef: { readonly current: boolean };
}) {
  const { bodyUrl, parts } = planAvatarParts(avatar, equipped);
  const partUrls = parts.map((part) => part.url);
  return (
    <AvatarErrorBoundary key={bodyUrl} url={bodyUrl} partUrls={partUrls}>
      <Suspense fallback={null}>
        <LoadedPitchAvatar
          avatar={avatar}
          equipped={equipped}
          animation={animation}
          walkingRef={walkingRef}
        />
      </Suspense>
    </AvatarErrorBoundary>
  );
}

function PopInProp({
  children,
  position,
  rotationY,
  accentHex,
  wallMounted = false,
  isFocused = false,
}: {
  readonly children: ReactNode;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly accentHex: string;
  readonly wallMounted?: boolean;
  readonly isFocused?: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Group>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    elapsedRef.current = 0;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(0.02);
    }
  }, []);

  useFrame((state, dt) => {
    const group = groupRef.current;
    if (!group) return;
    elapsedRef.current += Math.min(Number.isFinite(dt) && dt > 0 ? dt : 0, 0.1);
    const t = Math.min(1, elapsedRef.current / 0.52);
    const elastic = t >= 1 ? 1 : 1 - Math.exp(-8 * t) * Math.cos(10 * t);
    const clockTime = state.clock.elapsedTime;
    const focusBoost = isFocused ? 1 + Math.sin(clockTime * 3.4) * 0.035 : 1;
    group.scale.setScalar(Math.max(0.02, elastic * focusBoost));

    // Wall-mounted props stay flush with the wall so they never clip through it.
    group.rotation.y = wallMounted
      ? rotationY
      : rotationY + Math.sin(clockTime * 1.1) * 0.015;

    if (ringRef.current) {
      const pulse =
        (isFocused ? 1.18 : 1) +
        Math.sin(clockTime * (isFocused ? 3.6 : 2.2)) * 0.07;
      ringRef.current.scale.setScalar(pulse);
    }
    state.invalidate();
  });

  const showFloorRing = !wallMounted && position[1] < 0.25;

  return (
    <group position={[position[0], position[1], position[2]]}>
      {showFloorRing && (
        <group
          ref={ringRef}
          position={[0, 0.005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <mesh>
            <ringGeometry args={[0.58, 0.74, 32]} />
            <meshBasicMaterial
              color={isFocused ? '#F7D86B' : accentHex}
              transparent
              opacity={isFocused ? 0.85 : 0.42}
            />
          </mesh>
        </group>
      )}
      <group ref={groupRef} rotation={[0, rotationY, 0]}>
        {children}
      </group>
    </group>
  );
}

function LiveTaskBoard3DGlow() {
  const cardsRef = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (cardsRef.current) {
      cardsRef.current.children.forEach((child, idx) => {
        child.position.y = 0.035 * Math.sin(t * 2.2 + idx * 1.3);
        const s = 1 + 0.04 * Math.sin(t * 2.8 + idx);
        child.scale.set(s, s, 1);
      });
    }
    state.invalidate();
  });

  return (
    <group position={[3.55, 1.55, -3.56]} rotation={[0, 0, 0]}>
      <group ref={cardsRef}>
        <mesh position={[-0.42, 0.14, 0]}>
          <boxGeometry args={[0.36, 0.24, 0.025]} />
          <meshStandardMaterial color="#62CFC7" roughness={0.6} />
        </mesh>
        <mesh position={[0.02, -0.05, 0]}>
          <boxGeometry args={[0.36, 0.24, 0.025]} />
          <meshStandardMaterial color="#F7D86B" roughness={0.6} />
        </mesh>
        <mesh position={[0.45, 0.12, 0]}>
          <boxGeometry args={[0.32, 0.22, 0.025]} />
          <meshStandardMaterial color="#E66861" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function TurntablePedestal({
  position,
  accentColor,
}: {
  readonly position: readonly [number, number, number];
  readonly accentColor: string;
}) {
  const ringRef = useRef<Group>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.9;
    }
    state.invalidate();
  });

  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh position={[0, 0.055, 0]}>
        <cylinderGeometry args={[0.5, 0.56, 0.11, 36]} />
        <meshStandardMaterial color={accentColor} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.64, 0.68, 0.03, 36]} />
        <meshStandardMaterial color="#FFF9EB" roughness={0.7} />
      </mesh>
      <group
        ref={ringRef}
        position={[0, 0.035, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <mesh>
          <ringGeometry args={[0.7, 0.78, 36]} />
          <meshBasicMaterial color="#E66861" transparent opacity={0.62} />
        </mesh>
      </group>
    </group>
  );
}

function MovingPitchActor({
  actorId,
  avatar,
  state,
  equipped,
  phaseOffset,
  sceneMode,
  getBubbleElement,
}: {
  readonly actorId: PitchActorId;
  readonly avatar: Avatar;
  readonly state: PitchActorState;
  readonly equipped?: AvatarEquipped;
  readonly phaseOffset: number;
  readonly sceneMode: PitchSceneMode;
  readonly getBubbleElement?: (actorId: PitchActorId) => HTMLDivElement | null;
}) {
  const groupRef = useRef<Group>(null);
  const walkingRef = useRef(false);
  const initializedRef = useRef(false);
  const lastSceneModeRef = useRef<PitchSceneMode>(sceneMode);
  const spinYawRef = useRef(state.rotationY);
  const headVecRef = useRef(new Vector3());

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const sceneModeChanged = lastSceneModeRef.current !== sceneMode;
    lastSceneModeRef.current = sceneMode;

    const dx = state.position[0] - group.position.x;
    const dz = state.position[2] - group.position.z;
    const dist = Math.hypot(dx, dz);

    // Snap cleanly on first appearance, plane cuts (e.g. entering/leaving showcase-trio),
    // seated desk poses, or long cross-room jumps so characters never perform awkward
    // intermediate steps or clip through furniture.
    const shouldSnapCleanly =
      !initializedRef.current ||
      sceneModeChanged ||
      Boolean(state.turntable) ||
      state.animation === 'SitWrite' ||
      dist > 2.35;

    if (shouldSnapCleanly) {
      group.position.set(
        state.position[0],
        state.position[1],
        state.position[2],
      );
      group.rotation.y = state.rotationY;
      spinYawRef.current = state.rotationY;
      walkingRef.current = false;
      initializedRef.current = true;
    }
  }, [
    sceneMode,
    state.animation,
    state.position,
    state.rotationY,
    state.turntable,
  ]);

  useFrame((frameState, dt) => {
    const group = groupRef.current;
    if (!group) return;
    const clampedDt = Math.min(Number.isFinite(dt) && dt > 0 ? dt : 0, 0.1);
    const dx = state.position[0] - group.position.x;
    const dz = state.position[2] - group.position.z;
    const dist = Math.hypot(dx, dz);

    group.position.y = MathUtils.damp(
      group.position.y,
      state.position[1],
      8,
      clampedDt,
    );

    if (dist > 0.06 && !state.turntable && state.animation !== 'SitWrite') {
      walkingRef.current = true;
      group.position.x = MathUtils.damp(
        group.position.x,
        state.position[0],
        2.85,
        clampedDt,
      );
      group.position.z = MathUtils.damp(
        group.position.z,
        state.position[2],
        2.85,
        clampedDt,
      );
      const walkYaw = Math.atan2(dx, dz);
      group.rotation.y = dampAngle(group.rotation.y, walkYaw, 4.8, clampedDt);
      spinYawRef.current = group.rotation.y;
    } else {
      walkingRef.current = false;
      group.position.x = state.position[0];
      group.position.z = state.position[2];

      if (state.turntable) {
        spinYawRef.current += clampedDt * 0.78;
        group.rotation.y = spinYawRef.current;
      } else {
        const swayYaw =
          state.rotationY +
          Math.sin(frameState.clock.elapsedTime * 1.05 + phaseOffset) * 0.06;
        group.rotation.y = dampAngle(group.rotation.y, swayYaw, 4.2, clampedDt);
        spinYawRef.current = group.rotation.y;
      }
    }

    const bubbleEl = getBubbleElement?.(actorId);
    if (bubbleEl) {
      const settled = dist <= 0.16;
      bubbleEl.dataset.settled = settled ? 'true' : 'false';
      const headHeight = state.animation === 'SitWrite' ? 1.48 : 1.92;
      headVecRef.current.set(
        group.position.x,
        group.position.y + headHeight,
        group.position.z,
      );
      headVecRef.current.project(frameState.camera);
      const xPct = MathUtils.clamp(
        (headVecRef.current.x * 0.5 + 0.5) * 100,
        16,
        84,
      );
      const yPct = MathUtils.clamp(
        (-headVecRef.current.y * 0.5 + 0.5) * 100,
        16,
        72,
      );
      bubbleEl.style.left = `${xPct.toFixed(2)}%`;
      bubbleEl.style.top = `${yPct.toFixed(2)}%`;
    }

    frameState.invalidate();
  });

  const pedestalColor =
    actorId === 'sofia'
      ? '#F7D86B'
      : actorId === 'lucas'
        ? '#62CFC7'
        : actorId === 'docente'
          ? '#B5A7D6'
          : '#F5B5AB';

  return (
    <>
      {state.turntable && (
        <TurntablePedestal
          position={state.position}
          accentColor={pedestalColor}
        />
      )}
      <group ref={groupRef}>
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.38, 24]} />
          <meshBasicMaterial color="#B5A7D6" transparent opacity={0.45} />
        </mesh>
        <PitchAnimatedAvatar
          avatar={avatar}
          equipped={equipped}
          animation={state.animation}
          walkingRef={walkingRef}
        />
      </group>
    </>
  );
}

function AnimatedStageEnvironment({
  isCold,
  showDesks,
  accentHex,
  workTablesFocused,
}: {
  readonly isCold: boolean;
  readonly showDesks: boolean;
  readonly accentHex: string;
  readonly workTablesFocused: boolean;
}) {
  const outerRingRef = useRef<Group>(null);
  const innerRingRef = useRef<Group>(null);
  const orbsRef = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = t * 0.14;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = -t * 0.22;
    }
    if (orbsRef.current) {
      orbsRef.current.children.forEach((child, idx) => {
        const anchor = ORB_ANCHORS[idx];
        if (!anchor) return;
        child.position.y =
          anchor.base[1] + Math.sin(t * anchor.speed + anchor.phase) * 0.22;
        child.rotation.y = t * 0.6 + anchor.phase;
      });
    }
    state.invalidate();
  });

  return (
    <>
      {/* Spacious 11.6m x 7.9m diorama floor so perimeter furniture leaves central plaza open */}
      <group position={[0, -0.06, -0.25]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[11.6, 0.12, 7.9]} />
          <meshStandardMaterial
            color={isCold ? '#353849' : '#E9C99B'}
            roughness={0.92}
          />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[11.9, 0.08, 8.2]} />
          <meshStandardMaterial
            color={isCold ? '#231E29' : '#AF7B52'}
            roughness={0.95}
          />
        </mesh>
      </group>

      {/* Concentric rotating floor rings */}
      <group
        ref={outerRingRef}
        position={[0, 0.002, -0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <mesh>
          <ringGeometry args={[3.5, 3.62, 64]} />
          <meshBasicMaterial
            color={accentHex}
            transparent
            opacity={isCold ? 0.22 : 0.38}
          />
        </mesh>
      </group>
      <group
        ref={innerRingRef}
        position={[0, 0.003, -0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <mesh>
          <ringGeometry args={[2.15, 2.25, 48]} />
          <meshBasicMaterial
            color={isCold ? '#75B7DA' : '#B5A7D6'}
            transparent
            opacity={isCold ? 0.18 : 0.32}
          />
        </mesh>
      </group>

      {/* Warm classroom backdrop walls, circular rug, perimeter desks & cozy props */}
      {!isCold && (
        <>
          <mesh position={[0, 0.003, -0.15]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.65, 40]} />
            <meshStandardMaterial color="#F5B5AB" roughness={0.92} />
          </mesh>

          {/* Back diorama wall (inner face at Z = -3.85) */}
          <group position={[0, 1.45, -3.92]}>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[11.6, 2.6, 0.14]} />
              <meshStandardMaterial color="#FFF9EB" roughness={0.94} />
            </mesh>
            <mesh position={[0, -1.22, 0.01]}>
              <boxGeometry args={[11.6, 0.46, 0.16]} />
              <meshStandardMaterial color="#C88D65" roughness={0.94} />
            </mesh>
            <mesh position={[-3.7, 0.25, 0.08]}>
              <boxGeometry args={[1.7, 1.1, 0.08]} />
              <meshStandardMaterial color="#62CFC7" roughness={0.85} />
            </mesh>
            <mesh position={[-3.7, 0.25, 0.11]}>
              <boxGeometry args={[1.46, 0.86, 0.06]} />
              <meshStandardMaterial color="#A9E7F4" roughness={0.35} />
            </mesh>
          </group>

          {/* Left diorama cutaway wall (inner face at X = -5.65) */}
          <group position={[-5.72, 1.45, -0.25]} rotation={[0, Math.PI / 2, 0]}>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[7.9, 2.6, 0.14]} />
              <meshStandardMaterial color="#FFF0D8" roughness={0.94} />
            </mesh>
            <mesh position={[0, -1.22, 0.01]}>
              <boxGeometry args={[7.9, 0.46, 0.16]} />
              <meshStandardMaterial color="#C88D65" roughness={0.94} />
            </mesh>
          </group>

          {showDesks && (
            <group>
              {workTablesFocused && (
                <mesh
                  position={[-1.85, 0.006, 1.25]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <ringGeometry args={[0.95, 1.15, 36]} />
                  <meshBasicMaterial
                    color="#F7D86B"
                    transparent
                    opacity={0.85}
                  />
                </mesh>
              )}
              <GlbAsset
                url={STUDENT_DESK_URL}
                scopeKey={PITCH_SCOPE_KEY}
                position={[-1.85, 0, 1.15]}
              />
              <GlbAsset
                url={STUDENT_CHAIR_URL}
                scopeKey={PITCH_SCOPE_KEY}
                position={[-1.85, 0, 1.71]}
                rotation={[0, Math.PI, 0]}
              />
              <GlbAsset
                url={STUDENT_DESK_URL}
                scopeKey={PITCH_SCOPE_KEY}
                position={[1.85, 0, 1.15]}
              />
              <GlbAsset
                url={STUDENT_CHAIR_URL}
                scopeKey={PITCH_SCOPE_KEY}
                position={[1.85, 0, 1.71]}
                rotation={[0, Math.PI, 0]}
              />
            </group>
          )}

          <GlbAsset
            url={DECOR_PLANTS_URL}
            scopeKey={PITCH_SCOPE_KEY}
            position={[-4.95, 0, -3.35]}
            rotation={[0, 0.4, 0]}
          />
          <GlbAsset
            url={DECOR_GLOBE_URL}
            scopeKey={PITCH_SCOPE_KEY}
            position={[4.75, 0, -3.25]}
            rotation={[0, -0.5, 0]}
          />
        </>
      )}

      {/* Floating ambient 3D spheres */}
      <group ref={orbsRef}>
        {ORB_ANCHORS.map((orb, idx) => (
          <mesh key={idx} position={[orb.base[0], orb.base[1], orb.base[2]]}>
            <icosahedronGeometry args={[orb.radius, 1]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? accentHex : '#B5A7D6'}
              roughness={0.65}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}

const ACTOR_IDS: readonly PitchActorId[] = [
  'docente',
  'sofia',
  'lucas',
  'mateo',
];

/**
 * Single persistent R3F scene supporting 3 distinct camera planes (wide classroom,
 * 2nd-person station focus, frontal multi-character 360° showcase) with live task board.
 */
export function Pitch3DStage({
  beat,
  actorOverrides,
  getBubbleElement,
  cameraOverride,
  focusedKey,
}: Pitch3DStageProps) {
  const isCold = beat.lighting === 'cold';
  const accentHex = ACT_ACCENT_HEX[beat.act];
  const isTrioShowcase = beat.sceneMode === 'showcase-trio';
  const hasBulletin = beat.props.includes('bulletinBoard');

  return (
    <>
      <color attach="background" args={[isCold ? '#15131E' : '#FFF0D8']} />
      {isCold ? (
        <>
          <ambientLight color="#75B7DA" intensity={0.55} />
          <directionalLight
            color="#A9E7F4"
            position={[2, 6, 3]}
            intensity={1.1}
          />
        </>
      ) : (
        <WarmLighting />
      )}

      <PitchCameraRig
        target={(cameraOverride ?? beat.camera).target}
        visibleHeight={(cameraOverride ?? beat.camera).visibleHeight}
        elevationDeg={(cameraOverride ?? beat.camera).elevationDeg}
        azimuthDeg={(cameraOverride ?? beat.camera).azimuthDeg}
      />

      <AnimatedStageEnvironment
        isCold={isCold}
        showDesks={!isTrioShowcase}
        accentHex={accentHex}
        workTablesFocused={focusedKey === 'workTables'}
      />

      {beat.props.map((propKey) => {
        const spec = PITCH_PROP_SPECS[propKey];
        return (
          <PopInProp
            key={propKey}
            position={spec.position}
            rotationY={spec.rotationY}
            accentHex={accentHex}
            wallMounted={spec.wallMounted}
            isFocused={Boolean(spec.focusKey && focusedKey === spec.focusKey)}
          >
            <GlbAsset url={spec.url} scopeKey={PITCH_SCOPE_KEY} />
          </PopInProp>
        );
      })}

      {hasBulletin && !isCold && <LiveTaskBoard3DGlow />}

      {ACTOR_IDS.map((actorId, idx) => {
        const actorState = beat.actors[actorId];
        if (!actorState) return null;

        const baseAvatar = PITCH_CAST[actorId];
        const override = actorOverrides?.[actorId];
        const mergedAvatar: Avatar = {
          ...baseAvatar,
          ...actorState.avatarOverride,
          ...override?.avatar,
        };
        const mergedEquipped = override?.equipped ?? actorState.equipped;

        return (
          <MovingPitchActor
            key={actorId}
            actorId={actorId}
            avatar={mergedAvatar}
            state={actorState}
            equipped={mergedEquipped}
            phaseOffset={idx * 1.7}
            sceneMode={beat.sceneMode}
            getBubbleElement={getBubbleElement}
          />
        );
      })}
    </>
  );
}
