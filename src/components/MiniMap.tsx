import { useEffect, useRef, useState } from "react";
import { TRACK_POINTS } from "../lib/track-data";
import { getSelfPose, remoteCars, useMultiplayerStore } from "../lib/multiplayer";
import { useUserStore } from "../lib/user-store";

// Desktop minimap matches the speedometer block height exactly (tacho 90 +
// speed digit ~32 + KM/H label ~17 ≈ 139px) so the two HUD modules sit on
// the same baseline. They keep a small visible gap between them.
const SIZE_DESKTOP = 139;
const SIZE_MOBILE = 96;
const PADDING = 8;
const POLL_MS = 80;

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  });
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches || "ontouchstart" in window);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isTouch;
}

interface CarDot {
  id: string;
  x: number;
  y: number;
  color: string;
  isSelf: boolean;
}

// Pre-compute the world-space bounds of the track once.
const TRACK_BOUNDS = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of TRACK_POINTS) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  // Add a bit of margin so cars near the edge don't sit on the rim.
  const margin = 8;
  return {
    minX: minX - margin,
    maxX: maxX + margin,
    minZ: minZ - margin,
    maxZ: maxZ + margin,
  };
})();

function project(x: number, z: number, size: number): { x: number; y: number } {
  const w = TRACK_BOUNDS.maxX - TRACK_BOUNDS.minX;
  const h = TRACK_BOUNDS.maxZ - TRACK_BOUNDS.minZ;
  const span = Math.max(w, h);
  // Center the map within the SVG square.
  const offX = (span - w) / 2;
  const offZ = (span - h) / 2;
  const inner = size - PADDING * 2;
  const nx = (x - TRACK_BOUNDS.minX + offX) / span;
  const nz = (z - TRACK_BOUNDS.minZ + offZ) / span;
  return {
    x: PADDING + nx * inner,
    y: PADDING + nz * inner,
  };
}

function buildTrackPath(size: number): string {
  const pts = TRACK_POINTS.map((p) => project(p.x, p.z, size));
  if (pts.length === 0) return "";
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return `${d} Z`;
}

export default function MiniMap() {
  const players = useMultiplayerStore((s) => s.players);
  const selfId = useMultiplayerStore((s) => s.selfId);
  const selfColor = useMultiplayerStore((s) => s.selfColor);
  const username = useUserStore((s) => s.username);
  const onlineCount = Object.keys(players).length;
  const isTouch = useIsTouch();
  const size = isTouch ? SIZE_MOBILE : SIZE_DESKTOP;
  const [dots, setDots] = useState<CarDot[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    let lastTick = 0;
    const tick = (t: number) => {
      if (!alive) return;
      if (t - lastTick >= POLL_MS) {
        lastTick = t;
        const next: CarDot[] = [];
        const self = getSelfPose();
        if (self) {
          const p = project(self.px, self.pz, size);
          next.push({ id: selfId, x: p.x, y: p.y, color: selfColor || "#FFEC00", isSelf: true });
        }
        for (const [id, state] of remoteCars.entries()) {
          if (!state) continue;
          const info = players[id];
          const color = info?.color || "#aaaaaa";
          const p = project(state.px, state.pz, size);
          next.push({ id, x: p.x, y: p.y, color, isSelf: false });
        }
        setDots(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [players, selfId, selfColor, size]);

  // Right of the speedometer in both modes. On desktop the sound/radio
  // buttons live at the bottom so the minimap sits at the very top with a
  // small breathing gap. On mobile it drops below the top control row.
  const positionStyle: React.CSSProperties = isTouch
    ? { top: 56, left: 134 }
    : { top: 12, left: 138 };

  const trackPath = buildTrackPath(size);

  const FOOTER_H = 38;
  return (
    <div
      style={{
        position: "fixed",
        ...positionStyle,
        width: size,
        height: size + FOOTER_H,
        zIndex: 9998,
        pointerEvents: "none",
        background: "rgba(0,0,0,0.55)",
        border: isTouch ? "1px solid rgba(255,255,255,0.08)" : "none",
        borderRadius: isTouch ? 8 : 6,
        boxShadow: isTouch ? "0 4px 16px rgba(0,0,0,0.4)" : undefined,
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={isTouch ? 4 : 6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={trackPath}
          fill="none"
          stroke="#FFEC00"
          strokeOpacity={0.65}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {dots.map((d) => (
          <g key={d.id}>
            <circle
              cx={d.x}
              cy={d.y}
              r={d.isSelf ? 4.5 : 3}
              fill={d.color}
              stroke={d.isSelf ? "#0a0a0a" : "rgba(0,0,0,0.6)"}
              strokeWidth={d.isSelf ? 1.5 : 1}
            />
            {d.isSelf && (
              <circle
                cx={d.x}
                cy={d.y}
                r={7}
                fill="none"
                stroke={d.color}
                strokeOpacity={0.45}
                strokeWidth={1}
              />
            )}
          </g>
        ))}
      </svg>
      <div
        style={{
          height: FOOTER_H,
          padding: "5px 8px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
          background: "linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.6) 100%)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontVariantNumeric: "tabular-nums",
          color: "#cdd3df",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: selfColor || "#fff", fontWeight: 700 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: selfColor || "#888",
              boxShadow: selfColor ? `0 0 4px ${selfColor}` : undefined,
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {username ?? "—"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 4px #22c55e",
              flexShrink: 0,
            }}
          />
          <span>
            <strong style={{ color: "#fff" }}>{onlineCount}</strong> online
          </span>
        </div>
      </div>
    </div>
  );
}
