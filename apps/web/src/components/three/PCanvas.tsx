"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

/**
 * The Proofmark P, extruded. Scroll turns it and lights one node per check: ENS, World, Hedera.
 * Renders on demand only, so it costs nothing while the page is still.
 */
const OUTLINE: [number, number][] = [[10, 4], [40, 4], [54, 18], [54, 32], [40, 46], [24, 46], [24, 60], [10, 60]];
const COUNTER: [number, number][] = [[24, 17], [35, 17], [40, 22], [40, 28], [35, 33], [24, 33]];
const S = 1 / 16;
const toV = ([x, y]: [number, number]) => new THREE.Vector2((x - 32) * S, (32 - y) * S);

const NODES = [
  { angle: 0.4, color: "#5298ff" },
  { angle: 2.5, color: "#f4f3f1" },
  { angle: 4.5, color: "#38f997" },
];
const GREY = new THREE.Color("#4a4a4a");

function Mark({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);
  const nodes = useRef<(THREE.Mesh | null)[]>([]);
  const { invalidate } = useThree();

  const geometry = useMemo(() => {
    const shape = new THREE.Shape(OUTLINE.map(toV));
    shape.holes.push(new THREE.Path(COUNTER.map(toV)));
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
      <mesh position={[(31 - 32) * S, (32 - 25) * S, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.95]} />
        <meshStandardMaterial color="#38f997" emissive="#38f997" emissiveIntensity={0.45} roughness={0.3} />
      </mesh>
      {NODES.map((n, i) => (
        <mesh key={i} ref={(m) => { nodes.current[i] = m; }} position={[Math.cos(n.angle) * 2.3, Math.sin(n.angle) * 1.1 - 0.2, Math.sin(n.angle) * 1.6]}>
          <boxGeometry args={[0.42, 0.42, 0.42]} />
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
