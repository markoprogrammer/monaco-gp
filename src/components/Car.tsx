import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { Vector3, Quaternion } from "three";
import { useVehicleControls } from "../hooks/useVehicleControls";
import { VEHICLE } from "../lib/physics-config";

const _forward = new Vector3();
const _right = new Vector3();
const _vel = new Vector3();
const _quat = new Quaternion();

export default function Car() {
  const rigidBody = useRef<RapierRigidBody>(null);
  const input = useVehicleControls();
  const currentSpeed = useRef(0);

  useFrame((_, delta) => {
    const rb = rigidBody.current;
    if (!rb) return;
    // Cap delta to avoid physics explosion on tab-switch
    const dt = Math.min(delta, 0.05);

    const controls = input.current;

    // Car's forward direction (Y-axis rotation only)
    const rotation = rb.rotation();
    _quat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    _forward.set(0, 0, -1).applyQuaternion(_quat);
    _forward.y = 0;
    _forward.normalize();
    _right.set(_forward.z, 0, -_forward.x); // perpendicular

    // --- Speed control (direct velocity approach) ---
    let speed = currentSpeed.current;

    if (controls.forward) {
      speed += VEHICLE.accelerationRate * dt;
    } else if (controls.backward) {
      speed -= VEHICLE.brakeRate * dt;
    } else {
      // Coast to stop
      if (speed > 0) {
        speed = Math.max(0, speed - VEHICLE.coastDecel * dt);
      } else if (speed < 0) {
        speed = Math.min(0, speed + VEHICLE.coastDecel * dt);
      }
    }

    // Clamp speed
    speed = Math.max(-VEHICLE.maxReverseSpeed, Math.min(VEHICLE.maxForwardSpeed, speed));
    currentSpeed.current = speed;

    // --- Steering ---
    const absSpeed = Math.abs(speed);
    if (absSpeed > 0.5) {
      const steerDir = (controls.left ? 1 : 0) - (controls.right ? 1 : 0);
      if (steerDir !== 0) {
        // Steer less at high speed
        const speedRatio = absSpeed / VEHICLE.maxForwardSpeed;
        const steerFactor = 1 - speedRatio * (1 - VEHICLE.minSteerFactor);
        // Reverse steering when going backwards
        const reverseSign = speed < 0 ? -1 : 1;
        const angularVel = steerDir * VEHICLE.maxSteerSpeed * steerFactor * reverseSign;
        rb.setAngvel({ x: 0, y: angularVel, z: 0 }, true);
      } else {
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    } else {
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    // --- Apply velocity ---
    const currentLinvel = rb.linvel();

    // Forward velocity from our speed
    const forwardVelX = _forward.x * speed;
    const forwardVelZ = _forward.z * speed;

    // Lateral velocity (sideways slide)
    const lateralVel = currentLinvel.x * _right.x + currentLinvel.z * _right.z;
    const grip = controls.handbrake ? VEHICLE.driftLateralGrip : VEHICLE.normalLateralGrip;
    const keptLateral = lateralVel * (1 - grip);

    rb.setLinvel(
      {
        x: forwardVelX + _right.x * keptLateral,
        y: currentLinvel.y, // preserve gravity
        z: forwardVelZ + _right.z * keptLateral,
      },
      true
    );
  });

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      position={[0, VEHICLE.spawnHeight, 0]}
      angularDamping={VEHICLE.angularDamping}
      mass={VEHICLE.mass}
      enabledRotations={[false, true, false]}
    >
      <CuboidCollider
        args={[VEHICLE.width / 2, VEHICLE.height / 2, VEHICLE.length / 2]}
      />
      {/* Car body */}
      <mesh castShadow>
        <boxGeometry args={[VEHICLE.width, VEHICLE.height, VEHICLE.length]} />
        <meshStandardMaterial color="#e03030" />
      </mesh>
      {/* Cabin */}
      <mesh castShadow position={[0, 0.4, -0.3]}>
        <boxGeometry args={[VEHICLE.width * 0.7, 0.4, VEHICLE.length * 0.4]} />
        <meshStandardMaterial color="#cc2020" />
      </mesh>
    </RigidBody>
  );
}
