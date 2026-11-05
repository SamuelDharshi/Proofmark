"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

const NEUTRAL = new THREE.Color("#c9ced8");
const GREEN = new THREE.Color("#3df5a8");
const RED = new THREE.Color("#ff5d5d");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);

/** Story beats by scroll progress: arrive, connect (green), attack (red), revoke (fleet red). */
function stateColor(p: number, out: THREE.Color) {
  const toGreen = ease(range(p, 0.2, 0.32));
  const toRed = ease(range(p, 0.52, 0.6));
  out.copy(NEUTRAL).lerp(GREEN, toGreen).lerp(RED, toRed);
  return out;
}

/** Box outline with a colour we can drive per frame. */
function Outline({ args, mat }: { args: [number, number, number]; mat: (m: THREE.LineBasicMaterial | null) => void }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...args)), [args]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial ref={mat} color="#c9ced8" />
    </lineSegments>
  );
}

function Lattice() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const N = 26;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.35;
    let i = 0;
    for (let x = 0; x < N; x++)
      for (let z = 0; z < N; z++) {
        const wx = (x - N / 2) * 0.62;
        const wz = (z - N / 2) * 0.62 - 4;
        const h = 0.08 + (Math.sin(wx * 0.8 + t) + Math.cos(wz * 0.7 - t)) * 0.06 + 0.08;
        dummy.position.set(wx, -1.9 + h / 2, wz);
        dummy.scale.set(0.34, h, 0.34);
        dummy.updateMatrix();
        ref.current.setMatrixAt(i++, dummy.matrix);
      }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N * N]}>
      <boxGeometry />
      <meshStandardMaterial color="#14171d" emissive="#1c2230" emissiveIntensity={0.6} roughness={0.7} metalness={0.2} />
    </instancedMesh>
  );
}

const PILLAR: [number, number, number] = [0.4, 4.2, 0.4];
const LINTEL: [number, number, number] = [3.9, 0.4, 0.4];
const DOOR: [number, number, number] = [1.1, 3.9, 0.08];

function Gate({ p }: { p: MotionValue<number> }) {
  const left = useRef<THREE.Mesh>(null!);
  const right = useRef<THREE.Mesh>(null!);
    const light = useRef<THREE.PointLight>(null!);
  const mats = useRef<THREE.LineBasicMaterial[]>([]);
  const col = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const v = p.get();
    stateColor(v, col);
    // Doors: closed at rest, open while connected, slam shut on the attack.
    const open = ease(range(v, 0.2, 0.34)) * (1 - ease(range(v, 0.5, 0.55)));
    left.current.position.x = -0.55 - open * 1.1;
    right.current.position.x = 0.55 + open * 1.1;
    light.current.color.copy(col);
    light.current.intensity = 6 + ease(range(v, 0.2, 0.3)) * 10;
    mats.current.forEach((m) => m?.color.copy(col));
  });

  const reg = (i: number) => (m: THREE.LineBasicMaterial | null) => {
    if (m) mats.current[i] = m;
  };

  return (
    <group position={[0, 0.2, 0]}>
      {[-1.75, 1.75].map((x, i) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.4, 4.2, 0.4]} />
          <meshStandardMaterial color="#0f1217" roughness={0.5} metalness={0.6} />
          <Outline args={PILLAR} mat={reg(i)} />
        </mesh>
      ))}
      <mesh position={[0, 2.1, 0]}>
        <boxGeometry args={[3.9, 0.4, 0.4]} />
        <meshStandardMaterial color="#0f1217" roughness={0.5} metalness={0.6} />
        <Outline args={LINTEL} mat={reg(2)} />
      </mesh>
      {[left, right].map((r, i) => (
        <mesh key={i} ref={r} position={[i ? 0.55 : -0.55, -0.05, 0]}>
          <boxGeometry args={[1.1, 3.9, 0.08]} />
          <meshStandardMaterial color="#12161c" roughness={0.4} metalness={0.7} transparent opacity={0.92} />
          <Outline args={DOOR} mat={reg(3 + i)} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 0.5, 1.6]} distance={14} decay={2} intensity={6} />
    </group>
  );
}

function Server({ p }: { p: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null!);
  const shards = useRef<THREE.Mesh[]>([]);
  const rogue = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null!);
  const col = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const v = p.get();
    const t = clock.elapsedTime;
    stateColor(v, col);
    // Z: approach the gate, pass through while green, get pushed back on the attack.
    const approach = ease(range(v, 0.0, 0.42));
    const pushed = ease(range(v, 0.5, 0.6));
    group.current.position.set(0, 0.1 + Math.sin(t * 0.8) * 0.06, THREE.MathUtils.lerp(-9, 3.2, approach) - pushed * 7.4);
    group.current.rotation.y = t * 0.4;
    group.current.rotation.x = Math.sin(t * 0.3) * 0.15;
    coreMat.current.color.copy(col);

    shards.current.forEach((m, i) => {
      if (!m) return;
      const a = t * 0.9 + (i * Math.PI * 2) / 3;
      m.position.set(Math.cos(a) * 1.2, Math.sin(a * 1.3) * 0.35, Math.sin(a) * 1.2);
      m.rotation.set(a, a * 0.7, 0);
    });
    // The rogue tool appears on the attack beat.
    const a = t * 0.9 + (2 * Math.PI * 2) / 3 + 1;
    const s = ease(range(v, 0.5, 0.58));
    rogue.current.scale.setScalar(s * 0.26);
    rogue.current.position.set(Math.cos(a) * 1.2, Math.sin(a * 1.3) * 0.35 + 0.3, Math.sin(a) * 1.2);
    rogue.current.rotation.set(a, a, 0);

    // Scan ring sweeps once while connecting.
    const sweep = range(v, 0.2, 0.34);
    ring.current.position.y = THREE.MathUtils.lerp(-1.2, 1.4, sweep);
    ringMat.current.opacity = Math.sin(sweep * Math.PI) * 0.8;
  });

  return (
    <>
      <group ref={group}>
        <mesh>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshBasicMaterial ref={coreMat} color="#c9ced8" wireframe />
        </mesh>
        <mesh scale={0.62}>
          <boxGeometry />
          <meshStandardMaterial color="#0c0f13" roughness={0.3} metalness={0.8} />
        </mesh>
        {[0, 1].map((i) => (
          <mesh key={i} ref={(m) => void (m && (shards.current[i] = m))} scale={0.2}>
            <octahedronGeometry />
            <meshStandardMaterial color="#e8ebf0" emissive="#9aa1ad" emissiveIntensity={0.4} roughness={0.3} />
          </mesh>
        ))}
        <mesh ref={rogue} scale={0}>
          <octahedronGeometry />
          <meshStandardMaterial color="#ff5d5d" emissive="#ff2d2d" emissiveIntensity={2.4} />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]}>
        <torusGeometry args={[2.1, 0.018, 8, 96]} />
        <meshBasicMaterial ref={ringMat} color="#3df5a8" transparent opacity={0} />
      </mesh>
    </>
  );
}

function Fleet({ p }: { p: MotionValue<number> }) {
  const refs = useRef<THREE.MeshBasicMaterial[]>([]);
  const group = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const v = p.get();
    const show = ease(range(v, 0.68, 0.76));
    group.current.scale.setScalar(show);
    refs.current.forEach((m, i) => {
      if (!m) return;
      const red = ease(range(v, 0.8 + i * 0.045, 0.84 + i * 0.045));
      m.color.copy(GREEN).lerp(RED, red);
    });
    group.current.position.y = -0.9 + Math.sin(clock.elapsedTime) * 0.04;
  });
  return (
    <group ref={group} position={[0, -0.9, 3.4]} scale={0}>
      {[-1.1, 0, 1.1].map((x, i) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0.3, 0.6, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshBasicMaterial ref={(m) => void (m && (refs.current[i] = m))} color="#3df5a8" wireframe />
        </mesh>
      ))}
    </group>
  );
}

function Rig({ p }: { p: MotionValue<number> }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const v = p.get();
    const dolly = ease(range(v, 0.0, 0.3));
    const attack = ease(range(v, 0.5, 0.62));
    const fleet = ease(range(v, 0.7, 0.85));
    const z = THREE.MathUtils.lerp(9.5, 8.2, dolly) + fleet * 1.5;
    const y = THREE.MathUtils.lerp(0.9, 0.6, dolly) + fleet * 1.3;
    const x = Math.sin(v * Math.PI * 1.2) * 1.4 * (1 - fleet) + attack * 1.1;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, x + pointer.x * 0.5, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, y + pointer.y * 0.25, 3, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, z, 3, dt);
    target.set(0, 0.2 - fleet * 0.6, 0);
    camera.lookAt(target);
  });
  return null;
}

/** Keeps the scene in the right half on wide screens so it never sits under the headline. */
function Offset({ children }: { children: React.ReactNode }) {
  const width = useThree((t) => t.size.width);
  return <group position={[width > 960 ? 2.7 : 0, 0, 0]}>{children}</group>;
}

function Backdrop() {
  return (
    <>
      <color attach="background" args={["#0a0b0d"]} />
      <fog attach="fog" args={["#0a0b0d", 9, 26]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 5]} intensity={0.9} />
    </>
  );
}

export default function Scene({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.9, 9.5], fov: 42, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
      aria-hidden
    >
      <Backdrop />
      <Offset>
        <Lattice />
        <Gate p={progress} />
        <Server p={progress} />
        <Fleet p={progress} />
      </Offset>
      <Rig p={progress} />
    </Canvas>
  );
}
