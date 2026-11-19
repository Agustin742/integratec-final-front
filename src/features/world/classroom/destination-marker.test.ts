import { describe, expect, test, vi } from 'vitest';
import { createDestinationMarker } from './destination-marker';

describe('createDestinationMarker', () => {
  test('starts hidden and cannot catch pointer rays', () => {
    const marker = createDestinationMarker();
    expect(marker.object.visible).toBe(false);
    expect(marker.object.raycast(null as never, [])).toBeUndefined();
    marker.dispose();
  });

  test('shows flat on the floor at the destination and hides again', () => {
    const marker = createDestinationMarker();
    marker.show({ x: 2, z: -3 });
    expect(marker.object.visible).toBe(true);
    expect(marker.object.position.x).toBe(2);
    expect(marker.object.position.z).toBe(-3);
    expect(marker.object.position.y).toBeGreaterThan(0);
    expect(marker.object.rotation.x).toBeCloseTo(-Math.PI / 2);
    marker.hide();
    expect(marker.object.visible).toBe(false);
    marker.dispose();
  });

  test('disposes its geometry and material', () => {
    const marker = createDestinationMarker();
    const geometry = vi.spyOn(marker.object.geometry, 'dispose');
    const material = vi.spyOn(
      marker.object.material as { dispose: () => void },
      'dispose',
    );
    marker.dispose();
    expect(geometry).toHaveBeenCalled();
    expect(material).toHaveBeenCalled();
  });
});
