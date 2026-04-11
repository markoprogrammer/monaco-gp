import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { Vector3, Quaternion } from "three";

const _idealOffset = new Vector3();
const _idealLookAt = new Vector3();
const _carForward = new Vector3();
const _quat = new Quaternion();
const _carPos = new Vector3();

interface ChaseCameraProps {
  target: React.RefObject<RapierRigidBody | null>;
}

export default function ChaseCamera({ target }: ChaseCameraProps) {
  const { camera } = useThree();
  const currentLookAt = useRef(new Vector3());
  const initialized = useRef(false);

  useFrame(() => {
    const rb = target.current;
    if (!rb) return;

    const pos = rb.translation();
    _carPos.set(pos.x, pos.y, pos.z);

    const rot = rb.rotation();
    _quat.set(rot.x, rot.y, rot.z, rot.w);
    _carForward.set(0, 0, -1).applyQuaternion(_quat);
    _carForward.y = 0;
    _carForward.normalize();

    // Speed for dynamic offset
    const linvel = rb.linvel();
    const speed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
    const speedPull = Math.min(speed / 25, 1) * 2; // extra pullback at speed

    // Ideal camera position: behind and above the car
    _idealOffset.copy(_carForward).multiplyScalar(6 + speedPull).negate();
    _idealOffset.y = 3 + speedPull * 0.4;
    _idealOffset.add(_carPos);

    // Ideal look-at: slightly ahead of car
    _idealLookAt.copy(_carForward).multiplyScalar(5);
    _idealLookAt.y = 1;
    _idealLookAt.add(_carPos);

    if (!initialized.current) {
      // Snap on first frame
      camera.position.copy(_idealOffset);
      currentLookAt.current.copy(_idealLookAt);
      initialized.current = true;
    } else {
      // Smooth follow
      camera.position.lerp(_idealOffset, 0.05);
      currentLookAt.current.lerp(_idealLookAt, 0.08);
    }

    camera.lookAt(currentLookAt.current);
  });

  return null;
}
