import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import type { Waypoint } from '../movement';

/** Coral from the art-direction palette: it reads on the warm floor. */
const MARKER_COLOR = '#E66861';
/** Just above the floor rugs (<= 0.012) so it never z-fights with them. */
const MARKER_HEIGHT = 0.02;

export interface DestinationMarker {
  /** Flat ring; mutate through `show`/`hide`, never from React state. */
  readonly object: Mesh<RingGeometry, MeshBasicMaterial>;
  show: (point: Waypoint) => void;
  hide: () => void;
  dispose: () => void;
}

/** Small flat ring that marks the click destination while it is active. */
export function createDestinationMarker(): DestinationMarker {
  const geometry = new RingGeometry(0.16, 0.24, 32);
  const material = new MeshBasicMaterial({
    color: MARKER_COLOR,
    side: DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const object = new Mesh(geometry, material);
  object.name = 'destination-marker';
  object.rotation.x = -Math.PI / 2;
  object.visible = false;
  // Never swallow the pointer rays meant for the floor.
  object.raycast = () => undefined;
  return {
    object,
    show(point) {
      object.position.set(point.x, MARKER_HEIGHT, point.z);
      object.visible = true;
    },
    hide() {
      object.visible = false;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
