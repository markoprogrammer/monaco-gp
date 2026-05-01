import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { RapierRigidBody } from "@react-three/rapier";
import { useDebugStore } from "../lib/debug-store";

interface DebugCameraProps {
  target: React.RefObject<RapierRigidBody | null>;
}

export default function DebugCamera({ target }: DebugCameraProps) {
  const { camera, gl } = useThree();
  const debug = useDebugStore((s) => s.debug);

  useEffect(() => {
    if (!debug) return;
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1;
    controls.maxDistance = 4000;

    // Centre orbit on the car at the moment debug turns on.
    const rb = target.current;
    if (rb) {
      const p = rb.translation();
      controls.target.set(p.x, p.y + 0.5, p.z);
    }
    controls.update();

    let raf = 0;
    const tick = () => {
      controls.update();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
    };
  }, [debug, camera, gl, target]);

  return null;
}
