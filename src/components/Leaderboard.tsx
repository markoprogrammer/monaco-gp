import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../lib/user-store";
import { useMultiplayerStore } from "../lib/multiplayer";
import { useGameState } from "../hooks/useGameState";
import { buildOutgoingUrl, ownRef } from "../lib/portal-params";

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

interface Row {
  username: string;
  lap_time_ms: number;
  laps: number;
}

type Mode = "best" | "laps" | "online";

const REFRESH_MS = 8000;
const FETCH_LIMIT = 5000;
const TOP_N = 100;

function formatLap(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export default function Leaderboard() {
  const isTouch = useIsTouch();
  const [rows, setRows] = useState<Row[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [mode, setMode] = useState<Mode>("best");
  const [open, setOpen] = useState(!isTouch);
  const [maximized, setMaximized] = useState(false);
  const [autoClosedOnce, setAutoClosedOnce] = useState(false);
  const username = useUserStore((s) => s.username);
  const selfColor = useMultiplayerStore((s) => s.selfColor);
  const selfId = useMultiplayerStore((s) => s.selfId);
  const players = useMultiplayerStore((s) => s.players);
  const speed = useGameState((s) => s.speed);

  const colorByNick = new Map<string, string>();
  for (const p of Object.values(players)) {
    if (p.nick && p.color) colorByNick.set(p.nick, p.color);
  }
  if (username && selfColor) colorByNick.set(username, selfColor);

  // Auto-close on mobile the FIRST time the player starts driving — afterwards
  // the user is in charge (otherwise tapping to re-open while moving fights us).
  useEffect(() => {
    if (!isTouch || autoClosedOnce) return;
    if (speed > 1) {
      setOpen(false);
      setAutoClosedOnce(true);
    }
  }, [isTouch, autoClosedOnce, speed]);

  const handleToggle = () => {
    setOpen((o) => !o);
    setAutoClosedOnce(true); // any manual toggle disables further auto-close
  };

  const exitToVibeJam = useCallback(() => {
    const url = buildOutgoingUrl("https://vibej.am/portal/2026", {
      username: username ?? undefined,
      color: selfColor,
      ref: ownRef(),
    });
    window.location.href = url;
  }, [username, selfColor]);

  const load = useCallback(async () => {
    // Pull a generous slice and aggregate per-user client-side.
    const { data, error } = await supabase
      .from("lap_times")
      .select("username, lap_time_ms")
      .order("lap_time_ms", { ascending: true })
      .limit(FETCH_LIMIT);
    if (error) {
      console.warn("[leaderboard]", error.message);
      return;
    }
    const agg = new Map<string, { best: number; laps: number }>();
    for (const r of data ?? []) {
      const cur = agg.get(r.username);
      if (cur == null) {
        agg.set(r.username, { best: r.lap_time_ms, laps: 1 });
      } else {
        if (r.lap_time_ms < cur.best) cur.best = r.lap_time_ms;
        cur.laps += 1;
      }
    }
    const all = [...agg.entries()].map(([username, v]) => ({
      username,
      lap_time_ms: v.best,
      laps: v.laps,
    }));
    setTotalUsers(all.length);
    setRows(all);
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

  const isMaximized = open && maximized;

  const wrapperStyle: React.CSSProperties = isTouch
    ? isMaximized
      ? {
          position: "fixed",
          top: 8,
          bottom: 8,
          left: 8,
          right: 8,
          zIndex: 19000,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#fff",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }
      : {
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 19000,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#fff",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }
    : isMaximized
      ? {
          position: "fixed",
          top: 16,
          bottom: 16,
          right: 16,
          zIndex: 19000,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#fff",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }
      : open
        ? {
            position: "fixed",
            top: 280,
            right: 16,
            zIndex: 19000,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#fff",
            userSelect: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }
        : {
            position: "fixed",
            top: "50%",
            right: 16,
            transform: "translateY(-50%)",
            zIndex: 19000,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#fff",
            userSelect: "none",
          };

  return (
    <div style={wrapperStyle}>
      <button
        onClick={handleToggle}
        aria-label={open ? "Hide leaderboard" : "Show leaderboard"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: isTouch ? 6 : 6,
          marginLeft: isTouch ? 0 : "auto",
          padding: isTouch ? "5px 10px" : "6px 12px",
          minHeight: isTouch ? 30 : undefined,
          minWidth: isTouch ? 100 : undefined,
          fontSize: isTouch ? 10 : 11,
          fontWeight: 700,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          color: "#0a0a0a",
          background: "#FFEC00",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          marginBottom: 6,
          boxShadow: isTouch ? "0 2px 8px rgba(0,0,0,0.35)" : undefined,
        }}
      >
        <span>{open ? "Hide" : "Leaderboard"}</span>
        <span style={{ fontSize: isTouch ? 12 : 13, lineHeight: 1 }} aria-hidden="true">
          {open ? "✕" : "▾"}
        </span>
      </button>

      {open && (
        <div
          style={{
            width: isTouch
              ? isMaximized
                ? "100%"
                : "min(280px, 92vw)"
              : isMaximized
                ? 360
                : 260,
            background: "rgba(10,14,28,0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "12px 14px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            ...(isMaximized
              ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }
              : {}),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "#FFEC00",
                textTransform: "uppercase",
              }}
            >
              Leaderboard
            </div>
            <button
              type="button"
              onClick={() => setMaximized((m) => !m)}
              aria-label={isMaximized ? "Restore leaderboard" : "Maximize leaderboard"}
              title={isMaximized ? "Restore" : "Maximize"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: isTouch ? 32 : 22,
                height: isTouch ? 32 : 22,
                padding: 0,
                fontSize: isTouch ? 18 : 13,
                lineHeight: 1,
                color: "#cdd3df",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true">{isMaximized ? "⤡" : "⤢"}</span>
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Leaderboard mode"
            style={{
              display: "flex",
              gap: 4,
              padding: 3,
              marginBottom: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 7,
            }}
          >
            {(
              [
                { id: "best", label: "Fastest" },
                { id: "laps", label: "Most Laps" },
                { id: "online", label: "ONLINE" },
              ] as { id: Mode; label: string }[]
            ).map((t) => {
              const active = mode === t.id;
              const isOnline = t.id === "online";
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setMode(t.id)}
                  style={{
                    flex: 1,
                    padding: "5px 4px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: active ? "#0a0a0a" : "#cdd3df",
                    background: active ? "#FFEC00" : "transparent",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  <span>{t.label}</span>
                  {isOnline && (
                    <>
                      <strong style={{ color: active ? "#0a0a0a" : "#fff" }}>
                        {Object.keys(players).length}
                      </strong>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#22c55e",
                          boxShadow: "0 0 5px #22c55e",
                        }}
                      />
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {(() => {
            if (mode === "online") {
              const onlineList = Object.values(players).sort((a, b) => {
                if (a.id === selfId) return -1;
                if (b.id === selfId) return 1;
                return a.joinedAt - b.joinedAt;
              });
              if (onlineList.length === 0) {
                return (
                  <div style={{ fontSize: 13, color: "#9aa4b8", padding: "6px 0", textAlign: "center" }}>
                    No drivers online yet.
                  </div>
                );
              }
              return (
                <ol
                  className="leaderboard-list"
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    maxHeight: isMaximized ? "none" : 5 * 24,
                    overflowY: "auto",
                    paddingRight: 4,
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.2) transparent",
                    ...(isMaximized ? { flex: 1, minHeight: 0 } : {}),
                  }}
                >
                  {onlineList.map((p, i) => {
                    const me = p.id === selfId;
                    return (
                      <li
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "5px 0",
                          borderBottom: i < onlineList.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          fontSize: 13,
                          color: me ? "#FFEC00" : p.color ?? "#fff",
                          fontWeight: me ? 700 : 500,
                        }}
                      >
                        <span style={{ width: 22, color: "#9aa4b8", textAlign: "right" }}>{i + 1}</span>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: p.color || "#888",
                            boxShadow: p.color ? `0 0 4px ${p.color}` : undefined,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.nick}
                          {me && (
                            <span style={{ color: "#9aa4b8", fontWeight: 500, marginLeft: 4 }}>
                              (you)
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              );
            }

            const sorted =
              mode === "best"
                ? [...rows].sort((a, b) => a.lap_time_ms - b.lap_time_ms)
                : [...rows].sort(
                    (a, b) => b.laps - a.laps || a.lap_time_ms - b.lap_time_ms,
                  );
            const top = sorted.slice(0, TOP_N);
            const othersShown = Math.max(0, totalUsers - top.length);

            if (top.length === 0) {
              return (
                <div style={{ fontSize: 13, color: "#9aa4b8", padding: "6px 0" }}>
                  No times yet. Set the first one.
                </div>
              );
            }

            return (
              <>
                <ol
                  className="leaderboard-list"
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    maxHeight: isMaximized ? "none" : 5 * 24,
                    overflowY: "auto",
                    paddingRight: 4,
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.2) transparent",
                    ...(isMaximized ? { flex: 1, minHeight: 0 } : {}),
                  }}
                >
                  {top.map((r, i) => {
                    const me = r.username === username;
                    const playerColor = colorByNick.get(r.username);
                    const nameColor = me ? "#FFEC00" : playerColor ?? "#fff";
                    return (
                      <li
                        key={`${r.username}-${i}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "5px 0",
                          borderBottom: i < top.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          fontVariantNumeric: "tabular-nums",
                          fontSize: 13,
                          color: nameColor,
                          fontWeight: me ? 700 : 500,
                        }}
                      >
                        <span style={{ width: 22, color: "#9aa4b8", textAlign: "right" }}>{i + 1}</span>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: playerColor ?? "rgba(255,255,255,0.18)",
                            flexShrink: 0,
                            boxShadow: playerColor ? `0 0 4px ${playerColor}` : undefined,
                          }}
                        />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.username}
                        </span>
                        <span style={{ color: "#fff" }}>
                          {mode === "best"
                            ? formatLap(r.lap_time_ms)
                            : `${r.laps} ${r.laps === 1 ? "lap" : "laps"}`}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {othersShown > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "#9aa4b8",
                      textAlign: "center",
                      letterSpacing: "0.04em",
                    }}
                  >
                    + {othersShown} {othersShown === 1 ? "other driver" : "other drivers"}
                  </div>
                )}
              </>
            );
          })()}

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
