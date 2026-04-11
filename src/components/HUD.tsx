import { createPortal } from "react-dom";
import { useGameState } from "../hooks/useGameState";
import { VEHICLE } from "../lib/physics-config";

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function fmtDelta(d: number): string {
  return (d <= 0 ? "-" : "+") + Math.abs(d).toFixed(3);
}

function Tacho({ ratio }: { ratio: number }) {
  const r = 38, startA = 135, endA = 405, range = endA - startA;
  const angle = startA + ratio * range;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arc = (from: number, to: number) => {
    const x1 = 50 + r * Math.cos(toRad(from)), y1 = 50 + r * Math.sin(toRad(from));
    const x2 = 50 + r * Math.cos(toRad(to)), y2 = 50 + r * Math.sin(toRad(to));
    return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const nx = 50 + (r - 8) * Math.cos(toRad(angle)), ny = 50 + (r - 8) * Math.sin(toRad(angle));
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: "block" }}>
      <path d={arc(startA, endA)} fill="none" stroke="#333" strokeWidth="6" strokeLinecap="round" />
      {ratio > 0.01 && <path d={arc(startA, Math.min(angle, endA))} fill="none" stroke={ratio > 0.85 ? "#ef4444" : "#22c55e"} strokeWidth="6" strokeLinecap="round" />}
      <path d={arc(startA + range * 0.85, endA)} fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="6" strokeLinecap="round" />
      <line x1="50" y1="50" x2={nx} y2={ny} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="50" r="3" fill="#fff" />
      <text x="50" y="70" textAnchor="middle" fill="#fff" fontSize="12" fontFamily="'Courier New', monospace" opacity="0.7">
        {Math.round(ratio * 18)}k
      </text>
    </svg>
  );
}

function SectorRow({ label, time, best }: { label: string; time: number | null; best: number | null }) {
  if (time === null) return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.3, padding: "2px 0" }}>
      <span>{label}</span><span>--:--.---</span>
    </div>
  );
  const delta = best !== null ? time - best : null;
  const isBest = delta === null || delta <= 0.001;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0", gap: 8 }}>
      <span style={{ width: 20 }}>{label}</span>
      <span style={{ color: isBest ? "#22c55e" : "#f59e0b", flex: 1, textAlign: "right" }}>{fmt(time)}</span>
      {delta !== null && (
        <span style={{ fontSize: 10, width: 55, textAlign: "right", color: isBest ? "#22c55e" : "#ef4444" }}>
          {fmtDelta(delta)}
        </span>
      )}
    </div>
  );
}

export default function HUD() {
  const speed = useGameState((s) => s.speed);
  const lapTime = useGameState((s) => s.lapTime);
  const bestLapTime = useGameState((s) => s.bestLapTime);
  const lastLapTime = useGameState((s) => s.lastLapTime);
  const currentLap = useGameState((s) => s.currentLap);
  const s1Time = useGameState((s) => s.s1Time);
  const s2Time = useGameState((s) => s.s2Time);
  const lastS1 = useGameState((s) => s.lastS1);
  const lastS2 = useGameState((s) => s.lastS2);
  const lastS3 = useGameState((s) => s.lastS3);
  const bestS1 = useGameState((s) => s.bestS1);
  const bestS2 = useGameState((s) => s.bestS2);
  const bestS3 = useGameState((s) => s.bestS3);
  const prevBestS1 = useGameState((s) => s.prevBestS1);
  const prevBestS2 = useGameState((s) => s.prevBestS2);
  const prevBestS3 = useGameState((s) => s.prevBestS3);
  const prevBestLap = useGameState((s) => s.prevBestLap);

  const kmh = Math.round(speed * 3.6);
  const rpmRatio = Math.min(1, speed / VEHICLE.maxForwardSpeed);

  // Current sector times
  const curS1 = s1Time;
  const curS2 = s1Time !== null && s2Time !== null ? s2Time - s1Time : null;
  const curS3: number | null = null; // only known at finish

  // Show last lap sectors when current lap has none yet
  const showLast = curS1 === null && lastS1 !== null;

  const box: React.CSSProperties = {
    background: "rgba(0,0,0,0.7)",
    borderRadius: 6,
    padding: "6px 12px",
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      zIndex: 9999, pointerEvents: "none", overflow: "hidden",
      fontFamily: "'Courier New', monospace", color: "#fff",
    }}>
      {/* TOP LEFT — Tacho + Speed */}
      <div style={{ position: "absolute", top: 16, left: 16 }}>
        <div style={{ ...box, padding: 0, width: 110, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 110, height: 90, padding: "10px 15px 0" }}>
            <Tacho ratio={rpmRatio} />
          </div>
          <div style={{ fontSize: 32, fontWeight: "bold", lineHeight: 1, textAlign: "center" }}>{kmh}</div>
          <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 8 }}>KM/H</div>
        </div>
      </div>

      {/* TOP RIGHT — Timing */}
      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        {currentLap > 0 ? (
          <>
            {/* Lap timer */}
            <div style={{ ...box, minWidth: 190 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, opacity: 0.5 }}>LAP {currentLap}</span>
                <span style={{ fontSize: 26, fontWeight: "bold", letterSpacing: -1 }}>{fmt(lapTime)}</span>
              </div>
            </div>

            {/* Sectors */}
            <div style={{ ...box, minWidth: 190 }}>
              <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>{showLast ? "LAST LAP" : "SECTORS"}</div>
              {showLast ? (
                <>
                  <SectorRow label="S1" time={lastS1} best={prevBestS1} />
                  <SectorRow label="S2" time={lastS2} best={prevBestS2} />
                  <SectorRow label="S3" time={lastS3} best={prevBestS3} />
                </>
              ) : (
                <>
                  <SectorRow label="S1" time={curS1} best={bestS1} />
                  <SectorRow label="S2" time={curS2} best={bestS2} />
                  <SectorRow label="S3" time={curS3} best={bestS3} />
                </>
              )}
            </div>

            {/* Last + Best laps */}
            {(lastLapTime !== null || bestLapTime !== null) && (
              <div style={{ ...box, minWidth: 190, fontSize: 12 }}>
                {lastLapTime !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                    <span style={{ opacity: 0.5 }}>LAST</span>
                    <span>{fmt(lastLapTime)}</span>
                    {prevBestLap !== null && (
                      <span style={{ fontSize: 10, marginLeft: 6, color: lastLapTime <= prevBestLap ? "#22c55e" : "#ef4444" }}>
                        {fmtDelta(lastLapTime - prevBestLap)}
                      </span>
                    )}
                  </div>
                )}
                {bestLapTime !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                    <span style={{ opacity: 0.5 }}>BEST</span>
                    <span style={{ color: "#a855f7", fontWeight: "bold" }}>{fmt(bestLapTime)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ ...box, fontSize: 14, opacity: 0.9, textAlign: "center" }}>
            <div style={{ fontWeight: "bold" }}>GO</div>
            <div style={{ fontSize: 10, opacity: 0.6 }}>DRIVE TO START</div>
          </div>
        )}
      </div>

      {/* BOTTOM RIGHT — Controls hint */}
      <div style={{ position: "absolute", bottom: 12, right: 12, fontSize: 10, opacity: 0.35 }}>
        WASD drive · SPACE drift · R respawn
      </div>
    </div>
  );
}
