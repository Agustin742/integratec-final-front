import {
  AmbientLight,
  Box3,
  Color,
  Mesh,
  MeshStandardMaterial,
  DirectionalLight,
  type Object3D,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  clearAssetCache,
  configureKtx2RendererSupport,
  loadGlbAsset,
} from '@/features/world/asset-cache';
import {
  ACCESSORY_TINT_MATERIAL,
  composeAvatar,
  HAIR_TINT_MATERIAL,
  TOP_TINT_MATERIAL,
} from '@/features/world/avatar/compose-avatar';
import type { WornPreviewSource } from './item-preview-source';

const PREVIEW_SIZE = 256;
const SCOPE_KEY = 'shop-preview';
/** Kept while the renderer lives: every style preview reuses the same body. */
const BODY_SCOPE_KEY = 'shop-preview-body';
/** Head bounds in body space, so that any hair style is framed on the head. */
const HEAD_MIN = [-0.36, 0.8, -0.3] as const;
const HEAD_MAX = [0.36, 1.28, 0.35] as const;
const IDLE_DISPOSE_MS = 1500;

const thumbnails = new Map<string, Promise<string>>();
let renderer: WebGLRenderer | null = null;
let contextLost = false;
let queue: Promise<unknown> = Promise.resolve();
let activeJobs = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

export function disposePreviewRenderer(): void {
  clearIdleTimer();
  clearAssetCache({ scopeKey: BODY_SCOPE_KEY });
  if (renderer !== null) {
    const released = renderer;
    renderer = null;
    released.renderLists.dispose();
    released.dispose();
    // `dispose` alone leaves the context alive until garbage collection, and
    // browsers cap how many can exist.
    released.forceContextLoss();
  }
  contextLost = false;
}

function scheduleIdleDispose(): void {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    if (activeJobs === 0) {
      disposePreviewRenderer();
    }
  }, IDLE_DISPOSE_MS);
}

function getRenderer(): WebGLRenderer {
  if (
    renderer !== null &&
    (contextLost || renderer.getContext().isContextLost())
  ) {
    disposePreviewRenderer();
  }
  if (renderer === null) {
    const next = new WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    next.setSize(PREVIEW_SIZE, PREVIEW_SIZE, false);
    next.setPixelRatio(1);
    next.outputColorSpace = SRGBColorSpace;
    next.setClearColor(0x000000, 0);
    next.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      // A released renderer reports its own forced loss later: ignore it.
      if (renderer === next) contextLost = true;
    });
    next.domElement.addEventListener('webglcontextrestored', () => {
      if (renderer === next) contextLost = false;
    });
    configureKtx2RendererSupport(next);
    renderer = next;
  }
  return renderer;
}

/** What one job draws, and how to release what it created for it. */
interface Subject {
  readonly object: Object3D;
  readonly frame: Box3;
  dispose(): void;
}

async function loadModel(url: string, tint?: string): Promise<Subject> {
  const gltf = await loadGlbAsset(url, { scopeKey: SCOPE_KEY });
  // Accessories are skinned: a plain clone would keep the source bones, and
  // unposed bones would misplace both the meshes and the framing box.
  const model = cloneSkeleton(gltf.scene) as typeof gltf.scene;
  model.updateMatrixWorld(true);
  const clonedMaterials: MeshStandardMaterial[] = [];
  if (tint !== undefined) {
    model.traverse((node) => {
      if (
        node instanceof Mesh &&
        node.material instanceof MeshStandardMaterial &&
        node.material.name === ACCESSORY_TINT_MATERIAL
      ) {
        const cloned = node.material.clone();
        cloned.color = new Color(tint);
        clonedMaterials.push(cloned);
        node.material = cloned;
      }
    });
  }
  return {
    object: model,
    frame: new Box3().setFromObject(model),
    dispose: () => clonedMaterials.forEach((material) => material.dispose()),
  };
}

/** Body wearing the part, framed on the part (and on the head for hair). */
async function loadWorn(source: WornPreviewSource): Promise<Subject> {
  const [body, part] = await Promise.all([
    loadGlbAsset(source.bodyUrl, { scopeKey: BODY_SCOPE_KEY }),
    loadGlbAsset(source.url, { scopeKey: SCOPE_KEY }),
  ]);
  // Parts are authored in body space, so their own bounds frame the avatar.
  const placed = cloneSkeleton(part.scene);
  placed.updateMatrixWorld(true);
  const frame = new Box3().setFromObject(placed);
  if (source.part === 'hair') {
    frame.expandByPoint(new Vector3(...HEAD_MIN));
    frame.expandByPoint(new Vector3(...HEAD_MAX));
  }
  const tintMaterial =
    source.part === 'hair' ? HAIR_TINT_MATERIAL : TOP_TINT_MATERIAL;
  const avatar = composeAvatar({
    body: body.scene,
    parts: [
      {
        key: source.part,
        scene: part.scene,
        tints: { [tintMaterial]: source.tint },
      },
    ],
  });
  if (avatar.skippedParts.length > 0) {
    avatar.dispose();
    throw new Error(`Preview part does not fit the body: ${source.url}`);
  }
  avatar.root.updateMatrixWorld(true);
  return { object: avatar.root, frame, dispose: () => avatar.dispose() };
}

async function renderOnce(load: () => Promise<Subject>): Promise<string> {
  clearIdleTimer();
  activeJobs += 1;
  let scene: Scene | null = null;
  let subject: Subject | null = null;
  let gl: WebGLRenderer | null = null;

  try {
    gl = getRenderer();
    subject = await load();
    if (contextLost || gl.getContext().isContextLost()) {
      disposePreviewRenderer();
      throw new Error('WebGL context lost before rendering shop preview.');
    }

    scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 1.6));
    const key = new DirectionalLight(0xfff3dc, 2.4);
    key.position.set(2, 3, 4);
    scene.add(key);
    scene.add(subject.object);

    const center = subject.frame.getCenter(new Vector3());
    const size = subject.frame.getSize(new Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.001) / 2;
    const camera = new PerspectiveCamera(30, 1, 0.01, 100);
    const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.1;
    camera.position.set(
      center.x + distance * 0.45,
      center.y + distance * 0.3,
      center.z + distance * 0.85,
    );
    camera.lookAt(center);
    gl.render(scene, camera);

    if (contextLost || gl.getContext().isContextLost()) {
      disposePreviewRenderer();
      throw new Error('WebGL context lost during shop preview render.');
    }
    return gl.domElement.toDataURL('image/png');
  } finally {
    if (scene !== null && subject !== null) {
      scene.remove(subject.object);
    }
    subject?.dispose();
    gl?.renderLists.dispose();
    clearAssetCache({ scopeKey: SCOPE_KEY });
    activeJobs -= 1;
    if (activeJobs === 0) {
      scheduleIdleDispose();
    }
  }
}

/** Serializes jobs on the single renderer and caches each result. */
function enqueue(
  cacheKey: string,
  load: () => Promise<Subject>,
): Promise<string> {
  const cached = thumbnails.get(cacheKey);
  if (cached) return cached;
  const job = queue.then(() => renderOnce(load));
  queue = job.catch(() => undefined);
  const promise = job.catch((error: unknown) => {
    thumbnails.delete(cacheKey);
    throw error;
  });
  thumbnails.set(cacheKey, promise);
  return promise;
}

/**
 * Renders one GLB to a PNG data URL on a single shared offscreen renderer.
 * Renders are serialized and cached per URL, so a grid of cards never owns a
 * live WebGL canvas: each preview is a static `<img>`. `tint` colors only the
 * `AvatarAccessoryTint` material, as on the avatar.
 */
export function renderGlbThumbnail(
  url: string,
  tint?: string,
): Promise<string> {
  return enqueue(`${url}|${tint ?? ''}`, () => loadModel(url, tint));
}

/** Same as `renderGlbThumbnail`, for a hair style or top worn by a body. */
export function renderWornThumbnail(
  source: WornPreviewSource,
): Promise<string> {
  return enqueue(`${source.bodyUrl}|${source.url}|${source.tint}`, () =>
    loadWorn(source),
  );
}
