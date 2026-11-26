import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimationMixer,
  BoxGeometry,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
  type Skeleton,
  type SkinnedMesh,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { evictRejectedGlbAsset, loadGlbAsset } from '../asset-cache';
import { placeAvatar } from '../classroom/local-avatar-frame';
import type { NpcLivePositions } from '../classroom/npc-live-position';
import type { Pose } from '../movement';
import { usePrefersReducedMotion } from '../use-prefers-reduced-motion';
import { createIdleInvalidator } from './idle-invalidator';
import { mergeSkinnedByMaterial } from './merge-skinned-by-material';
import { advanceNpc } from './npc-frame';
import { PET_NPC_ID, type NpcView } from './npc-view';
import {
  PET_MORPH_NAMES,
  petCrossfadeSeconds,
  petRestLift,
  planPetClip,
  resolvePetPlan,
  type PetMorphWeights,
  type PetMotion,
  type PetResolvedPlan,
} from './pet-clips';
import {
  PET_ONE_SHOT_SECONDS,
  petProceduralFrame,
  petStaticMorphs,
  type PetProceduralFrame,
} from './pet-procedural';

export const PET_URL = '/models/pets/cat/body.glb';
/** Rate (1/s) at which the cushion lift eases in and out. */
const LIFT_RATE = 8;
const LIFT_EPSILON = 0.001;

export interface ClassroomPetHandle {
  /** Root group: moves with the cat and carries the `pet` pick tag. */
  readonly group: Group;
}

export interface ClassroomPetProps {
  /** Synced state of the pet; the component only renders and never mutates it. */
  readonly npc: NpcView;
  readonly scopeKey?: string | undefined;
  /** Receives the cat's live floor position every frame (proximity, highlight). */
  readonly positions?: NpcLivePositions | undefined;
  /** Fired once the model is loaded (tests, debugging). */
  readonly onReady?: ((handle: ClassroomPetHandle) => void) | undefined;
  /** Fired when loading the pet GLB fails so the scene can surface recovery. */
  readonly onError?: ((error: unknown) => void) | undefined;
}

interface PetVisual {
  readonly model: Object3D;
  readonly mixer: AnimationMixer;
  readonly clips: readonly AnimationClip[];
  readonly clipNames: readonly string[];
  /** Meshes carrying facial morph targets (`Pet_Eyes`, `Pet_Mouth`). */
  readonly morphMeshes: readonly Mesh[];
  active: AnimationAction | null;
  /** Clips blending out; stopped when their blend ends. */
  fading: { action: AnimationAction; left: number }[];
  /** The mixer must step once to restore the rest pose of stopped clips. */
  restore: boolean;
}

interface MotionState {
  resolved: PetResolvedPlan;
  elapsed: number;
}

const IDLE_PLAN: PetResolvedPlan = {
  motion: 'idle',
  clip: null,
  loop: false,
  morphs: {},
  source: 'procedural',
};

/** Debug tags of what the cat is doing (tests, devtools). */
function tagMotion(
  group: Object3D,
  resolved: PetResolvedPlan,
  motion: PetMotion,
): void {
  group.userData.activeClip = resolved.source === 'clip' ? resolved.clip : '';
  group.userData.petMotion = motion;
  group.userData.petSource = resolved.source;
}

function release(visual: PetVisual, fadeSeconds: number): void {
  const previous = visual.active;
  visual.active = null;
  if (!previous) return;
  if (fadeSeconds > 0) {
    previous.fadeOut(fadeSeconds);
    visual.fading.push({ action: previous, left: fadeSeconds });
  } else {
    previous.stop();
  }
  visual.restore = true;
}

function playClip(
  visual: PetVisual,
  resolved: PetResolvedPlan,
  fadeSeconds: number,
): void {
  const clip = visual.clips.find((item) => item.name === resolved.clip);
  if (!clip) return;
  const next = visual.mixer.clipAction(clip);
  // Re-requested while blending out: cancel its pending stop.
  visual.fading = visual.fading.filter((item) => item.action !== next);
  next.reset();
  next.setLoop(
    resolved.loop ? LoopRepeat : LoopOnce,
    resolved.loop ? Infinity : 1,
  );
  next.clampWhenFinished = !resolved.loop;
  next.timeScale = 1;
  const previous = visual.active;
  next.play();
  if (previous && previous !== next) {
    if (fadeSeconds > 0) {
      previous.crossFadeTo(next, fadeSeconds, false);
      visual.fading.push({ action: previous, left: fadeSeconds });
    } else {
      previous.stop();
      visual.restore = true;
    }
  }
  visual.active = next;
}

/** Puts the cat's body at the lift plus the procedural offsets (none for a clip). */
function poseHolder(
  holder: Object3D,
  lift: number,
  pose: PetProceduralFrame | null,
): void {
  holder.position.y = lift + (pose?.offsetY ?? 0);
  holder.rotation.x = pose?.pitch ?? 0;
  holder.rotation.z = pose?.roll ?? 0;
  holder.scale.y = pose?.scaleY ?? 1;
}

function applyMorphs(meshes: readonly Mesh[], weights: PetMorphWeights): void {
  for (const mesh of meshes) {
    const dictionary = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    if (!dictionary || !influences) continue;
    for (const name of PET_MORPH_NAMES) {
      const index = dictionary[name];
      if (index !== undefined) influences[index] = weights[name];
    }
  }
}

function collectMorphMeshes(model: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.morphTargetDictionary) return;
    if (PET_MORPH_NAMES.some((name) => name in mesh.morphTargetDictionary!)) {
      meshes.push(mesh);
    }
  });
  return meshes;
}

/**
 * Michi the classroom cat (`docs/art/classroom-pet.md`), driven only by its
 * synced `NpcView`. Clips are resolved by name (`Walk`, `Sleep`, `Meow`,
 * `AskForPets`); a clip the GLB lacks falls back to procedural motion and
 * facial morphs, and idle (no clip exists) is a procedural breath and blink on
 * the rest pose. Position glides on refs inside `useFrame`, the live position
 * is published for proximity/highlight, and a hidden proxy box keeps picking
 * cheap (the skinned model never raycasts). Render it under the scene root.
 */
export function ClassroomPet({
  npc,
  scopeKey,
  positions,
  onReady,
  onError,
}: ClassroomPetProps) {
  const reducedMotion = usePrefersReducedMotion();
  const invalidate = useThree((state) => state.invalidate);
  const frameloop = useThree((state) => state.frameloop);
  // The mixer's `finished` listener outlives renders; it reads the live value.
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  });

  const root = useMemo(() => {
    const group = new Group();
    group.name = 'classroom-pet';
    group.userData.placeholder = 'pet';
    const proxy = new Mesh(
      new BoxGeometry(0.4, 0.5, 0.7),
      new MeshBasicMaterial({ visible: false }),
    );
    proxy.name = 'classroom-pet-proxy';
    proxy.position.y = 0.25;
    group.add(proxy);
    placeAvatar(group, { x: npc.x, z: npc.z, rotation: npc.rotation });
    return group;
    // Created once; the frame loop owns the transform afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const holder = useMemo(() => {
    const group = new Group();
    group.name = 'classroom-pet-model';
    root.add(group);
    return group;
  }, [root]);
  useEffect(
    () => () => {
      const proxy = root.getObjectByName('classroom-pet-proxy') as
        Mesh | undefined;
      proxy?.geometry.dispose();
      (proxy?.material as MeshBasicMaterial | undefined)?.dispose();
    },
    [root],
  );

  const currentRef = useRef<Pose>({
    x: npc.x,
    z: npc.z,
    rotation: npc.rotation,
  });
  const targetRef = useRef<Pose>({
    x: npc.x,
    z: npc.z,
    rotation: npc.rotation,
  });
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });
  const visualRef = useRef<PetVisual | null>(null);
  const motionRef = useRef<MotionState>({ resolved: IDLE_PLAN, elapsed: 0 });
  const liftRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready && !reducedMotion && frameloop === 'demand') invalidate();
  }, [ready, reducedMotion, frameloop, invalidate]);

  const idleInvalidator = useMemo(
    () => createIdleInvalidator(invalidate),
    [invalidate],
  );
  useEffect(() => () => idleInvalidator.dispose(), [idleInvalidator]);

  useEffect(() => {
    let cancelled = false;
    const skeletons = new Set<Skeleton>();
    let mergedMeshes: readonly SkinnedMesh[] = [];
    let built: PetVisual | null = null;
    loadGlbAsset(PET_URL, scopeKey === undefined ? {} : { scopeKey }).then(
      (gltf) => {
        if (cancelled) return;
        const model = cloneSkeleton(gltf.scene);
        // Retain private skeletons even when merging detaches their meshes.
        model.traverse((node) => {
          const mesh = node as SkinnedMesh;
          if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
        });
        // Fewer draw calls: same-material skinned parts become one mesh.
        mergedMeshes = mergeSkinnedByMaterial(model);
        model.traverse((node) => {
          // Skinned meshes are costly to raycast; the proxy owns picking.
          node.raycast = () => undefined;
          node.frustumCulled = false;
        });
        holder.add(model);
        const mixer = new AnimationMixer(model);
        const visual: PetVisual = {
          model,
          mixer,
          clips: gltf.animations,
          clipNames: gltf.animations.map((clip) => clip.name),
          morphMeshes: collectMorphMeshes(model),
          active: null,
          fading: [],
          restore: false,
        };
        built = visual;
        mixer.addEventListener('finished', (event) => {
          if (event.action !== visual.active) return;
          // A one-shot ended: settle back into the procedural idle.
          release(visual, petCrossfadeSeconds(reducedMotionRef.current));
          motionRef.current = { resolved: IDLE_PLAN, elapsed: 0 };
          tagMotion(root, IDLE_PLAN, 'idle');
          invalidate();
        });
        visualRef.current = visual;
        setReady(true);
        onReadyRef.current?.({ group: root });
      },
      (error: unknown) => {
        if (cancelled) return;
        evictRejectedGlbAsset(PET_URL, scopeKey);
        onErrorRef.current?.(error);
      },
    );
    return () => {
      cancelled = true;
      if (built) {
        built.mixer.stopAllAction();
        built.mixer.uncacheRoot(built.model);
        holder.remove(built.model);
        for (const merged of mergedMeshes) merged.geometry.dispose();
        for (const skeleton of skeletons) skeleton.dispose();
      }
      visualRef.current = null;
      setReady(false);
    };
  }, [scopeKey, holder, root, invalidate]);

  const { state, emote, reaction, reactionSeq } = npc;
  useEffect(() => {
    const visual = visualRef.current;
    if (!ready || !visual) return;
    const resolved = resolvePetPlan(
      planPetClip({ state, emote, reaction }),
      visual.clipNames,
    );
    const fade = petCrossfadeSeconds(reducedMotion);
    if (resolved.source === 'clip') playClip(visual, resolved, fade);
    else release(visual, fade);
    motionRef.current = { resolved, elapsed: 0 };
    tagMotion(root, resolved, resolved.motion);
    invalidate();
    // `reactionSeq` re-triggers the same clip for a repeated reaction.
  }, [
    ready,
    state,
    emote,
    reaction,
    reactionSeq,
    reducedMotion,
    root,
    invalidate,
  ]);

  const { x, z, rotation, id } = npc;
  useEffect(() => {
    targetRef.current = { x, z, rotation };
    invalidate();
  }, [x, z, rotation, invalidate]);

  useEffect(() => {
    if (positions)
      positions.set(id, { x: currentRef.current.x, z: currentRef.current.z });
    return () => {
      positions?.delete(id);
    };
  }, [positions, id]);

  useFrame((_, dt) => {
    advanceNpc({
      current: currentRef.current,
      target: targetRef.current,
      group: root,
      dt,
      invalidate,
      reducedMotion,
    });
    if (positions) {
      const live = positions.get(PET_NPC_ID);
      if (live) {
        live.x = currentRef.current.x;
        live.z = currentRef.current.z;
      } else {
        positions.set(PET_NPC_ID, {
          x: currentRef.current.x,
          z: currentRef.current.z,
        });
      }
    }

    const visual = visualRef.current;
    if (!visual) return;
    const motion = motionRef.current;
    motion.elapsed += dt;
    const { resolved } = motion;

    // A procedural one-shot settles into idle once its time is up.
    const oneShotDone =
      resolved.source === 'procedural' &&
      (resolved.motion === 'meow' || resolved.motion === 'askForPets') &&
      motion.elapsed >= PET_ONE_SHOT_SECONDS[resolved.motion];
    const effective: PetMotion = oneShotDone ? 'idle' : resolved.motion;
    if (oneShotDone && root.userData.petMotion !== 'idle') {
      tagMotion(root, resolved, 'idle');
    }

    const procedural = resolved.source === 'procedural';
    const pose = procedural
      ? petProceduralFrame(effective, motion.elapsed, reducedMotion)
      : null;
    const morphs = pose ? pose.morphs : petStaticMorphs(resolved.morphs);

    const liftGoal = petRestLift(effective);
    const liftGap = liftGoal - liftRef.current;
    liftRef.current =
      reducedMotion || Math.abs(liftGap) < LIFT_EPSILON
        ? liftGoal
        : liftRef.current + liftGap * (1 - Math.exp(-LIFT_RATE * dt));
    poseHolder(holder, liftRef.current, pose);
    // Written before the mixer so a clip that keys a morph still wins.
    applyMorphs(visual.morphMeshes, morphs);

    for (let i = visual.fading.length - 1; i >= 0; i -= 1) {
      const item = visual.fading[i]!;
      item.left -= dt;
      if (item.left <= 0) {
        item.action.stop();
        visual.fading.splice(i, 1);
        visual.restore = true;
      }
    }
    const clipRunning = visual.active !== null || visual.fading.length > 0;
    if (clipRunning || visual.restore) {
      visual.mixer.update(clipRunning ? dt : 0);
      visual.restore = false;
    }
    // The procedural idle breathes forever; with reduced motion it is still.
    if (
      clipRunning ||
      (procedural && !reducedMotion) ||
      liftRef.current !== liftGoal
    ) {
      // Resting idle and sleep loops are cosmetic: cap their cadence so the
      // demand canvas does not render at the display rate. Walking, one-shots
      // and the lift easing stay full rate.
      const restingLoop =
        (effective === 'idle' || effective === 'sleep') &&
        liftRef.current === liftGoal &&
        visual.fading.length === 0;
      if (restingLoop) {
        idleInvalidator.request();
      } else {
        invalidate();
      }
    }
  });

  return <primitive object={root} />;
}
