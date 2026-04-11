import { useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CatmullRomCurve3 } from "three";
import { TRACK_POINTS, TRACK_WIDTH } from "../lib/track-data";
import { useGameState } from "../hooks/useGameState";

function useSensorPos(t: number) {
  return useMemo(() => {
    const curve = new CatmullRomCurve3(TRACK_POINTS, true, "catmullrom", 0.5);
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    return {
      pos: [pt.x, pt.y + 1.5, pt.z] as [number, number, number],
      rot: [0, Math.atan2(tan.x, tan.z), 0] as [number, number, number],
    };
  }, [t]);
}

export default function LapSensors() {
  const crossFinishLine = useGameState((s) => s.crossFinishLine);
  const passCheckpoint = useGameState((s) => s.passCheckpoint);
  const hitSector1 = useGameState((s) => s.hitSector1);
  const hitSector2 = useGameState((s) => s.hitSector2);

  const finish = useSensorPos(0.29);
  const sector1 = useSensorPos(0.62);
  const sector2 = useSensorPos(0.91);

  return (
    <>
      <RigidBody type="fixed" position={finish.pos} rotation={finish.rot} colliders={false}>
        <CuboidCollider args={[TRACK_WIDTH / 2, 3, 3]} sensor
          onIntersectionEnter={() => crossFinishLine()} />
      </RigidBody>

      <RigidBody type="fixed" position={sector1.pos} rotation={sector1.rot} colliders={false}>
        <CuboidCollider args={[TRACK_WIDTH / 2, 3, 3]} sensor
          onIntersectionEnter={() => { hitSector1(); passCheckpoint(); }} />
      </RigidBody>

      <RigidBody type="fixed" position={sector2.pos} rotation={sector2.rot} colliders={false}>
        <CuboidCollider args={[TRACK_WIDTH / 2, 3, 3]} sensor
          onIntersectionEnter={() => hitSector2()} />
      </RigidBody>
    </>
  );
}
