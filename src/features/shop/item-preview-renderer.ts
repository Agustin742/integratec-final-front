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
import { clearAssetCache, loadGlbAsset } from '@/features/world/asset-cache';

const PREVIEW_SIZE = 256;
const SCOPE_KEY = 'shop-preview';

const thumbnails = new Map<string, Promise<string>>();
let renderer: WebGLRenderer | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getRenderer(): WebGLRenderer {
  if (renderer === null) {
    renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
  }
  return renderer;
}

async function renderOnce(url: string, tint?: string): Promise<string> {
  const gltf = await loadGlbAsset(url, { scopeKey: SCOPE_KEY });
  const gl = getRenderer();
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.6));
  const key = new DirectionalLight(0xfff3dc, 2.4);
  key.position.set(2, 3, 4);
  scene.add(key);

  const model = gltf.scene.clone(true);
  if (tint !== undefined) {
    model.traverse((node) => {
      if (
        node instanceof Mesh &&
        node.material instanceof MeshStandardMaterial
      ) {
        node.material = node.material.clone();
        node.material.color = new Color(tint);
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
  const dataUrl = gl.domElement.toDataURL('image/png');
  scene.remove(model);
  clearAssetCache({ scopeKey: SCOPE_KEY });
  return dataUrl;
}

/**
 * Renders one GLB to a PNG data URL on a single shared offscreen renderer.
 * Renders are serialized and cached per URL, so a grid of cards never owns a
 * live WebGL canvas: each preview is a static `<img>`. `tint` is the item's
 * `metadata.color`, applied to the model's base color.
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
