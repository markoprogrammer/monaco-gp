import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { Vector3, Quaternion } from "three";
import { setListenerPose } from "../lib/audio";
import { useDebugStore } from "../lib/debug-store";
import { useIntroStore } from "../lib/intro-store";

const _idealOffset = new Vector3();
const _idealLookAt = new Vector3();
const _carForward = new Vector3();
const _carRight = new Vector3();
const _quat = new Quaternion();
const _carPos = new Vector3();
const _carVel = new Vector3();
const INTRO_DURATION_MS = 5500;
// FAR start of the intro — way out over the ocean. The camera zooms
// from here into the captured "city overview" pose, holds briefly so
// the player can take in the panorama, then descends to the chase pose.
const INTRO_FAR_POS = new Vector3(-1500, 900, 3000);
const INTRO_FAR_LOOK = new Vector3(-200, 200, 700);
// CITY OVERVIEW pose — captured by the user.
const INTRO_CITY_POS = new Vector3(-858, 227, 578);
const INTRO_CITY_LOOK = new Vector3(-790, 205, 508);
// Stage timings (fractions of the total intro duration). The held
// portion is what gives the player time to actually see the city.
const STAGE_ZOOM_END = 0.45;  // 0..0.45 = far → city
const STAGE_HOLD_END = 0.65;  // 0.45..0.65 = hold city pose
// 0.65..1.00 = city → chase pose

interface ChaseCameraProps {
  target: React.RefObject<RapierRigidBody | null>;
}

export default function ChaseCamera({ target }: ChaseCameraProps) {
  const { camera } = useThree();
  const currentLookAt = useRef(new Vector3());
  const initialized = useRef(false);
  const lateralSwing = useRef(0); // smoothed lateral velocity for camera sway
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
    _carRight.set(1, 0, 0).applyQuaternion(_quat);
    _carRight.y = 0;
    _carRight.normalize();

    // Lateral velocity along the car's right axis — large when drifting
    // sideways, near zero when the wheels grip and the car tracks straight.
    const v = rb.linvel();
    _carVel.set(v.x, 0, v.z);
    const lateralVel = _carVel.dot(_carRight);
    // Normalise to roughly [-1, 1] and smooth heavily so the camera
    // glides into the slide instead of snapping.
    const targetSwing = Math.max(-1, Math.min(1, lateralVel / 18));
    lateralSwing.current += (targetSwing - lateralSwing.current) * 0.06;

    // Ideal camera position: behind and above the car, plus a sway in the
    // direction the chassis is sliding (camera leans into the corner).
    const SWAY_LATERAL = 1.6;
    _idealOffset.copy(_carForward).multiplyScalar(3.8).negate();
    _idealOffset.y = 2;
    _idealOffset.addScaledVector(_carRight, lateralSwing.current * SWAY_LATERAL);
    _idealOffset.add(_carPos);

    // Look-at also leans in the slide direction so the camera "looks
    // through" the corner during a drift.
    const LOOK_LATERAL = 1.2;
    _idealLookAt.copy(_carForward).multiplyScalar(5);
    _idealLookAt.y = 1;
    _idealLookAt.addScaledVector(_carRight, lateralSwing.current * LOOK_LATERAL);
    _idealLookAt.add(_carPos);

    // Cinematic intro: 3 stages.
    //  A) far ocean → city overview (zoom in)
    //  B) hold the city overview (so the player sees the panorama)
    //  C) city overview → chase pose (descend to start line)
    const intro = useIntroStore.getState();
    if (intro.phase === "flying") {
      const elapsed = performance.now() - intro.phaseStartedAt;
      const t = Math.min(1, elapsed / INTRO_DURATION_MS);
      if (t < STAGE_ZOOM_END) {
        const u = t / STAGE_ZOOM_END;
        const e = 1 - Math.pow(1 - u, 3); // ease-out cubic
        camera.position.lerpVectors(INTRO_FAR_POS, INTRO_CITY_POS, e);
        currentLookAt.current.lerpVectors(INTRO_FAR_LOOK, INTRO_CITY_LOOK, e);
      } else if (t < STAGE_HOLD_END) {
        camera.position.copy(INTRO_CITY_POS);
        currentLookAt.current.copy(INTRO_CITY_LOOK);
      } else {
        const u = (t - STAGE_HOLD_END) / (1 - STAGE_HOLD_END);
        const e = u * u * (3 - 2 * u); // smoothstep
        camera.position.lerpVectors(INTRO_CITY_POS, _idealOffset, e);
        currentLookAt.current.lerpVectors(INTRO_CITY_LOOK, _idealLookAt, e);
      }
      camera.lookAt(currentLookAt.current);
      if (t >= 1) {
        intro.setPhase("lights");
        initialized.current = true;
      }
      const camForward = currentLookAt.current.clone().sub(camera.position).normalize();
      setListenerPose(
        camera.position.x, camera.position.y, camera.position.z,
        camForward.x, camForward.y, camForward.z,
      );
      return;
    }

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
