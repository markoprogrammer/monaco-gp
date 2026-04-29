import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../lib/user-store";
import { useMultiplayerStore } from "../lib/multiplayer";
import { buildOutgoingUrl, ownRef } from "../lib/portal-params";

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches || "ontouchstart" in window);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isTouch;
}

interface Row {
  username: string;
  lap_time_ms: number;
}

const REFRESH_MS = 8000;

function formatLap(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export default function Leaderboard() {
  const isTouch = useIsTouch();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(!isTouch);
  const username = useUserStore((s) => s.username);
  const selfColor = useMultiplayerStore((s) => s.selfColor);

  const exitToVibeJam = useCallback(() => {
    const url = buildOutgoingUrl("https://vibej.am/portal/2026", {
      username: username ?? undefined,
      color: selfColor,
      ref: ownRef(),
    });
    window.location.href = url;
  }, [username, selfColor]);

  const load = useCallback(async () => {
    // Pull a generous slice and reduce to best-per-user client-side.
    const { data, error } = await supabase
      .from("lap_times")
      .select("username, lap_time_ms")
      .order("lap_time_ms", { ascending: true })
      .limit(200);
    if (error) {
      console.warn("[leaderboard]", error.message);
      return;
    }
    const bestByUser = new Map<string, number>();
    for (const r of data ?? []) {
      const cur = bestByUser.get(r.username);
      if (cur == null || r.lap_time_ms < cur) bestByUser.set(r.username, r.lap_time_ms);
    }
    const top = [...bestByUser.entries()]
      .map(([username, lap_time_ms]) => ({ username, lap_time_ms }))
      .sort((a, b) => a.lap_time_ms - b.lap_time_ms)
      .slice(0, 10);
    setRows(top);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Realtime: also re-fetch on insert
  useEffect(() => {
    const ch = supabase
      .channel("lap_times:inserts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lap_times" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const wrapperStyle: React.CSSProperties = isTouch
    ? {
        position: "fixed",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }
    : {
        position: "fixed",
        top: "50%",
        right: 16,
        transform: "translateY(-50%)",
        zIndex: 50,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        userSelect: "none",
      };

  return (
    <div style={wrapperStyle}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "block",
          marginLeft: isTouch ? 0 : "auto",
          padding: isTouch ? "5px 10px" : "6px 12px",
          fontSize: isTouch ? 10 : 11,
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "#0a0a0a",
          background: "#FFEC00",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 6,
        }}
      >
        {open ? "Hide" : "Leaderboard"}
      </button>

      {open && (
        <div
          style={{
            width: isTouch ? "min(280px, 92vw)" : 260,
            background: "rgba(10,14,28,0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "12px 14px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "#FFEC00",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Leaderboard
          </div>
          {rows.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9aa4b8", padding: "6px 0" }}>
              No times yet. Set the first one.
            </div>
          ) : (
            <ol
              className="leaderboard-list"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                maxHeight: 5 * 24,
                overflowY: "auto",
                paddingRight: 4,
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(255,255,255,0.2) transparent",
              }}
            >
              {rows.map((r, i) => {
                const me = r.username === username;
                return (
                  <li
                    key={`${r.username}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 0",
                      borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      fontVariantNumeric: "tabular-nums",
                      fontSize: 13,
                      color: me ? "#FFEC00" : "#fff",
                      fontWeight: me ? 700 : 500,
                    }}
                  >
                    <span style={{ width: 18, color: "#9aa4b8", textAlign: "right" }}>{i + 1}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.username}
                    </span>
                    <span>{formatLap(r.lap_time_ms)}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <button
            type="button"
            onClick={exitToVibeJam}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "9px 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#0a0a0a",
              background: "linear-gradient(90deg, #22d3ee, #06b6d4)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              boxShadow: "0 0 18px rgba(34,211,238,0.35)",
            }}
            title="Hop to another Vibe Jam 2026 game"
          >
            ↪ Vibe Jam Portal
          </button>

          <div
            style={{
              marginTop: 10,
              fontSize: 9,
              lineHeight: 1.5,
              color: "#6b7589",
              textAlign: "center",
              letterSpacing: "0.02em",
            }}
          >
            Car: GPT Image 2 ·{" "}
            <a href="https://www.tripo3d.ai/" target="_blank" rel="noreferrer" style={{ color: "#8a93a8" }}>
              Tripo3D
            </a>
            <br />
            Music:{" "}
            <a href="https://suno.com/" target="_blank" rel="noreferrer" style={{ color: "#8a93a8" }}>
              Suno
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
