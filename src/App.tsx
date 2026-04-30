import { useRef, useCallback, useEffect, Suspense } from "react";
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
import RemotePlayers from "./components/RemotePlayers";
import RaceTracker from "./components/RaceTracker";
import Radio from "./components/Radio";
import CarTuningPanel from "./components/CarTuningPanel";
import SettingsButton from "./components/SettingsButton";
import SoundButton from "./components/SoundButton";
import UsernameGate from "./components/UsernameGate";
import LapSaver from "./components/LapSaver";
import Leaderboard from "./components/Leaderboard";
// import VibePortals from "./components/VibePortals"; // disabled — leaderboard button is enough; can re-enable later
import { initMultiplayer } from "./lib/multiplayer";
import { useUserStore } from "./lib/user-store";
import { useUserStatsStore } from "./lib/all-time-stats";

export default function App() {
  return (
    <UsernameGate>
      <Game />
    </UsernameGate>
  );
}

function Game() {
  const carRef = useRef<RapierRigidBody | null>(null);
  const username = useUserStore((s) => s.username);

  const onCarReady = useCallback((rb: RapierRigidBody) => {
    carRef.current = rb;
  }, []);

  useEffect(() => {
    if (!username) return;
    return initMultiplayer(username);
  }, [username]);

  useEffect(() => {
    if (!username) return;
    void useUserStatsStore.getState().loadFor(username);
  }, [username]);

  return (
    <>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 10, 20], fov: 60 }}>
        <Environment />
        <Physics gravity={[0, -9.81, 0]}>
          <Suspense fallback={null}>
            <Car onReady={onCarReady} />
            <RemotePlayers />
          </Suspense>
          <ChaseCamera target={carRef} />
          <DebugCamera target={carRef} />
          <Track />
          <LapSensors />
          <RaceTracker />
          {/* <VibePortals carRef={carRef} /> */}
        </Physics>
      </Canvas>
      <HUD />
      <DebugHud />
      <Radio />
      <MobileControls />
      <OrientationGate />
      <CarTuningPanel />
      <SettingsButton />
      <SoundButton />
      <Leaderboard />
      <LapSaver />
    </>
  );
}
