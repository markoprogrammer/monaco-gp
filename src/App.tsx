import { useRef, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import Car from "./components/Car";
import ChaseCamera from "./components/Camera";
import Track from "./components/Track";

export default function App() {
  const carRef = useRef<RapierRigidBody | null>(null);

  const onCarReady = useCallback((rb: RapierRigidBody) => {
    carRef.current = rb;
  }, []);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 10, 20], fov: 60 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <Physics gravity={[0, -9.81, 0]}>
        <Car onReady={onCarReady} />
        <ChaseCamera target={carRef} />
        <Track />
        {/* Ground visual (no physics — track has its own collider) */}
        <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.5, 0]}>
          <planeGeometry args={[600, 600]} />
          <meshStandardMaterial color="#4a7c59" />
        </mesh>
      </Physics>
    </Canvas>
  );
}
