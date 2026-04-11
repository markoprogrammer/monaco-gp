import { useRef, useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { Vector3, Quaternion, CatmullRomCurve3 } from "three";
import { useVehicleControls } from "../hooks/useVehicleControls";
import { useEngineSound } from "../hooks/useEngineSound";
import { useGameState } from "../hooks/useGameState";
import { VEHICLE } from "../lib/physics-config";
import { TRACK_POINTS } from "../lib/track-data";

const _forward = new Vector3();
const _right = new Vector3();
const _quat = new Quaternion();

interface CarProps {
  onReady?: (rb: RapierRigidBody) => void;
}

const SPAWN_T = 0.28;

export default function Car({ onReady }: CarProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const input = useVehicleControls();
  const currentSpeed = useRef(0);
  const updateEngineSound = useEngineSound();
  const setSpeed = useGameState((s) => s.setSpeed);
  const tick = useGameState((s) => s.tick);

  const { spawnPos, spawnRot } = useMemo(() => {
    const curve = new CatmullRomCurve3(TRACK_POINTS, true, "catmullrom", 0.5);
    const pt = curve.getPointAt(SPAWN_T);
    const tan = curve.getTangentAt(SPAWN_T);
    const angle = Math.atan2(tan.x, tan.z) + Math.PI;
    return {
      spawnPos: [pt.x, pt.y + VEHICLE.spawnHeight, pt.z] as [number, number, number],
      spawnRot: [0, angle, 0] as [number, number, number],
    };
  }, []);

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

    const rotation = rb.rotation();
    _quat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    _forward.set(0, 0, -1).applyQuaternion(_quat);
    _forward.y = 0;
    _forward.normalize();
    _right.set(_forward.z, 0, -_forward.x);

    let speed = currentSpeed.current;

    if (controls.forward) {
      // Acceleration fades as speed increases (like real gears)
      const speedRatio = Math.abs(speed) / VEHICLE.maxForwardSpeed;
      const accelFactor = 1 - speedRatio * 0.7; // 100% at 0, 30% at max
      speed += VEHICLE.accelerationRate * accelFactor * dt;
    } else if (controls.backward) {
      speed -= VEHICLE.brakeRate * dt;
    } else {
      if (speed > 0) {
        speed = Math.max(0, speed - VEHICLE.coastDecel * dt);
      } else if (speed < 0) {
        speed = Math.min(0, speed + VEHICLE.coastDecel * dt);
      }
    }

    // Handbrake slows the car down
    if (controls.handbrake && speed > 0) {
      speed = Math.max(0, speed - VEHICLE.handbrakeDecel * dt);
    }

    speed = Math.max(-VEHICLE.maxReverseSpeed, Math.min(VEHICLE.maxForwardSpeed, speed));
    currentSpeed.current = speed;

    // Engine sound + HUD speed + lap timer
    updateEngineSound(Math.abs(speed) / VEHICLE.maxForwardSpeed);
    setSpeed(Math.abs(speed));
    tick(dt);

    const absSpeed = Math.abs(speed);
    if (absSpeed > 0.5) {
      const steerDir = (controls.left ? 1 : 0) - (controls.right ? 1 : 0);
      if (steerDir !== 0) {
        const speedRatio = absSpeed / VEHICLE.maxForwardSpeed;
        const steerFactor = 1 - speedRatio * (1 - VEHICLE.minSteerFactor);
        const reverseSign = speed < 0 ? -1 : 1;
        const angularVel = steerDir * VEHICLE.maxSteerSpeed * steerFactor * reverseSign;
        rb.setAngvel({ x: 0, y: angularVel, z: 0 }, true);
      } else {
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    } else {
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    // --- Apply velocity (blend with physics for wall bounce) ---
    const currentLinvel = rb.linvel();

    const desiredVelX = _forward.x * speed;
    const desiredVelZ = _forward.z * speed;

    // Lateral grip
    const lateralVel = currentLinvel.x * _right.x + currentLinvel.z * _right.z;
    const grip = controls.handbrake ? VEHICLE.driftLateralGrip : VEHICLE.normalLateralGrip;
    const keptLateral = lateralVel * (1 - grip);

    // Blend: 80% our control, 20% physics response (allows wall bounce)
    const blend = 0.8;
    rb.setLinvel(
      {
        x: (desiredVelX + _right.x * keptLateral) * blend + currentLinvel.x * (1 - blend),
        y: currentLinvel.y,
        z: (desiredVelZ + _right.z * keptLateral) * blend + currentLinvel.z * (1 - blend),
      },
      true
    );
  });

  return (
    <RigidBody
      ref={rbRef}
      colliders={false}
      position={spawnPos}
      rotation={spawnRot}
      angularDamping={VEHICLE.angularDamping}
      mass={VEHICLE.mass}
      enabledRotations={[false, true, false]}
    >
      <CuboidCollider
        args={[VEHICLE.width / 2, VEHICLE.height / 2, VEHICLE.length / 2]}
        restitution={VEHICLE.restitution}
        friction={0.5}
      />
      <mesh castShadow>
        <boxGeometry args={[VEHICLE.width, VEHICLE.height, VEHICLE.length]} />
        <meshStandardMaterial color="#e03030" />
      </mesh>
      <mesh castShadow position={[0, 0.4, -0.3]}>
        <boxGeometry args={[VEHICLE.width * 0.7, 0.4, VEHICLE.length * 0.4]} />
        <meshStandardMaterial color="#cc2020" />
      </mesh>
    </RigidBody>
  );
}
