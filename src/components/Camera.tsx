import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { Vector3, Quaternion } from "three";
import { setListenerPose } from "../lib/audio";
import { useDebugStore } from "../lib/debug-store";

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
  const debug = useDebugStore((s) => s.debug);

  useFrame(() => {
    if (debug) {
      // Re-snap on next exit so the camera doesn't pop from a stale orbit pose
      initialized.current = false;
      return;
    }
    const rb = target.current;
    if (!rb) return;

    const pos = rb.translation();
    _carPos.set(pos.x, pos.y, pos.z);

    const rot = rb.rotation();
    _quat.set(rot.x, rot.y, rot.z, rot.w);
    _carForward.set(0, 0, -1).applyQuaternion(_quat);
    _carForward.y = 0;
    _carForward.normalize();

    // Ideal camera position: behind and above the car (fixed offset)
    _idealOffset.copy(_carForward).multiplyScalar(3.8).negate();
    _idealOffset.y = 2;
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
      // Smooth follow — higher lerp so camera keeps up under acceleration
      camera.position.lerp(_idealOffset, 0.2);
      currentLookAt.current.lerp(_idealLookAt, 0.25);
    }

    camera.lookAt(currentLookAt.current);

    // Update audio listener pose for bot 3D engine sound
    const camForward = currentLookAt.current.clone().sub(camera.position).normalize();
    setListenerPose(
      camera.position.x, camera.position.y, camera.position.z,
      camForward.x, camForward.y, camForward.z,
    );
  });

  return null;
}
