export { WorldCanvas, type WorldCanvasProps } from './world-canvas';
export {
  PerformanceProbe,
  type PerformanceProbeProps,
} from './performance-probe';
export { PerformanceStatsOverlay } from './performance-stats-overlay';
export { WarmLighting } from './world-lighting';
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
export { resolveAvatarParts, type AvatarParts } from './avatar/avatar-parts';
export {
  composeAvatar,
  type AvatarPartKind,
  type ComposeAvatarInput,
  type ComposedAvatar,
} from './avatar/compose-avatar';
export { AvatarModel, type AvatarModelProps } from './avatar/avatar-model';
