import { useRef, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import Car from "./components/Car";
import ChaseCamera from "./components/Camera";
import Track from "./components/Track";
import Environment from "./components/Environment";

export default function App() {
  const carRef = useRef<RapierRigidBody | null>(null);

  const onCarReady = useCallback((rb: RapierRigidBody) => {
    carRef.current = rb;
  }, []);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 10, 20], fov: 60 }}>
      <Environment />
      <Physics gravity={[0, -9.81, 0]}>
        <Car onReady={onCarReady} />
        <ChaseCamera target={carRef} />
        <Track />
      </Physics>
    </Canvas>
  );
}
