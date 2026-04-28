import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  Quaternion,
  SRGBColorSpace,
} from "three";
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

const LABEL_FONT = 56;
const LABEL_PAD_X = 28;
const LABEL_PAD_Y = 18;

function makeNameTagTexture(name: string, accent: string): { texture: CanvasTexture; aspect: number } {
  const c = document.createElement("canvas");
  // measure first
  const measureCtx = c.getContext("2d")!;
  measureCtx.font = `700 ${LABEL_FONT}px Helvetica, Arial, sans-serif`;
  const textW = Math.max(120, measureCtx.measureText(name).width);
  const w = Math.ceil(textW + LABEL_PAD_X * 2);
  const h = LABEL_FONT + LABEL_PAD_Y * 2;
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  // pill background
  const r = h / 2;
  ctx.fillStyle = "rgba(10, 14, 28, 0.72)";
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  // accent dot
  const dotR = LABEL_FONT * 0.18;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(LABEL_PAD_X * 0.7, h / 2, dotR, 0, Math.PI * 2);
  ctx.fill();
  // text
  ctx.font = `700 ${LABEL_FONT}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(name, LABEL_PAD_X * 0.7 + dotR + 14, h / 2 + 2);
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  return { texture, aspect: w / h };
}

function RemoteCar({ info }: { info: PlayerInfo }) {
  const groupRef = useRef<Group>(null);
  const labelRef = useRef<Mesh>(null);
  const speedRef = useRef(0);
  const initialised = useRef(false);

  const { texture: labelTex, aspect: labelAspect } = useMemo(
    () => makeNameTagTexture(info.nick || "PLAYER", info.color),
    [info.nick, info.color],
  );
  useEffect(() => () => labelTex.dispose(), [labelTex]);

  // Snap to first received state on mount, so the car doesn't visibly fly in from origin.
  useEffect(() => {
    initialised.current = false;
  }, [info.id]);

  useFrame(({ camera }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const state = remoteCars.get(info.id);

    if (state) {
      if (!initialised.current) {
        g.position.set(state.px, state.py, state.pz);
        g.quaternion.set(state.qx, state.qy, state.qz, state.qw);
        speedRef.current = state.speed;
        initialised.current = true;
      } else {
        const halfLife = 0.06;
        const a = 1 - Math.pow(0.5, delta / halfLife);
        g.position.x += (state.px - g.position.x) * a;
        g.position.y += (state.py - g.position.y) * a;
        g.position.z += (state.pz - g.position.z) * a;
        _q.set(state.qx, state.qy, state.qz, state.qw);
        g.quaternion.slerp(_q, a);
        speedRef.current += (state.speed - speedRef.current) * a;
      }
    }

    // Billboard the label toward the camera (counter-rotate against the car's yaw).
    const lbl = labelRef.current;
    if (lbl) {
      lbl.quaternion.copy(camera.quaternion);
      // Bring it back to local space (the parent group has a rotation we need to undo).
      g.getWorldQuaternion(_q).invert();
      lbl.quaternion.premultiply(_q);
    }
  });

  const labelHeight = 0.42;
  const labelWidth = labelHeight * labelAspect;

  return (
    <group ref={groupRef}>
      <CarModel bodyColor={info.color} accentColor="#0a0a0a" speedRef={speedRef} />
      <mesh ref={labelRef} position={[0, 1.7, 0]} renderOrder={1}>
        <planeGeometry args={[labelWidth, labelHeight]} />
        <meshBasicMaterial
          map={labelTex}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
