import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Quaternion } from "three";
import { useMultiplayerStore, remoteCars, type PlayerInfo } from "../lib/multiplayer";
import CarModel from "./CarModel";

export default function RemotePlayers() {
  const players = useMultiplayerStore((s) => s.players);
  const selfId = useMultiplayerStore((s) => s.selfId);

  const others = useMemo(
    () => Object.values(players).filter((p) => p.id !== selfId),
    [players, selfId],
  );

  return (
    <>
      {others.map((p) => (
        <RemoteCar key={p.id} info={p} />
      ))}
    </>
  );
}

const _q = new Quaternion();

function RemoteCar({ info }: { info: PlayerInfo }) {
  const groupRef = useRef<Group>(null);
  const speedRef = useRef(0);
  const initialised = useRef(false);

  // Snap to first received state on mount, so the car doesn't visibly fly in from origin.
  useEffect(() => {
    initialised.current = false;
  }, [info.id]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const state = remoteCars.get(info.id);
    if (!state) return;

    if (!initialised.current) {
      g.position.set(state.px, state.py, state.pz);
      g.quaternion.set(state.qx, state.qy, state.qz, state.qw);
      speedRef.current = state.speed;
      initialised.current = true;
      return;
    }

    // Frame-rate-independent exponential smoothing toward latest received state.
    // Half-life ≈ 60ms feels responsive without obvious jitter at 20Hz updates.
    const halfLife = 0.06;
    const a = 1 - Math.pow(0.5, delta / halfLife);

    g.position.x += (state.px - g.position.x) * a;
    g.position.y += (state.py - g.position.y) * a;
    g.position.z += (state.pz - g.position.z) * a;

    _q.set(state.qx, state.qy, state.qz, state.qw);
    g.quaternion.slerp(_q, a);

    speedRef.current += (state.speed - speedRef.current) * a;
  });

  return (
    <group ref={groupRef}>
      <CarModel bodyColor={info.color} accentColor="#0a0a0a" speedRef={speedRef} />
    </group>
  );
}
