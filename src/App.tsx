import { Canvas } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import Car from "./components/Car";

export default function App() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 10, 20], fov: 60 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <Physics gravity={[0, -9.81, 0]}>
        <Car />
        {/* Ground */}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[100, 0.1, 100]} position={[0, -0.1, 0]} />
          <mesh receiveShadow rotation-x={-Math.PI / 2}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#4a7c59" />
          </mesh>
        </RigidBody>
      </Physics>
    </Canvas>
  );
}
