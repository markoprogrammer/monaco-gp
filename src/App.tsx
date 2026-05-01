import { useRef, useCallback, useEffect, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { WebGPURenderer } from "three/webgpu";
import { WebGLRenderer, SRGBColorSpace, NoToneMapping } from "three";
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
import MiniMap from "./components/MiniMap";
import EnvLight from "./components/EnvLight";
import StartLights from "./components/StartLights";
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

  // WebGPU is the default renderer; falls back to WebGL when the browser
  // lacks WebGPU support or init fails. Pass `?webgl=1` to force WebGL.
  const glFactory = useMemo(() => {
    const forceWebGL =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("webgl") === "1";

    return async (defaultProps: { canvas: HTMLCanvasElement | OffscreenCanvas }) => {
      if (forceWebGL) {
        // eslint-disable-next-line no-console
        console.info("[renderer] WebGL forced via ?webgl=1");
        return new WebGLRenderer({ ...defaultProps, antialias: true } as never);
      }
      const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
      if (hasWebGPU) {
        try {
          const renderer = new WebGPURenderer({ ...defaultProps, antialias: true } as never);
          // Match the WebGL defaults R3F applies in v9 — without these the
          // PBR materials look near-black under WebGPU because the colour
          // pipeline defaults to linear in/out and tone mapping is off.
          renderer.outputColorSpace = SRGBColorSpace;
          renderer.toneMapping = NoToneMapping;
          renderer.toneMappingExposure = 1.5;
          await renderer.init();
          // eslint-disable-next-line no-console
          console.info("[renderer] WebGPU active");
          return renderer;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[renderer] WebGPU init failed, falling back to WebGL", err);
        }
      }
      return new WebGLRenderer({ ...defaultProps, antialias: true } as never);
    };
  }, []);

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
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 10, 20], fov: 60, near: 0.5, far: 14000 }}
        gl={glFactory as never}
      >
        <Environment />
        <EnvLight />
        <Physics gravity={[0, -9.81, 0]} interpolate timeStep={1 / 90}>
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
      <MiniMap />
      <StartLights />
    </>
  );
}
