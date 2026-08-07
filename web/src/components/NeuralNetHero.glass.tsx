/**
 * Frosted-glass backdrop panel behind the neural-net scene.
 * Sits at z = -2.5 without transmission/refraction so the hero stays
 * legible in screenshots and on lower-power GPUs.
 */
export function GlassBackdrop() {
  return (
    <mesh position={[0, 0, -2.5]}>
      <planeGeometry args={[6, 4]} />
      <meshStandardMaterial color="#14212b" transparent opacity={0.74} roughness={0.82} />
    </mesh>
  );
}
