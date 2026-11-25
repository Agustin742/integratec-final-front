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
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGlbAsset } from '../asset-cache';
import { dampYaw } from '../classroom/avatar-yaw';
import { placeAvatar } from '../classroom/local-avatar-frame';
import type { NpcLivePositions } from '../classroom/npc-live-position';
import type { Pose } from '../movement';
import { usePrefersReducedMotion } from '../use-prefers-reduced-motion';
import { advanceNpc, BOT_LEAN_RADIANS } from './npc-frame';
import {
  NPC_SPEECH_VISIBLE_MS,
  type NpcSpeech,
  type NpcView,
} from './npc-view';
import {
  BOT_IDLE_CLIP,
  botCrossfadeSeconds,
  planBotClip,
  resolvePlayableClip,
  type BotClipPlan,
} from './tutor-bot-clips';

export const TUTOR_BOT_URL = '/models/bot/tutor-bot.glb';
/** The GLB rests grounded; the hover base floats it a little above the floor. */
const HOVER_HEIGHT = 0.095;
/** Screen-anchor height of the phrase bubble, above the antenna. */
const BUBBLE_HEIGHT = 1.2;
/** Rate (1/s) at which the walking lean eases in and out. */
const LEAN_RATE = 8;
const LEAN_EPSILON = 0.002;

const SCRATCH = new Vector3();

export interface TutorBotHandle {
  /** Root group: moves with the bot and carries the `tutor-bot` pick tag. */
  readonly group: Group;
}

export interface TutorBotProps {
  /** Synced state of the bot; the component only renders and never mutates it. */
  readonly npc: NpcView;
  /** Text for `reaction === 'phrase'`, resolved from the synced phrase id. */
  readonly phraseText?: string | undefined;
  readonly scopeKey?: string | undefined;
  /** Receives the bot's live floor position every frame (proximity, highlight). */
  readonly positions?: NpcLivePositions | undefined;
  /** Phrase to show above the bot, or undefined once it fades. */
  readonly onSpeech?: ((speech: NpcSpeech | undefined) => void) | undefined;
  /** Screen point (0..1, y down) above the bot while a phrase is visible. */
  readonly onSpeechAnchor?:
    ((anchor: { x: number; y: number }) => void) | undefined;
  /** Fired once the model is loaded (tests, debugging). */
  readonly onReady?: ((handle: TutorBotHandle) => void) | undefined;
}

interface BotVisual {
  readonly model: Object3D;
  readonly mixer: AnimationMixer;
  readonly clips: readonly AnimationClip[];
  active: AnimationAction | null;
  activeClip: string;
}

/** Debug tag of the clip in play (tests, devtools). */
function tagActiveClip(group: Object3D, clip: string): void {
  group.userData.activeClip = clip;
}

function setLean(group: Object3D, radians: number): void {
  group.rotation.x = radians;
}

function startClip(
  visual: BotVisual,
  playable: BotClipPlan,
  fadeSeconds: number,
  reducedMotion: boolean,
): void {
  const clip = visual.clips.find((item) => item.name === playable.clip);
  if (!clip) return;
  const next = visual.mixer.clipAction(clip);
  next.reset();
  next.setLoop(
    playable.loop ? LoopRepeat : LoopOnce,
    playable.loop ? Infinity : 1,
  );
  next.clampWhenFinished = !playable.loop;
  // Reduced motion keeps the resting hover still; real messages still play.
  next.timeScale = reducedMotion && playable.clip === BOT_IDLE_CLIP ? 0 : 1;
  const previous = visual.active;
  next.play();
  if (previous && previous !== next) {
    if (fadeSeconds > 0) previous.crossFadeTo(next, fadeSeconds, false);
    else previous.stop();
  }
  // An instant switch must show now: the frame loop may not step the mixer
  // again (frozen hover under reduced motion).
  if (fadeSeconds === 0) visual.mixer.update(0);
  visual.active = next;
  visual.activeClip = playable.clip;
}

/**
 * The roaming tutor bot (`docs/art/tutor-bot.md`), driven only by its synced
 * `NpcView`. The pose glides toward the 20 Hz state on refs inside `useFrame`,
 * the clip follows `planBotClip`, and the live position is published for
 * proximity/highlight. A hidden proxy box keeps picking cheap (the skinned
 * model never raycasts) and the root group carries the `tutor-bot` tag, so
 * clicks resolve to the interactable wherever the bot is. Render it under the
 * scene root and after the follow camera.
 */
export function TutorBot({
  npc,
  phraseText,
  scopeKey,
  positions,
  onSpeech,
  onSpeechAnchor,
  onReady,
}: TutorBotProps) {
  const reducedMotion = usePrefersReducedMotion();
  const invalidate = useThree((state) => state.invalidate);
  // The mixer's `finished` listener outlives renders; it reads the live value.
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  });

  const root = useMemo(() => {
    const group = new Group();
    group.name = 'tutor-bot';
    group.userData.placeholder = 'tutor-bot';
    const proxy = new Mesh(
      new BoxGeometry(0.6, 1, 0.6),
      new MeshBasicMaterial({ visible: false }),
    );
    proxy.name = 'tutor-bot-proxy';
    proxy.position.y = 0.5;
    group.add(proxy);
    placeAvatar(group, { x: npc.x, z: npc.z, rotation: npc.rotation });
    return group;
    // Created once; the frame loop owns the transform afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const holder = useMemo(() => {
    const group = new Group();
    group.name = 'tutor-bot-model';
    group.position.y = HOVER_HEIGHT;
    root.add(group);
    return group;
  }, [root]);
  useEffect(
    () => () => {
      const proxy = root.getObjectByName('tutor-bot-proxy') as Mesh | undefined;
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

  const callbacks = useRef({ onSpeech, onSpeechAnchor, onReady });
  useEffect(() => {
    callbacks.current = { onSpeech, onSpeechAnchor, onReady };
  });
  const visualRef = useRef<BotVisual | null>(null);
  const speakingRef = useRef(false);
  const lastAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const leanTargetRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let built: BotVisual | null = null;
    loadGlbAsset(
      TUTOR_BOT_URL,
      scopeKey === undefined ? {} : { scopeKey },
    ).then(
      (gltf) => {
        if (cancelled) return;
        const model = cloneSkeleton(gltf.scene);
        model.traverse((node) => {
          // Skinned meshes are costly to raycast; the proxy owns picking.
          node.raycast = () => undefined;
          node.frustumCulled = false;
        });
        holder.add(model);
        const mixer = new AnimationMixer(model);
        built = {
          model,
          mixer,
          clips: gltf.animations,
          active: null,
          activeClip: '',
        };
        mixer.addEventListener('finished', (event) => {
          const visual = built;
          if (!visual || event.action !== visual.active) return;
          // A one-shot ended: settle back into the hover.
          startClip(
            visual,
            { clip: BOT_IDLE_CLIP, loop: true, lean: 0 },
            botCrossfadeSeconds(reducedMotionRef.current),
            reducedMotionRef.current,
          );
          tagActiveClip(root, visual.activeClip);
          invalidate();
        });
        visualRef.current = built;
        setReady(true);
        callbacks.current.onReady?.({ group: root });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      if (built) {
        built.mixer.stopAllAction();
        built.mixer.uncacheRoot(built.model);
        holder.remove(built.model);
      }
      visualRef.current = null;
      setReady(false);
    };
  }, [scopeKey, holder, root, invalidate]);

  const { state, emote, reaction, reactionSeq } = npc;
  useEffect(() => {
    const visual = visualRef.current;
    if (!ready || !visual) return;
    const playable = resolvePlayableClip(
      planBotClip({ state, emote, reaction }),
      visual.clips.map((clip) => clip.name),
    );
    if (!playable) return;
    startClip(
      visual,
      playable,
      botCrossfadeSeconds(reducedMotion),
      reducedMotion,
    );
    tagActiveClip(root, visual.activeClip);
    leanTargetRef.current = playable.lean === 1 && !reducedMotion ? 1 : 0;
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

  useEffect(() => {
    if (reaction !== 'phrase' || !phraseText) {
      speakingRef.current = false;
      callbacks.current.onSpeech?.(undefined);
      return;
    }
    speakingRef.current = true;
    lastAnchorRef.current = null;
    callbacks.current.onSpeech?.({
      npcId: id,
      text: phraseText,
      seq: reactionSeq,
    });
    const timer = setTimeout(() => {
      speakingRef.current = false;
      callbacks.current.onSpeech?.(undefined);
    }, NPC_SPEECH_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [reaction, reactionSeq, phraseText, id]);
  useEffect(
    () => () => {
      speakingRef.current = false;
      callbacks.current.onSpeech?.(undefined);
    },
    [],
  );

  useFrame(({ camera }, dt) => {
    advanceNpc({
      current: currentRef.current,
      target: targetRef.current,
      group: root,
      dt,
      invalidate,
      reducedMotion,
    });
    if (positions) {
      const live = positions.get(id);
      if (live) {
        live.x = currentRef.current.x;
        live.z = currentRef.current.z;
      } else {
        positions.set(id, { x: currentRef.current.x, z: currentRef.current.z });
      }
    }

    const lean = holder.rotation.x;
    const leanGoal = leanTargetRef.current * BOT_LEAN_RADIANS;
    if (Math.abs(leanGoal - lean) > LEAN_EPSILON) {
      setLean(holder, dampYaw(lean, leanGoal, dt, LEAN_RATE));
      invalidate();
    } else if (lean !== leanGoal) {
      setLean(holder, leanGoal);
    }

    const visual = visualRef.current;
    const frozenIdle = reducedMotion && visual?.activeClip === BOT_IDLE_CLIP;
    if (visual && !frozenIdle) {
      visual.mixer.update(dt);
      invalidate();
    }

    const anchor = callbacks.current.onSpeechAnchor;
    if (speakingRef.current && anchor) {
      camera.updateMatrixWorld();
      SCRATCH.set(root.position.x, BUBBLE_HEIGHT, root.position.z).project(
        camera,
      );
      if (!Number.isFinite(SCRATCH.x) || !Number.isFinite(SCRATCH.y)) return;
      const ax = SCRATCH.x / 2 + 0.5;
      const ay = 0.5 - SCRATCH.y / 2;
      const last = lastAnchorRef.current;
      if (
        last &&
        Math.abs(ax - last.x) < 1e-4 &&
        Math.abs(ay - last.y) < 1e-4
      ) {
        return;
      }
      lastAnchorRef.current = { x: ax, y: ay };
      anchor({ x: ax, y: ay });
    }
  });

  return <primitive object={root} />;
}
