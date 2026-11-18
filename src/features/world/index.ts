export { WorldCanvas, type WorldCanvasProps } from './world-canvas';
export { WorldReference } from './world-reference';
export { GlbAsset, type GlbAssetProps } from './glb-asset';
export {
  DRACO_DECODER_PATH,
  KTX2_TRANSCODER_PATH,
  clearAssetCache,
  createConfiguredGltfLoader,
  disposeObject3D,
  getAssetCacheSize,
  loadGlbAsset,
} from './asset-cache';
export {
  raycastInteractables,
  selectionIntent,
  type WorldIntent,
} from './interactions';
