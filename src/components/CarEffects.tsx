import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  Object3D,
  Color,
  Vector3,
  Quaternion,
} from "three";
import type { RapierRigidBody } from "@react-three/rapier";

const MAX_SMOKE = 80;
const MAX_SPARKS = 60;

interface SmokeParticle {
  pos: Vector3;
  vel: Vector3;
  life: number;
  maxLife: number;
  size: number;
}

interface SparkParticle {
  pos: Vector3;
  vel: Vector3;
  life: number;
  maxLife: number;
}

interface EffectsHandle {
  driftIntensity: { current: number };  // 0..1 — how much smoke to spawn
  driftSpawnPositions: { current: Vector3[] }; // rear-wheel world positions to spawn at
  sparkBurst: { current: number }; // increments to trigger a burst
  sparkSpawnPos: { current: Vector3 };
}

interface CarEffectsProps {
  carRef: React.RefObject<RapierRigidBody | null>;
  handle: EffectsHandle;
}

const _dummy = new Object3D();
const _color = new Color();
const _q = new Quaternion();
const _v = new Vector3();

export default function CarEffects({ carRef, handle }: CarEffectsProps) {
  const smokeRef = useRef<InstancedMesh>(null);
  const sparksRef = useRef<InstancedMesh>(null);

  const smokeParticles = useMemo<SmokeParticle[]>(
    () => Array.from({ length: MAX_SMOKE }, () => ({
      pos: new Vector3(),
      vel: new Vector3(),
      life: 0,
      maxLife: 1,
      size: 0.3,
    })),
    []
  );

  const sparkParticles = useMemo<SparkParticle[]>(
    () => Array.from({ length: MAX_SPARKS }, () => ({
      pos: new Vector3(),
      vel: new Vector3(),
      life: 0,
      maxLife: 0.6,
    })),
    []
  );

  const lastSmokeSpawn = useRef(0);
  const lastSparkBurst = useRef(0);

  useFrame((_, dt) => {
    const carRb = carRef.current;
    if (!carRb) return;

    const now = performance.now() / 1000;

    // ---- Spawn smoke at rear wheels while drifting ----
    const driftI = handle.driftIntensity.current;
    if (driftI > 0.15 && now - lastSmokeSpawn.current > 0.03) {
      lastSmokeSpawn.current = now;
      const positions = handle.driftSpawnPositions.current;
      for (const wheelPos of positions) {
        // Find an inactive smoke slot
        for (let i = 0; i < MAX_SMOKE; i++) {
          const p = smokeParticles[i]!;
          if (p.life <= 0) {
            p.pos.copy(wheelPos);
            // Slow upward drift + slight randomness
            p.vel.set(
              (Math.random() - 0.5) * 0.6,
              0.4 + Math.random() * 0.5,
              (Math.random() - 0.5) * 0.6
            );
            p.maxLife = 0.9 + Math.random() * 0.4;
            p.life = p.maxLife;
            p.size = 0.18 + Math.random() * 0.15;
            break;
          }
        }
      }
    }

    // ---- Spark burst trigger ----
    if (handle.sparkBurst.current !== lastSparkBurst.current) {
      lastSparkBurst.current = handle.sparkBurst.current;
      const origin = handle.sparkSpawnPos.current;
      // Spawn 12-18 sparks
      const count = 12 + Math.floor(Math.random() * 7);
      let spawned = 0;
      for (let i = 0; i < MAX_SPARKS && spawned < count; i++) {
        const p = sparkParticles[i]!;
        if (p.life <= 0) {
          p.pos.copy(origin);
          // Outward + upward velocity, fast
          const ang = Math.random() * Math.PI * 2;
          const speed = 4 + Math.random() * 6;
          p.vel.set(
            Math.cos(ang) * speed,
            2 + Math.random() * 4,
            Math.sin(ang) * speed
          );
          p.maxLife = 0.4 + Math.random() * 0.3;
          p.life = p.maxLife;
          spawned++;
        }
      }
    }

    // ---- Update smoke particles ----
    if (smokeRef.current) {
      for (let i = 0; i < MAX_SMOKE; i++) {
        const p = smokeParticles[i]!;
        if (p.life > 0) {
          p.life -= dt;
          p.pos.addScaledVector(p.vel, dt);
          // Slow horizontal drag, vertical buoyancy stays
          p.vel.x *= 0.95;
          p.vel.z *= 0.95;
          const t = 1 - p.life / p.maxLife; // 0 → 1 over lifetime
          const scale = p.size * (0.5 + t * 1.4);
          _dummy.position.copy(p.pos);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.setScalar(scale);
          _dummy.updateMatrix();
          smokeRef.current.setMatrixAt(i, _dummy.matrix);
          // Fade brightness from 0.7 → 0.0 (alpha replaced by additive-style colour fade)
          const a = (1 - t) * 0.55;
          _color.setRGB(0.85, 0.85, 0.88).multiplyScalar(a);
          smokeRef.current.setColorAt(i, _color);
        } else {
          _dummy.scale.setScalar(0);
          _dummy.position.set(0, -1000, 0);
          _dummy.updateMatrix();
          smokeRef.current.setMatrixAt(i, _dummy.matrix);
        }
      }
      smokeRef.current.instanceMatrix.needsUpdate = true;
      if (smokeRef.current.instanceColor) {
        smokeRef.current.instanceColor.needsUpdate = true;
      }
    }

    // ---- Update spark particles ----
    if (sparksRef.current) {
      for (let i = 0; i < MAX_SPARKS; i++) {
        const p = sparkParticles[i]!;
        if (p.life > 0) {
          p.life -= dt;
          p.pos.addScaledVector(p.vel, dt);
          p.vel.y -= 14 * dt; // gravity
          p.vel.x *= 0.97;
          p.vel.z *= 0.97;
          const t = 1 - p.life / p.maxLife;
          const scale = 0.06 * (1 - t * 0.6);
          _dummy.position.copy(p.pos);
          _dummy.scale.setScalar(scale);
          _dummy.updateMatrix();
          sparksRef.current.setMatrixAt(i, _dummy.matrix);
          // Hot orange → red as it cools
          const heat = 1 - t;
          _color.setRGB(1.0, 0.5 + heat * 0.5, 0.05).multiplyScalar(0.8 + heat * 0.6);
          sparksRef.current.setColorAt(i, _color);
        } else {
          _dummy.scale.setScalar(0);
          _dummy.position.set(0, -1000, 0);
          _dummy.updateMatrix();
          sparksRef.current.setMatrixAt(i, _dummy.matrix);
        }
      }
      sparksRef.current.instanceMatrix.needsUpdate = true;
      if (sparksRef.current.instanceColor) {
        sparksRef.current.instanceColor.needsUpdate = true;
      }
    }

    // Quiet unused-var lints
    void _q;
    void _v;
  });

  return (
    <>
      {/* Smoke — soft white quads. Plane facing camera approximated via small sphere. */}
      <instancedMesh ref={smokeRef} args={[undefined, undefined, MAX_SMOKE]} frustumCulled={false}>
        <sphereGeometry args={[1, 7, 6]} />
        <meshBasicMaterial transparent opacity={0.65} depthWrite={false} />
      </instancedMesh>

      {/* Sparks — tiny bright cubes, additive */}
      <instancedMesh ref={sparksRef} args={[undefined, undefined, MAX_SPARKS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0.95} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

export type { EffectsHandle };
