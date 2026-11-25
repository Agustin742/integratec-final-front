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
  type AnimationAction,
  type Object3D,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Avatar } from '@/features/profile/avatar-options';
import { evictRejectedGlbAsset, readCachedGlbAsset } from '../asset-cache';
import { usePrefersReducedMotion } from '../use-prefers-reduced-motion';
import { resolveClip } from '../classroom/local-avatar-frame';
import { planAvatarParts, type AvatarEquipped } from './avatar-part-plan';
import { composeAvatar, type AvatarPartKind } from './compose-avatar';

/** Blend time between two body clips; short so starting to move feels instant. */
export const AVATAR_CROSSFADE_SECONDS = 0.2;

/** Handed to `onReady` once the avatar is composed. */
export interface AvatarReadyInfo {
  readonly root: Object3D;
  /** Every clip the avatar can play, including `fallbackClipsUrl` ones. */
  readonly clipNames: readonly string[];
}

export interface AvatarModelProps {
  readonly avatar: Avatar;
  /** Equipped accessories by slot (shop item codes), for this classroom. */
  readonly equipped?: AvatarEquipped | undefined;
  readonly scopeKey?: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number | readonly [number, number, number];
  /** Clip name in the body GLB (for example `Idle`); static when absent. */
  readonly animation?: string;
  /** Rendered inside the scene while the files load. */
  readonly fallback?: ReactNode;
  /** Rendered inside the scene when the body cannot load. */
  readonly errorFallback?: ReactNode;
  /** Lets DOM hosts swap to a 2D alternative when the body cannot load. */
  readonly onBodyError?: (error: unknown) => void;
  /** Parts left out because they failed to load or do not fit the body. */
  readonly onPartsSkipped?: (parts: readonly AvatarPartKind[]) => void;
  /**
   * Another body GLB whose clips fill the names the avatar's own body lacks
   * (bodies share the canonical skeleton). Ignored if it fails to load.
   */
  readonly fallbackClipsUrl?: string;
  /** Lets a host drive the composed avatar procedurally (bones, morph targets). */
  readonly onReady?: (info: AvatarReadyInfo) => void;
}

class BodyErrorBoundary extends Component<
  {
    readonly url: string;
    /** Part files evicted with the body, because `LoadedAvatar` may never commit. */
    readonly partUrls: readonly string[];
    readonly scopeKey?: string;
    readonly fallback: ReactNode;
    readonly onError?: (error: unknown) => void;
    readonly children: ReactNode;
  },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    evictRejectedGlbAsset(this.props.url, this.props.scopeKey);
    for (const url of this.props.partUrls) {
      evictRejectedGlbAsset(url, this.props.scopeKey);
    }
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Read =
  | { readonly status: 'ready'; readonly gltf: GLTF }
  | { readonly status: 'pending'; readonly promise: Promise<unknown> }
  | { readonly status: 'failed'; readonly error: unknown };

/** Non-throwing view over the Suspense reader so all files load in parallel. */
function read(url: string, scopeKey: string | undefined): Read {
  try {
    return { status: 'ready', gltf: readCachedGlbAsset(url, { scopeKey }) };
  } catch (thrown) {
    if (thrown instanceof Promise) {
      return { status: 'pending', promise: thrown };
    }
    return { status: 'failed', error: thrown };
  }
}

/** Stable ids so a recomposition key notices a replaced cached asset. */
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

function LoadedAvatar({
  avatar,
  equipped,
  scopeKey,
  position,
  rotation,
  scale,
  animation,
  onPartsSkipped,
  fallbackClipsUrl,
  onReady,
}: Omit<AvatarModelProps, 'fallback' | 'errorFallback' | 'onBodyError'>) {
  // The plan is rebuilt per render, but only its content (not the identity of
  // `equipped`, which realtime recreates on every state patch) drives the
  // composition below.
  const plan = planAvatarParts(avatar, equipped);
  const body = read(plan.bodyUrl, scopeKey);
  const reads = plan.parts.map((part) => read(part.url, scopeKey));
  const extraClips =
    fallbackClipsUrl && fallbackClipsUrl !== plan.bodyUrl
      ? read(fallbackClipsUrl, scopeKey)
      : null;

  // A part that failed stays out of the avatar; evict it on unmount so a
  // later mount retries the download.
  const failedUrls = plan.parts.flatMap((part, index) =>
    reads[index]?.status === 'failed' ? [part.url] : [],
  );
  const failedKey = failedUrls.join('|');
  useEffect(() => {
    return () => {
      if (failedKey === '') return;
      for (const url of failedKey.split('|')) {
        evictRejectedGlbAsset(url, scopeKey);
      }
    };
  }, [failedKey, scopeKey]);

  if (body.status === 'failed') throw body.error;
  const pending = [body, ...reads, extraClips].flatMap((item) =>
    item?.status === 'pending' ? [item.promise] : [],
  );
  if (pending.length > 0) {
    throw Promise.all(pending.map((promise) => promise.catch(() => undefined)));
  }

  const bodyGltf = (body as Extract<Read, { status: 'ready' }>).gltf;
  const extraGltf = extraClips?.status === 'ready' ? extraClips.gltf : null;
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

  const skipped = [
    ...plan.parts.flatMap((part, index) =>
      reads[index]?.status === 'failed' ? [part.key] : [],
    ),
    ...composed.skippedParts,
  ];
  const skippedKey = skipped.join('|');
  const onSkippedRef = useRef(onPartsSkipped);
  useEffect(() => {
    onSkippedRef.current = onPartsSkipped;
  }, [onPartsSkipped]);
  useEffect(() => {
    if (skippedKey !== '') {
      onSkippedRef.current?.(skippedKey.split('|') as AvatarPartKind[]);
    }
  }, [skippedKey, composed]);

  const reducedMotion = usePrefersReducedMotion();
  const invalidate = useThree((state) => state.invalidate);
  const frameloop = useThree((state) => state.frameloop);
  // One mixer lives as long as the composed avatar, so a clip change blends
  // from the running action instead of hard-switching. Hair and top share the
  // body's bones, so this single mixer animates the whole avatar.
  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionRef = useRef<AnimationAction | null>(null);
  /** True while a clip is playing and may advance (never under reduced motion). */
  const advancingRef = useRef(false);
  useEffect(() => {
    const mixer = new AnimationMixer(composed.root);
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(composed.root);
      mixerRef.current = null;
      actionRef.current = null;
      advancingRef.current = false;
    };
  }, [composed]);
  const clips = useMemo(() => {
    const own = bodyGltf.animations;
    if (!extraGltf) return own;
    const names = new Set(own.map((clip) => clip.name));
    return [...own, ...extraGltf.animations.filter((c) => !names.has(c.name))];
  }, [bodyGltf, extraGltf]);
  const clipNames = useMemo(() => clips.map((clip) => clip.name), [clips]);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onReadyRef.current?.({ root: composed.root, clipNames });
  }, [composed, clipNames]);
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const name = resolveClip(animation, clipNames);
    const clip = name ? AnimationClip.findByName(clips, name) : null;
    const previous = actionRef.current;
    if (!clip) {
      mixer.stopAllAction();
      actionRef.current = null;
      advancingRef.current = false;
      invalidate();
      return;
    }
    const next = mixer.clipAction(clip);
    if (next === previous) {
      const wasAdvancing = advancingRef.current;
      advancingRef.current = !reducedMotion;
      if (wasAdvancing && reducedMotion) {
        mixer.stopAllAction();
        next.reset().play();
        mixer.update(0);
        invalidate();
      } else if (!wasAdvancing && !reducedMotion) {
        invalidate();
      }
      return;
    }
    if (previous && !reducedMotion) {
      next.enabled = true;
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(1);
      next.time = 0;
      previous.crossFadeTo(next, AVATAR_CROSSFADE_SECONDS, false);
      next.play();
    } else {
      previous?.stop();
      next.reset().play();
    }
    actionRef.current = next;
    // Pose the first frame instead of the bind pose (a T-pose); only motion
    // that is allowed keeps advancing it.
    mixer.update(0);
    advancingRef.current = !reducedMotion;
    invalidate();
  }, [animation, reducedMotion, clips, clipNames, composed, invalidate]);
  // A `demand` loop stops once nothing invalidates it (hidden tab, offscreen
  // host), so an active clip asks for its next frame and for the first frame
  // after the loop resumes.
  useEffect(() => {
    if (advancingRef.current && frameloop === 'demand') invalidate();
  }, [frameloop, invalidate]);
  useFrame((state, delta) => {
    const mixer = mixerRef.current;
    if (!mixer || !advancingRef.current) return;
    mixer.update(delta);
    state.invalidate();
  });

  return (
    <primitive
      object={composed.root}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

/**
 * Renders a configured avatar (body, hair, top and equipped accessories) from the asset cache.
 * A failing part is omitted; a failing body shows `errorFallback` and
 * calls `onBodyError` (`rules/avatars-and-customization.md`).
 */
export function AvatarModel({
  fallback = null,
  errorFallback = null,
  onBodyError,
  ...rest
}: AvatarModelProps) {
  const { bodyUrl, parts } = planAvatarParts(rest.avatar, rest.equipped);
  const partUrls = parts.map((part) => part.url);
  return (
    <BodyErrorBoundary
      key={`${rest.scopeKey ?? ''}:${bodyUrl}`}
      url={bodyUrl}
      partUrls={partUrls}
      scopeKey={rest.scopeKey}
      fallback={errorFallback}
      onError={onBodyError}
    >
      <Suspense fallback={fallback}>
        <LoadedAvatar {...rest} />
      </Suspense>
    </BodyErrorBoundary>
  );
}
