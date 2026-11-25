import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BoxGeometry,
  Group,
  MeshBasicMaterial,
  OctahedronGeometry,
} from 'three';
import type { ClassroomInteractable } from './classroom-interactables';
import { npcFollowOffset, type NpcLivePositions } from './npc-live-position';
import {
  applyPointerCursor,
  resetBeaconTransform,
  resetPetPosition,
  stepBeaconTransform,
  stepPetHop,
} from './interactable-highlight-helpers';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const HIGHLIGHT_OUTER_COLOR = '#F7D86B';
const HIGHLIGHT_INNER_COLOR = '#FFFDF7';
const OWN_DESK_ACCENT_COLOR = '#62CFC7';

const NOOP_RAYCAST = () => undefined;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

interface FrameOutlineProps {
  readonly centerX: number;
  readonly baseY: number;
  readonly centerZ: number;
  readonly width: number;
  readonly depth: number;
  readonly thickness: number;
  readonly height: number;
  readonly geometry: BoxGeometry;
  readonly material: MeshBasicMaterial;
}

function FrameOutline({
  centerX,
  baseY,
  centerZ,
  width,
  depth,
  thickness,
  height,
  geometry,
  material,
}: FrameOutlineProps) {
  const halfW = width / 2;
  const halfD = depth / 2;
  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        raycast={NOOP_RAYCAST}
        position={[centerX, baseY, centerZ - halfD]}
        scale={[width + thickness, height, thickness]}
      />
      <mesh
        geometry={geometry}
        material={material}
        raycast={NOOP_RAYCAST}
        position={[centerX, baseY, centerZ + halfD]}
        scale={[width + thickness, height, thickness]}
      />
      <mesh
        geometry={geometry}
        material={material}
        raycast={NOOP_RAYCAST}
        position={[centerX - halfW, baseY, centerZ]}
        scale={[thickness, height, depth]}
      />
      <mesh
        geometry={geometry}
        material={material}
        raycast={NOOP_RAYCAST}
        position={[centerX + halfW, baseY, centerZ]}
        scale={[thickness, height, depth]}
      />
    </>
  );
}

interface CornerBracketsProps {
  readonly centerX: number;
  readonly baseY: number;
  readonly centerZ: number;
  readonly width: number;
  readonly depth: number;
  readonly geometry: BoxGeometry;
  readonly accentMaterial: MeshBasicMaterial;
  readonly pipMaterial: MeshBasicMaterial;
}

function CornerBrackets({
  centerX,
  baseY,
  centerZ,
  width,
  depth,
  geometry,
  accentMaterial,
  pipMaterial,
}: CornerBracketsProps) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const arm = Math.min(0.28, width * 0.25, depth * 0.4);
  const thickness = 0.055;
  const height = 0.015;
  const corners = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const;

  return (
    <>
      {corners.map(([sx, sz]) => {
        const cornerX = centerX + sx * halfW;
        const cornerZ = centerZ + sz * halfD;
        return (
          <group key={`${sx}:${sz}`}>
            <mesh
              geometry={geometry}
              material={accentMaterial}
              raycast={NOOP_RAYCAST}
              position={[
                cornerX - (sx * (arm - thickness)) / 2,
                baseY,
                cornerZ,
              ]}
              scale={[arm, height, thickness]}
            />
            <mesh
              geometry={geometry}
              material={accentMaterial}
              raycast={NOOP_RAYCAST}
              position={[
                cornerX,
                baseY,
                cornerZ - (sz * (arm - thickness)) / 2,
              ]}
              scale={[thickness, height, arm]}
            />
            <mesh
              geometry={geometry}
              material={pipMaterial}
              raycast={NOOP_RAYCAST}
              position={[
                cornerX - sx * thickness * 0.9,
                baseY + 0.002,
                cornerZ - sz * thickness * 0.9,
              ]}
              scale={[0.05, height, 0.05]}
            />
          </group>
        );
      })}
    </>
  );
}

export interface InteractableHighlightProps {
  readonly interactablesById: ReadonlyMap<string, ClassroomInteractable>;
  readonly highlightedId?: string | undefined;
  readonly ownDeskIndex?: number | null | undefined;
  readonly sceneRoot: Group;
  readonly petReactionNonce?: number | undefined;
  /** Live spots of roaming NPCs; their highlight follows them. */
  readonly npcPositions?: NpcLivePositions | undefined;
}

/**
 * Renders grayscale-safe 3D selection highlights, the assigned student desk
 * corner frame, pointer cursor feedback, and decorative pet bounce inside the
 * demand-rendered classroom canvas.
 */
export function InteractableHighlight({
  interactablesById,
  highlightedId,
  ownDeskIndex,
  sceneRoot,
  petReactionNonce = 0,
  npcPositions,
}: InteractableHighlightProps) {
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree(
    (state) => state.gl as { domElement?: HTMLElement } | undefined,
  );
  const reducedMotion = useReducedMotion();

  const resources = useMemo(
    () => ({
      unitBox: new BoxGeometry(1, 1, 1),
      beaconOuterGeo: new OctahedronGeometry(0.16, 0),
      beaconInnerGeo: new OctahedronGeometry(0.09, 0),
      goldMaterial: new MeshBasicMaterial({
        color: HIGHLIGHT_OUTER_COLOR,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
      }),
      creamMaterial: new MeshBasicMaterial({
        color: HIGHLIGHT_INNER_COLOR,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      }),
      ownDeskMaterial: new MeshBasicMaterial({
        color: OWN_DESK_ACCENT_COLOR,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      resources.unitBox.dispose();
      resources.beaconOuterGeo.dispose();
      resources.beaconInnerGeo.dispose();
      resources.goldMaterial.dispose();
      resources.creamMaterial.dispose();
      resources.ownDeskMaterial.dispose();
    };
  }, [resources]);

  const highlighted = highlightedId
    ? interactablesById.get(highlightedId)
    : undefined;
  const ownDesk =
    ownDeskIndex !== null && ownDeskIndex !== undefined
      ? interactablesById.get(`student-desk:${ownDeskIndex}`)
      : undefined;

  const beaconGroup = useMemo(() => {
    const group = new Group();
    group.name = 'interactable-beacon';
    return group;
  }, []);
  // Frame, outline and beacon of a roaming NPC ride in this group, shifted each
  // frame by how far the NPC walked from its catalog spot.
  const followGroup = useMemo(() => {
    const group = new Group();
    group.name = 'interactable-follow';
    return group;
  }, []);
  const beaconElapsedRef = useRef(0);
  const beaconPulseActiveRef = useRef(false);
  const lastPetNonceRef = useRef(petReactionNonce);
  const petHopRef = useRef({ active: false, elapsed: 0 });

  useEffect(() => {
    const domElement = gl?.domElement;
    applyPointerCursor(domElement, Boolean(highlighted));
    return () => {
      applyPointerCursor(domElement, false);
    };
  }, [gl, highlighted]);

  useEffect(() => {
    beaconElapsedRef.current = 0;
    if (highlighted) {
      resetBeaconTransform(
        beaconGroup,
        highlighted.worldPosition[0],
        highlighted.beaconHeight,
        highlighted.worldPosition[2],
      );
      beaconPulseActiveRef.current = !reducedMotion;
    } else {
      beaconPulseActiveRef.current = false;
    }
    invalidate();
  }, [beaconGroup, highlighted, ownDesk, reducedMotion, invalidate]);

  useEffect(() => {
    if (petReactionNonce === lastPetNonceRef.current) return;
    lastPetNonceRef.current = petReactionNonce;
    if (petReactionNonce <= 0) return;

    const petGroup = sceneRoot.getObjectByName('classroom-pet');
    if (reducedMotion || !petGroup) {
      resetPetPosition(sceneRoot);
      petHopRef.current.active = false;
      return;
    }
    petHopRef.current = { active: true, elapsed: 0 };
    invalidate();
  }, [petReactionNonce, reducedMotion, sceneRoot, invalidate]);

  useEffect(() => {
    return () => {
      resetPetPosition(sceneRoot);
    };
  }, [sceneRoot]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    let needsMoreFrames = false;

    if (highlighted?.npcId) {
      const [dx, dz] = npcFollowOffset(highlighted, npcPositions);
      followGroup.position.set(dx, 0, dz);
    } else if (followGroup.position.x !== 0 || followGroup.position.z !== 0) {
      followGroup.position.set(0, 0, 0);
    }

    if (highlighted && beaconPulseActiveRef.current) {
      if (reducedMotion) {
        resetBeaconTransform(
          beaconGroup,
          highlighted.worldPosition[0],
          highlighted.beaconHeight,
          highlighted.worldPosition[2],
        );
        beaconPulseActiveRef.current = false;
      } else {
        beaconElapsedRef.current += dt;
        const stillPulsing = stepBeaconTransform(
          beaconGroup,
          highlighted.beaconHeight,
          beaconElapsedRef.current,
        );
        beaconPulseActiveRef.current = stillPulsing;
        if (stillPulsing) {
          needsMoreFrames = true;
        }
      }
    }

    if (petHopRef.current.active) {
      if (reducedMotion) {
        resetPetPosition(sceneRoot);
        petHopRef.current.active = false;
      } else {
        petHopRef.current.elapsed += dt;
        const stillHopping = stepPetHop(sceneRoot, petHopRef.current.elapsed);
        petHopRef.current.active = stillHopping;
        if (stillHopping) {
          needsMoreFrames = true;
        }
      }
    }

    if (needsMoreFrames) {
      invalidate();
    }
  });

  return (
    <>
      {ownDesk && (
        <CornerBrackets
          centerX={ownDesk.worldPosition[0]}
          baseY={ownDesk.worldPosition[1] + 0.015}
          centerZ={ownDesk.worldPosition[2]}
          width={ownDesk.footprint[0] + 0.2}
          depth={ownDesk.footprint[1] + 0.2}
          geometry={resources.unitBox}
          accentMaterial={resources.ownDeskMaterial}
          pipMaterial={resources.creamMaterial}
        />
      )}

      {highlighted && (
        <primitive object={followGroup}>
          <FrameOutline
            centerX={highlighted.worldPosition[0]}
            baseY={highlighted.worldPosition[1] + 0.018}
            centerZ={highlighted.worldPosition[2]}
            width={highlighted.footprint[0] + 0.28}
            depth={highlighted.footprint[1] + 0.28}
            thickness={0.07}
            height={0.016}
            geometry={resources.unitBox}
            material={resources.goldMaterial}
          />
          <FrameOutline
            centerX={highlighted.worldPosition[0]}
            baseY={highlighted.worldPosition[1] + 0.02}
            centerZ={highlighted.worldPosition[2]}
            width={highlighted.footprint[0] + 0.14}
            depth={highlighted.footprint[1] + 0.14}
            thickness={0.032}
            height={0.014}
            geometry={resources.unitBox}
            material={resources.creamMaterial}
          />
          <primitive object={beaconGroup}>
            <mesh
              geometry={resources.beaconOuterGeo}
              material={resources.goldMaterial}
              raycast={NOOP_RAYCAST}
            />
            <mesh
              geometry={resources.beaconInnerGeo}
              material={resources.creamMaterial}
              raycast={NOOP_RAYCAST}
              rotation={[0, Math.PI / 4, 0]}
            />
          </primitive>
        </primitive>
      )}
    </>
  );
}
