import { WorldCanvas, type WorldCanvasProps } from '../world-canvas';
import { ClassroomScene } from './classroom-scene';

export type ClassroomWorldProps = Pick<WorldCanvasProps, 'label' | 'scopeKey'>;

/** The isometric classroom canvas: `WorldCanvas` framed to the room plus its scene. */
export function ClassroomWorld({ label, scopeKey }: ClassroomWorldProps) {
  return (
    <WorldCanvas label={label} scopeKey={scopeKey} framing="classroom">
      <ClassroomScene />
    </WorldCanvas>
  );
}
