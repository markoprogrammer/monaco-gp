import { useRef, useCallback, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import Car from "./components/Car";
import ChaseCamera from "./components/Camera";
import DebugCamera from "./components/DebugCamera";
import DebugHud from "./components/DebugHud";
import Track from "./components/Track";
import Environment from "./components/Environment";
import LapSensors from "./components/LapSensors";
import HUD from "./components/HUD";
import MobileControls from "./components/MobileControls";
import OrientationGate from "./components/OrientationGate";
import Bots from "./components/Bots";
import RaceTracker from "./components/RaceTracker";
import Radio from "./components/Radio";

export default function App() {
  const carRef = useRef<RapierRigidBody | null>(null);

  const onCarReady = useCallback((rb: RapierRigidBody) => {
    carRef.current = rb;
  }, []);

  return (
    <>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 10, 20], fov: 60 }}>
        <Environment />
        <Physics gravity={[0, -9.81, 0]}>
          <Suspense fallback={null}>
            <Car onReady={onCarReady} />
            <Bots />
          </Suspense>
          <ChaseCamera target={carRef} />
          <DebugCamera target={carRef} />
          <Track />
          <LapSensors />
          <RaceTracker />
        </Physics>
      </Canvas>
      <HUD />
      <DebugHud />
      <Radio />
      <MobileControls />
      <OrientationGate />
    </>
  );
}
