import {
  AmbientLight,
  Box3,
  Color,
  Mesh,
  MeshStandardMaterial,
  DirectionalLight,
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
import { ACCESSORY_TINT_MATERIAL } from '@/features/world/avatar/compose-avatar';

const PREVIEW_SIZE = 256;
const SCOPE_KEY = 'shop-preview';
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
  if (renderer !== null) {
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer = null;
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
      contextLost = true;
    });
    next.domElement.addEventListener('webglcontextrestored', () => {
      contextLost = false;
    });
    configureKtx2RendererSupport(next);
    renderer = next;
  }
  return renderer;
}

async function renderOnce(url: string, tint?: string): Promise<string> {
  clearIdleTimer();
  activeJobs += 1;
  const gl = getRenderer();
  let scene: Scene | null = null;
  let model: Awaited<ReturnType<typeof loadGlbAsset>>['scene'] | null = null;
  const clonedMaterials: MeshStandardMaterial[] = [];

  try {
    const gltf = await loadGlbAsset(url, { scopeKey: SCOPE_KEY });
    if (contextLost || gl.getContext().isContextLost()) {
      disposePreviewRenderer();
      throw new Error('WebGL context lost before rendering shop preview.');
    }

    scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 1.6));
    const key = new DirectionalLight(0xfff3dc, 2.4);
    key.position.set(2, 3, 4);
    scene.add(key);

    // Accessories are skinned: a plain clone would keep the source bones, and
    // unposed bones would misplace both the meshes and the framing box.
    model = cloneSkeleton(gltf.scene) as typeof gltf.scene;
    model.updateMatrixWorld(true);
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
    scene.add(model);
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
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
    if (scene !== null && model !== null) {
      scene.remove(model);
    }
    for (const material of clonedMaterials) {
      material.dispose();
    }
    gl.renderLists.dispose();
    clearAssetCache({ scopeKey: SCOPE_KEY });
    activeJobs -= 1;
    if (activeJobs === 0) {
      scheduleIdleDispose();
    }
  }
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
  const cacheKey = `${url}|${tint ?? ''}`;
  const cached = thumbnails.get(cacheKey);
  if (cached) return cached;
  const job = queue.then(() => renderOnce(url, tint));
  queue = job.catch(() => undefined);
  const promise = job.catch((error: unknown) => {
    thumbnails.delete(cacheKey);
    throw error;
  });
  thumbnails.set(cacheKey, promise);
  return promise;
}
