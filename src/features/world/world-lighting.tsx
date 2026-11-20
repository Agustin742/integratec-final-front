/**
 * Soft warm key light with a cool fill, matching the art direction (matte
 * materials, no shadows). Shared by every R3F scene so lighting stays uniform.
 */
export function WarmLighting() {
  return (
    <>
      <ambientLight color="#A9E7F4" intensity={1.2} />
      <directionalLight color="#FFF0D8" position={[4, 8, 3]} intensity={2.5} />
    </>
  );
}
