import { useEffect, useId, useRef, useState } from 'react';
import { Group, type Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { Button } from '@/components/ui/button';
import { WorldCanvas } from './world-canvas';
import { WarmLighting } from './world-lighting';
import { selectionIntent, type WorldIntent } from './interactions';
import { worldMessages as copy } from './messages';

function ReferenceGeometry({
  onIntent,
}: {
  onIntent: (intent: WorldIntent) => void;
}) {
  const target = useRef<Group>(null);
  // Built once instead of per click: the handler lives on the target group
  // itself, so ancestry only needs the single registered root.
  const roots = useRef(new Map<Object3D, string>());
  useEffect(() => {
    if (target.current) roots.current.set(target.current, 'reference-2m');
  }, []);
  const onSelect = (event: ThreeEvent<MouseEvent>) => {
    const intent = selectionIntent(event.object, roots.current);
    if (intent) {
      event.stopPropagation();
      onIntent(intent);
    }
  };
  return (
    <>
      <color attach="background" args={['#FFF9EB']} />
      <WarmLighting />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 4]} />
        <meshStandardMaterial color="#E9C99B" roughness={0.9} />
      </mesh>
      <mesh position={[-1.5, 0.5, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 24]} />
        <meshStandardMaterial color="#AF7B52" roughness={0.9} />
      </mesh>
      <group ref={target} onClick={onSelect}>
        <mesh position={[1.5, 1, 0]}>
          <capsuleGeometry args={[0.3, 1.4, 8, 24]} />
          <meshStandardMaterial color="#62CFC7" roughness={0.85} />
        </mesh>
      </group>
      {[-2, -1, 0, 1, 2].map((x) => (
        <mesh
          key={x}
          position={[x, 0.005, 1.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.04, 0.3]} />
          <meshStandardMaterial color="#AF7B52" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

export function WorldReference() {
  const heading = useId();
  const [selected, setSelected] = useState(false);
  const onIntent = (intent: WorldIntent) => {
    if (intent.type === 'select' && intent.targetId === 'reference-2m')
      setSelected(true);
  };
  return (
    <section
      aria-labelledby={heading}
      className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-4"
    >
      <h3 id={heading} className="text-xl">
        {copy.title}
      </h3>
      <p>{copy.description}</p>
      <WorldCanvas label={copy.canvas}>
        <ReferenceGeometry onIntent={onIntent} />
      </WorldCanvas>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        onClick={() => onIntent({ type: 'select', targetId: 'reference-2m' })}
      >
        {copy.select}
      </Button>
      <p role="status">{selected ? copy.selected : copy.idle}</p>
    </section>
  );
}
