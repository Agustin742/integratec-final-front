export { WorldCanvas, type WorldCanvasProps } from './world-canvas';
export {
  PerformanceProbe,
  type PerformanceProbeProps,
} from './performance-probe';
export { PerformanceStatsOverlay } from './performance-stats-overlay';
export { ClassroomScene } from './classroom/classroom-scene';
export {
  ClassroomWorld,
  type ClassroomWorldProps,
} from './classroom/classroom-world';
export {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  resolveInteractableHit,
  type ClassroomInteractable,
  type ClassroomInteractablePanelKey,
  type ClassroomInteractableType,
  type InteractableIntersection,
  type InteractableObjectNode,
  type InteractablePointerEvent,
  type InteractionClass,
} from './classroom/classroom-interactables';
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
export {
  DEFAULT_CELL_SIZE,
  INPUT_DEADZONE,
  directionToward,
  findPath,
  isWalkable,
  stepAvatar,
  type Direction,
  type FindPathOptions,
  type PathFollow,
  type Pose,
  type Waypoint,
} from './movement';
