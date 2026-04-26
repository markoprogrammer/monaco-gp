import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { raceRegistry } from "../lib/race-progress";
import { useGameState } from "../hooks/useGameState";

const UPDATE_INTERVAL = 0.4; // seconds — throttle store writes

export default function RaceTracker() {
  const accum = useRef(0);
  const setPosition = useGameState((s) => s.setPosition);

  useFrame((_, delta) => {
    accum.current += delta;
    if (accum.current < UPDATE_INTERVAL) return;
    accum.current = 0;

    if (raceRegistry.length === 0) return;

    let player = null;
    let aheadCount = 0;
    for (const e of raceRegistry) {
      if (e.isPlayer) player = e;
    }
    if (!player) return;

    for (const e of raceRegistry) {
      if (e === player) continue;
      if (e.progress > player.progress) aheadCount++;
    }

    setPosition(aheadCount + 1, raceRegistry.length);
  });

  return null;
}
