import { useEffect, useMemo } from 'react';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { WarmLighting } from '../world-lighting';
import { buildClassroomScene } from './build-classroom-scene';

/**
 * Placeholder classroom (floor, cutaway walls, desks from the layout and the
 * named prop placeholders) with the shared warm lighting and cream backdrop.
 * Static and shadowless; the object graph is built once per layout and
 * disposed on unmount because `<primitive>` objects are not owned by R3F.
 */
export function ClassroomScene() {
  const scene = useMemo(() => buildClassroomScene(CLASSROOM_LAYOUT), []);
  useEffect(() => () => scene.dispose(), [scene]);
  return (
    <>
      <color attach="background" args={['#FFF9EB']} />
      <WarmLighting />
      <primitive object={scene.root} />
    </>
  );
}
