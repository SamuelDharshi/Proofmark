"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

/**
 * The Proofmark P, extruded. Scroll turns it and lights one node per check: ENS, World, Hedera.
 * Renders on demand only, so it costs nothing while the page is still.
 */
// The logo's 64-unit grid (components/Logo.tsx), y flipped and centred.
const S = 1 / 16;
const X = (x: number) => (x - 33) * S;
const Y = (y: number) => (32 - y) * S;
const BLOCK = { x: X(20), y: Y(50), size: 16 * S };

// One node per check, top to bottom: ENS, World, Hedera.
const NODES = [
  { pos: [2.35, 1.0, 0.3], color: "#5298ff" },
  { pos: [2.35, 0.1, 0.3], color: "#f4f3f1" },
  { pos: [2.35, -0.8, 0.3], color: "#38f997" },
] as const;
const GREY = new THREE.Color("#4a4a4a");

function Mark({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);
  const nodes = useRef<(THREE.Mesh | null)[]>([]);
  const block = useRef<THREE.Mesh>(null);
  const { invalidate } = useThree();

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(X(24), Y(6));
    shape.lineTo(X(38), Y(6));
    shape.absarc(X(38), Y(22), 16 * S, Math.PI / 2, -Math.PI / 2, true);
    shape.lineTo(X(12), Y(38));
    shape.lineTo(X(12), Y(18));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 3 });
    g.translate(0, 0, -0.35);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    const apply = (v: number) => {
      const g = group.current;
      if (!g) return;
      g.rotation.y = -0.62 + v * 1.1;
      g.rotation.x = 0.22 - v * 0.34;
      g.position.y = 0.15 - v * 0.3;
      // The green proof block rises into place as the checks complete.
      const settle = Math.min(1, v * 1.25);
      if (block.current) {
        block.current.position.set(BLOCK.x, BLOCK.y - (1 - settle) * 0.9, (1 - settle) * 0.8);
        block.current.rotation.z = (1 - settle) * 0.5;
      }
      const stage = Math.floor(v * 3.2);
      nodes.current.forEach((m, i) => {
        if (!m) return;
        const on = stage > i;
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.color.copy(on ? new THREE.Color(NODES[i].color) : GREY);
        mat.emissive.copy(on ? new THREE.Color(NODES[i].color) : new THREE.Color("#000"));
        mat.emissiveIntensity = on ? 0.55 : 0;
        m.scale.setScalar(on ? 1.25 : 1);
      });
      invalidate();
    };
    apply(progress.get());
    return progress.on("change", apply);
  }, [progress, invalidate]);

  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#efeeec" roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh ref={block} position={[BLOCK.x, BLOCK.y, 0]}>
        <boxGeometry args={[BLOCK.size, BLOCK.size, 0.86]} />
        <meshStandardMaterial color="#38f997" emissive="#38f997" emissiveIntensity={0.35} roughness={0.35} />
      </mesh>
      {NODES.map((n, i) => (
        <mesh key={i} ref={(m) => { nodes.current[i] = m; }} position={[...n.pos]}>
          <boxGeometry args={[0.36, 0.36, 0.36]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export default function PCanvas({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 0, 9.2], fov: 34 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 6]} intensity={1.7} />
      <directionalLight position={[-6, -2, 3]} intensity={0.3} color="#38f997" />
      <Mark progress={progress} />
    </Canvas>
  );
}
