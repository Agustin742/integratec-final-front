import { useFrame, useThree } from '@react-three/fiber';
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { AnimationClip, AnimationMixer } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Avatar } from '@/features/profile/avatar-options';
import { evictRejectedGlbAsset, readCachedGlbAsset } from '../asset-cache';
import { usePrefersReducedMotion } from '../use-prefers-reduced-motion';
import { resolveAvatarParts } from './avatar-parts';
import { composeAvatar, type AvatarPartKind } from './compose-avatar';

export interface AvatarModelProps {
  readonly avatar: Avatar;
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

function LoadedAvatar({
  avatar,
  scopeKey,
  position,
  rotation,
  scale,
  animation,
  onPartsSkipped,
}: Omit<AvatarModelProps, 'fallback' | 'errorFallback' | 'onBodyError'>) {
  const parts = resolveAvatarParts(avatar);
  const body = read(parts.bodyUrl, scopeKey);
  const hair = parts.hairUrl ? read(parts.hairUrl, scopeKey) : null;
  const top = parts.topUrl ? read(parts.topUrl, scopeKey) : null;

  // A part that failed stays out of the avatar; evict it on unmount so a
  // later mount retries the download.
  const failedUrls = [
    hair?.status === 'failed' ? parts.hairUrl : null,
    top?.status === 'failed' ? parts.topUrl : null,
  ].filter((url): url is string => url !== null);
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
  const pending = [body, hair, top].flatMap((item) =>
    item?.status === 'pending' ? [item.promise] : [],
  );
  if (pending.length > 0) {
    throw Promise.all(pending.map((promise) => promise.catch(() => undefined)));
  }

  const bodyGltf = (body as Extract<Read, { status: 'ready' }>).gltf;
  const hairGltf = hair?.status === 'ready' ? hair.gltf : null;
  const topGltf = top?.status === 'ready' ? top.gltf : null;
  const { hairColor, clothingColor } = parts;

  const composed = useMemo(
    () =>
      composeAvatar({
        body: bodyGltf.scene,
        hair: hairGltf?.scene,
        top: topGltf?.scene,
        hairColor,
        clothingColor,
      }),
    [bodyGltf, hairGltf, topGltf, hairColor, clothingColor],
  );
  useEffect(() => () => composed.dispose(), [composed]);

  const skipped = [
    ...(parts.hairUrl && !hairGltf ? ['hair' as const] : []),
    ...(parts.topUrl && !topGltf ? ['top' as const] : []),
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
  const mixerRef = useRef<AnimationMixer | null>(null);
  useEffect(() => {
    if (!animation) return;
    const clip = AnimationClip.findByName(bodyGltf.animations, animation);
    if (!clip) return;
    const mixer = new AnimationMixer(composed.root);
    mixer.clipAction(clip).play();
    // Pose the first frame instead of the bind pose (a T-pose); only motion
    // that is allowed keeps advancing it.
    mixer.update(0);
    mixerRef.current = reducedMotion ? null : mixer;
    invalidate();
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(composed.root);
      mixerRef.current = null;
    };
  }, [animation, reducedMotion, bodyGltf, composed, invalidate]);
  // A `demand` loop stops once nothing invalidates it (hidden tab, offscreen
  // host), so an active clip asks for its next frame and for the first frame
  // after the loop resumes.
  useEffect(() => {
    if (mixerRef.current && frameloop === 'demand') invalidate();
  }, [frameloop, invalidate]);
  useFrame((state, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
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
 * Renders a configured avatar (body plus hair and top) from the asset cache.
 * A failing hair or top is omitted; a failing body shows `errorFallback` and
 * calls `onBodyError` (`rules/avatars-and-customization.md`).
 */
export function AvatarModel({
  fallback = null,
  errorFallback = null,
  onBodyError,
  ...rest
}: AvatarModelProps) {
  const { bodyUrl, hairUrl, topUrl } = resolveAvatarParts(rest.avatar);
  const partUrls = [hairUrl, topUrl].filter(
    (url): url is string => url !== null,
  );
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
