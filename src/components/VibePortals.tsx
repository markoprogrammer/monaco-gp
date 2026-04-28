import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  Group,
  Mesh,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import { TRACK_POINTS } from "../lib/track-data";
import {
  buildOutgoingUrl,
  ownRef,
  readIncomingPortalParams,
  refToUrl,
} from "../lib/portal-params";
import { useUserStore } from "../lib/user-store";
import { useMultiplayerStore } from "../lib/multiplayer";

const VIBE_JAM_URL = "https://vibej.am/portal/2026";
const TRIGGER_RADIUS = 1.6;

interface VibePortalsProps {
  carRef: RefObject<RapierRigidBody | null>;
}

function makeLabelTexture(text: string, accent: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 128);
  // soft glow background
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(0,0,0,0.0)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 128);
  ctx.font = "bold 56px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 20;
  ctx.fillText(text, 256, 64);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

interface PortalVisualProps {
  position: [number, number, number];
  color: string;
  label: string;
}

const _carPos = new Vector3();

function PortalVisual({ position, color, label }: PortalVisualProps) {
  const ringRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const labelTex = useMemo(() => makeLabelTexture(label, color), [label, color]);

  useFrame((state, delta) => {
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.6;
    if (innerRef.current) {
      const t = state.clock.elapsedTime;
      const s = 0.85 + Math.sin(t * 3) * 0.08;
      innerRef.current.scale.setScalar(s);
    }
  });

  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[0, 0, 0]}>
        <torusGeometry args={[1.2, 0.09, 14, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.8}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>
      {/* Inner shimmer disc */}
      <mesh ref={innerRef}>
        <circleGeometry args={[1.05, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} side={DoubleSide} />
      </mesh>
      {/* Label */}
      <mesh position={[0, 1.9, 0]}>
        <planeGeometry args={[2.6, 0.65]} />
        <meshBasicMaterial map={labelTex} transparent toneMapped={false} />
      </mesh>
      {/* Light to make it pop */}
      <pointLight color={color} intensity={1.6} distance={8} decay={2} />
    </group>
  );
}

export default function VibePortals({ carRef }: VibePortalsProps) {
  const incoming = useMemo(readIncomingPortalParams, []);
  const username = useUserStore((s) => s.username);
  const selfColor = useMultiplayerStore((s) => s.selfColor);
  const triggeredRef = useRef(false);

  // Position portals along the start/finish straight, just behind the spawn
  // (player faces away from them on grid, so they never accidentally trigger
  // at race start). Place them at modest lateral offsets so they sit on the
  // edge of the racing surface, visible but easy to avoid on a clean lap.
  const { exitPos, returnPos } = useMemo(() => {
    const c = new CatmullRomCurve3(TRACK_POINTS, true, "catmullrom", 0.5);
    const t = 0.20; // well behind spawn (SPAWN_T = 0.28) — only reached deliberately
    const p = c.getPointAt(t);
    const tan = c.getTangentAt(t);
    const right = new Vector3(-tan.z, 0, tan.x).normalize();
    const exit: [number, number, number] = [
      p.x + right.x * 7.5,
      p.y + 2.2,
      p.z + right.z * 7.5,
    ];
    const ret: [number, number, number] = [
      p.x - right.x * 7.5,
      p.y + 2.2,
      p.z - right.z * 7.5,
    ];
    return { exitPos: exit, returnPos: ret };
  }, []);

  const navigateTo = (targetUrl: string) => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    const rb = carRef.current;
    let speedMs = 0;
    if (rb) {
      const v = rb.linvel();
      speedMs = Math.hypot(v.x, v.y, v.z);
    }
    const url = buildOutgoingUrl(targetUrl, {
      username: username ?? incoming.username,
      color: selfColor,
      speed: speedMs,
      ref: ownRef(),
    });
    window.location.href = url;
  };

  useFrame(() => {
    const rb = carRef.current;
    if (!rb || triggeredRef.current) return;
    const p = rb.translation();
    _carPos.set(p.x, p.y, p.z);

    // Exit (Vibe Jam)
    const dxE = _carPos.x - exitPos[0];
    const dyE = _carPos.y - exitPos[1];
    const dzE = _carPos.z - exitPos[2];
    if (dxE * dxE + dyE * dyE + dzE * dzE < TRIGGER_RADIUS * TRIGGER_RADIUS) {
      navigateTo(VIBE_JAM_URL);
      return;
    }

    // Return (back to ref)
    if (incoming.isFromPortal && incoming.ref) {
      const dxR = _carPos.x - returnPos[0];
      const dyR = _carPos.y - returnPos[1];
      const dzR = _carPos.z - returnPos[2];
      if (dxR * dxR + dyR * dyR + dzR * dzR < TRIGGER_RADIUS * TRIGGER_RADIUS) {
        navigateTo(refToUrl(incoming.ref));
      }
    }
  });

  return (
    <>
      <PortalVisual position={exitPos} color="#22d3ee" label="VIBE JAM" />
      {incoming.isFromPortal && incoming.ref && (
        <PortalVisual
          position={returnPos}
          color="#fb923c"
          label={`BACK · ${incoming.ref.replace(/^https?:\/\//, "").slice(0, 24)}`}
        />
      )}
    </>
  );
}
