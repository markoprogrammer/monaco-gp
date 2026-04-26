import { useRef, useCallback, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { Vector3, Quaternion, CatmullRomCurve3 } from "three";
import { useVehicleControls } from "../hooks/useVehicleControls";
import { useEngineSound } from "../hooks/useEngineSound";
import { useCrashSound } from "../hooks/useCrashSound";
import { useDriftSound } from "../hooks/useDriftSound";
import { useGameState } from "../hooks/useGameState";
import { VEHICLE } from "../lib/physics-config";
import { TRACK_POINTS } from "../lib/track-data";
import { registerEntry, unregisterEntry } from "../lib/race-progress";
import CarModel from "./CarModel";
import CarEffects, { type EffectsHandle } from "./CarEffects";

const _forward = new Vector3();
const _right = new Vector3();
const _quat = new Quaternion();

interface CarProps {
  onReady?: (rb: RapierRigidBody) => void;
}

const SPAWN_T = 0.28;
const RESPAWN_SAMPLES = 200;

export default function Car({ onReady }: CarProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const input = useVehicleControls();
  const currentSpeed = useRef(0);
  const updateEngineSound = useEngineSound();
  const playCrash = useCrashSound();
  const updateDriftSound = useDriftSound();
  const setSpeed = useGameState((s) => s.setSpeed);
  const tick = useGameState((s) => s.tick);

  // Wall contact tracking — count of active wall contacts
  const wallContactCount = useRef(0);

  // Effects handle — populated each frame, read by CarEffects
  const effectsHandle = useMemo<EffectsHandle>(() => ({
    driftIntensity: { current: 0 },
    driftSpawnPositions: { current: [new Vector3(), new Vector3()] },
    sparkBurst: { current: 0 },
    sparkSpawnPos: { current: new Vector3() },
  }), []);

  // Race progress entry
  const progressEntry = useMemo(() => registerEntry(true), []);
  useEffect(() => () => unregisterEntry(progressEntry), [progressEntry]);
  const lap = useRef(0);
  const lastT = useRef(SPAWN_T);

  const { spawnPos, spawnRot, trackSamples, curve } = useMemo(() => {
    const c = new CatmullRomCurve3(TRACK_POINTS, true, "catmullrom", 0.5);
    const pt = c.getPointAt(SPAWN_T);
    const tan = c.getTangentAt(SPAWN_T);
    const angle = Math.atan2(tan.x, tan.z) + Math.PI;

    const samples: { x: number; y: number; z: number; angle: number; t: number }[] = [];
    for (let i = 0; i < RESPAWN_SAMPLES; i++) {
      const t = i / RESPAWN_SAMPLES;
      const p = c.getPointAt(t);
      const tn = c.getTangentAt(t);
      samples.push({ x: p.x, y: p.y, z: p.z, angle: Math.atan2(tn.x, tn.z) + Math.PI, t });
    }

    return {
      spawnPos: [pt.x, pt.y + VEHICLE.spawnHeight, pt.z] as [number, number, number],
      spawnRot: [0, angle, 0] as [number, number, number],
      trackSamples: samples,
      curve: c,
    };
  }, []);

  const findNearest = useCallback((x: number, z: number) => {
    let bestD = Infinity;
    let nearest = trackSamples[0]!;
    let bestIdx = 0;
    for (let i = 0; i < trackSamples.length; i++) {
      const s = trackSamples[i]!;
      const d = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (d < bestD) { bestD = d; nearest = s; bestIdx = i; }
    }
    return { nearest, dist: Math.sqrt(bestD), idx: bestIdx };
  }, [trackSamples]);

  const respawn = useCallback((rb: RapierRigidBody) => {
    const pos = rb.translation();
    const { nearest } = findNearest(pos.x, pos.z);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const ha = nearest.angle / 2;
    rb.setTranslation({ x: nearest.x, y: nearest.y + 1, z: nearest.z }, true);
    rb.setRotation({ x: 0, y: Math.sin(ha), z: 0, w: Math.cos(ha) }, true);
    currentSpeed.current = 0;
    wallContactCount.current = 0;
  }, [findNearest]);

  const rbRef = useCallback(
    (node: RapierRigidBody | null) => {
      rigidBody.current = node;
      if (node && onReady) onReady(node);
    },
    [onReady]
  );

  useFrame((_, delta) => {
    const rb = rigidBody.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.05);

    const controls = input.current;

    // Manual respawn on R only
    if (controls.reset) {
      controls.reset = false;
      respawn(rb);
      return;
    }

    // --- Update race progress (using nearest spline sample) ---
    const pos = rb.translation();
    const { idx } = findNearest(pos.x, pos.z);
    const t = idx / RESPAWN_SAMPLES;
    if (lastT.current > 0.85 && t < 0.15) lap.current += 1;
    else if (lastT.current < 0.15 && t > 0.85) lap.current -= 1;
    lastT.current = t;
    progressEntry.progress = lap.current + t;
    progressEntry.speed = Math.abs(currentSpeed.current);

    const inWallContact = wallContactCount.current > 0;

    const rotation = rb.rotation();
    _quat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    _forward.set(0, 0, -1).applyQuaternion(_quat);
    _forward.y = 0;
    _forward.normalize();
    _right.set(_forward.z, 0, -_forward.x);

    let speed = currentSpeed.current;
    const absSpd = Math.abs(speed);

    if (controls.forward) {
      const speedRatio = absSpd / VEHICLE.maxForwardSpeed;
      const accelFactor = (1 - speedRatio) * (0.4 + 0.6 * (1 - speedRatio));
      const accel = VEHICLE.accelerationRate * accelFactor * dt;
      speed += accel;
      const steerInput = (controls.left ? 1 : 0) + (controls.right ? 1 : 0);
      if (steerInput > 0 && absSpd > 15) {
        speed -= accel * 0.4 * (absSpd / VEHICLE.maxForwardSpeed);
      }
    } else if (controls.backward) {
      speed -= VEHICLE.brakeRate * dt;
    } else {
      if (speed > 0) speed = Math.max(0, speed - VEHICLE.coastDecel * dt);
      else if (speed < 0) speed = Math.min(0, speed + VEHICLE.coastDecel * dt);
    }

    if (controls.handbrake && speed > 0) {
      speed = Math.max(0, speed - VEHICLE.handbrakeDecel * dt);
    }

    // Wall scrape — gentle continuous decel while in contact
    if (inWallContact && speed > 0) {
      speed = Math.max(0, speed - VEHICLE.wallScrapeDecel * dt);
    }

    speed = Math.max(-VEHICLE.maxReverseSpeed, Math.min(VEHICLE.maxForwardSpeed, speed));
    currentSpeed.current = speed;

    updateEngineSound(Math.abs(speed) / VEHICLE.maxForwardSpeed);
    setSpeed(Math.abs(speed));
    tick(dt);

    // --- Drift detection: compute lateral slip ratio ---
    const linvel = rb.linvel();
    const lat = Math.abs(linvel.x * _right.x + linvel.z * _right.z);
    const fwd = Math.abs(linvel.x * _forward.x + linvel.z * _forward.z);
    const totalVel = Math.hypot(linvel.x, linvel.z);
    const slipRatio = totalVel > 4 ? lat / (fwd + lat + 0.001) : 0;
    const handbrakeActive = controls.handbrake && Math.abs(speed) > 6;
    // Drift intensity: combination of handbrake state and lateral slip
    const driftI = Math.min(1, (handbrakeActive ? 0.5 : 0) + slipRatio * 1.4);
    effectsHandle.driftIntensity.current = driftI;
    updateDriftSound(driftI, Math.abs(speed) / VEHICLE.maxForwardSpeed);

    // Compute rear-wheel world positions for smoke spawn
    // Local rear-wheel offsets: (±0.82, ground-ish, +1.35) — but car forward = -Z so rear is +Z in local
    const rearLocalZ = 1.35;
    const wheelHalfX = 0.82;
    // pos is rigid body translation (centre); add rotated local offsets
    const rl = effectsHandle.driftSpawnPositions.current[0]!;
    const rr = effectsHandle.driftSpawnPositions.current[1]!;
    rl.set(
      pos.x + (-_forward.x * rearLocalZ) + (-_right.x * wheelHalfX),
      pos.y - 0.25,
      pos.z + (-_forward.z * rearLocalZ) + (-_right.z * wheelHalfX),
    );
    rr.set(
      pos.x + (-_forward.x * rearLocalZ) + (_right.x * wheelHalfX),
      pos.y - 0.25,
      pos.z + (-_forward.z * rearLocalZ) + (_right.z * wheelHalfX),
    );

    const absSpeed = Math.abs(speed);
    const steerDir = (controls.left ? 1 : 0) - (controls.right ? 1 : 0);
    if (steerDir !== 0 && (absSpeed > 0.5 || controls.handbrake)) {
      const speedRatio = absSpeed / VEHICLE.maxForwardSpeed;
      const steerFactor = 1 - speedRatio * (1 - VEHICLE.minSteerFactor);
      const driftBoost = controls.handbrake ? VEHICLE.driftSteerBoost : 1;
      // J-turn: handbrake on the spot spins the car fast
      const spinBoost = controls.handbrake && absSpeed < 15 ? 3.0 : 1;
      const reverseSign = speed < 0 ? -1 : 1;
      const angularVel = steerDir * VEHICLE.maxSteerSpeed * steerFactor * driftBoost * spinBoost * reverseSign;
      rb.setAngvel({ x: 0, y: angularVel, z: 0 }, true);
    } else {
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    const currentLinvel = rb.linvel();
    const desiredVelX = _forward.x * speed;
    const desiredVelZ = _forward.z * speed;

    const lateralVel = currentLinvel.x * _right.x + currentLinvel.z * _right.z;
    const corneringForce = Math.abs(steerDir) * (absSpeed / VEHICLE.maxForwardSpeed);
    const brakeLock = controls.backward && absSpeed > 20 ? (absSpeed / VEHICLE.maxForwardSpeed) * 0.4 : 0;
    const gripLoss = Math.min(0.5, corneringForce * 0.3 + brakeLock);
    const baseGrip = controls.handbrake ? VEHICLE.driftLateralGrip : VEHICLE.normalLateralGrip;
    const grip = baseGrip * (1 - gripLoss);
    const keptLateral = lateralVel * (1 - grip);

    // While scraping wall, lower the velocity-blend so physics (bounce) shows through more
    const blend = inWallContact ? 0.5 : 0.85;
    const yVel = Math.min(currentLinvel.y, 4);

    rb.setLinvel(
      {
        x: (desiredVelX + _right.x * keptLateral) * blend + currentLinvel.x * (1 - blend),
        y: yVel,
        z: (desiredVelZ + _right.z * keptLateral) * blend + currentLinvel.z * (1 - blend),
      },
      true
    );
  });

  // Suppress unused "curve" lint — kept for future use
  void curve;

  const onCollisionEnter = useCallback(
    (e: { other: { rigidBody?: { userData?: unknown } } }) => {
      const tag = (e.other.rigidBody?.userData as { tag?: string } | undefined)?.tag;
      if (tag === "wall") {
        wallContactCount.current += 1;
        // One-shot impact slowdown — only on first contact (not repeated bumps within same scrape)
        if (wallContactCount.current === 1) {
          const preSpeed = Math.abs(currentSpeed.current);
          currentSpeed.current *= VEHICLE.wallImpactSpeedFactor;
          // Audio + spark intensity scales with impact speed
          const intensity = Math.min(1, preSpeed / 50);
          if (intensity > 0.12) {
            playCrash(intensity);
            // Spawn sparks at car body level (slightly off centre)
            const rb = rigidBody.current;
            if (rb) {
              const p = rb.translation();
              effectsHandle.sparkSpawnPos.current.set(p.x, p.y + 0.2, p.z);
              effectsHandle.sparkBurst.current += 1;
            }
          }
        }
      }
    },
    [playCrash, effectsHandle]
  );

  const onCollisionExit = useCallback((e: { other: { rigidBody?: { userData?: unknown } } }) => {
    const tag = (e.other.rigidBody?.userData as { tag?: string } | undefined)?.tag;
    if (tag === "wall") {
      wallContactCount.current = Math.max(0, wallContactCount.current - 1);
    }
  }, []);

  return (
    <>
      <RigidBody
        ref={rbRef}
        colliders={false}
        position={spawnPos}
        rotation={spawnRot}
        angularDamping={VEHICLE.angularDamping}
        mass={VEHICLE.mass}
        enabledRotations={[false, true, false]}
        onCollisionEnter={onCollisionEnter}
        onCollisionExit={onCollisionExit}
      >
        <CuboidCollider
          args={[VEHICLE.width / 2, VEHICLE.height / 2, VEHICLE.length / 2]}
          position={[0, VEHICLE.colliderYOffset, 0]}
          restitution={VEHICLE.restitution}
          friction={0.5}
        />
        <CarModel
          bodyColor="#dc1818"
          accentColor="#0a0a0a"
          inputRef={input}
          speedRef={currentSpeed}
        />
      </RigidBody>
      {/* Effects in world space — outside the RigidBody transform */}
      <CarEffects carRef={rigidBody} handle={effectsHandle} />
    </>
  );
}
