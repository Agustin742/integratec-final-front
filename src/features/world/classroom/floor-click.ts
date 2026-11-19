import type { Waypoint } from '../movement';

/** The slice of an R3F pointer event this handler reads. */
export interface FloorClickEvent {
  nativeEvent: { button: number };
  point: { x: number; z: number };
  intersections: readonly { object: { userData: Record<string, unknown> } }[];
  stopPropagation: () => void;
}

/**
 * Turns a click or tap on the classroom into a walk destination. Only the
 * primary button counts, and only when the nearest hit is the walkable floor,
 * so desks and props never leak a destination through to the floor behind
 * them. Returns the accepted destination, or null when nothing was set (a
 * rejected point must show no marker and move nothing).
 */
export function destinationFromFloorClick(
  event: FloorClickEvent,
  setDestination: (point: Waypoint) => boolean,
): Waypoint | null {
  if (event.nativeEvent.button !== 0) return null;
  const nearest = event.intersections[0]?.object;
  if (nearest?.userData.walkableFloor !== true) return null;
  event.stopPropagation();
  const point = { x: event.point.x, z: event.point.z };
  return setDestination(point) ? point : null;
}
