import { useEffect, useRef, useState } from "react";
import { useGameState } from "../hooks/useGameState";
import { useUserStore } from "../lib/user-store";
import { supabase } from "../lib/supabase";
import { useUserStatsStore } from "../lib/all-time-stats";

const FETCH_LIMIT = 5000;
const TOAST_MS = 3500;

interface LapToast {
  id: number;
  rank: number | null;
  total: number | null;
  rankDelta: number | null;
  sessionLap: number;
  allTimeLaps: number | null;
  lapMs: number;
  bestLapMs: number;
  gapToBestMs: number;
  isNewBestLap: boolean;
  isTrackRecord: boolean;
  loading: boolean;
}

function formatLap(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function formatGap(ms: number): string {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${s}.${cs.toString().padStart(2, "0")}`;
}

export default function LapSaver() {
  const lapCount = useGameState((s) => s.lapTimes.length);
  const username = useUserStore((s) => s.username);
  const seenLapRef = useRef(0);
  const prevRankRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);
  const [toast, setToast] = useState<LapToast | null>(null);

  useEffect(() => {
    if (!username || lapCount === 0) return;
    if (seenLapRef.current >= lapCount) return;
    seenLapRef.current = lapCount;

    const { lastLapTime } = useGameState.getState();
    if (lastLapTime == null) return;

    const lapMs = Math.round(lastLapTime * 1000);
    // Sensor double-fires are gated upstream in useGameState (5s cooldown).
    // Keep a generous bound here so legit fast laps still get recorded.
    if (lapMs < 5_000 || lapMs >= 600_000) return;

    // Compare against the all-time best in the store (server-loaded + session updates),
    // not just session memory. Otherwise the first lap of every session is "New best lap".
    const storeBest = useUserStatsStore.getState().bestLapMs;
    const isNewBestLap = storeBest == null || lapMs < storeBest;
    const optimisticBest = storeBest == null ? lapMs : Math.min(storeBest, lapMs);
    useUserStatsStore.getState().recordLap(lapMs);

    const id = ++toastIdRef.current;
    setToast({
      id,
      rank: null,
      total: null,
      rankDelta: null,
      sessionLap: lapCount,
      allTimeLaps: null,
      lapMs,
      bestLapMs: optimisticBest,
      gapToBestMs: Math.max(0, lapMs - optimisticBest),
      isNewBestLap,
      isTrackRecord: false,
      loading: true,
    });
    const dismissTimer = window.setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, TOAST_MS);

    void (async () => {
      const { error } = await supabase
        .from("lap_times")
        .insert({ username, lap_time_ms: lapMs });
      if (error) {
        console.warn("[lap_times insert]", error.message);
        setToast((t) => (t && t.id === id ? { ...t, loading: false } : t));
        return;
      }

      const { data, error: qErr } = await supabase
        .from("lap_times")
        .select("username, lap_time_ms")
        .order("lap_time_ms", { ascending: true })
        .limit(FETCH_LIMIT);
      if (qErr) {
        console.warn("[lap_times rank query]", qErr.message);
        setToast((t) => (t && t.id === id ? { ...t, loading: false } : t));
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
      const own = agg.get(username);
      if (own == null) {
        agg.set(username, { best: lapMs, laps: 1 });
      } else if (!(data ?? []).some((r) => r.username === username && r.lap_time_ms === lapMs)) {
        own.best = Math.min(own.best, lapMs);
        own.laps += 1;
      }

      const sorted = [...agg.entries()].sort((a, b) => a[1].best - b[1].best);
      const pbRank = sorted.findIndex(([u]) => u === username) + 1;
      const total = sorted.length;
      const ownEntry = agg.get(username);
      const allTimeLaps = ownEntry?.laps ?? 1;
      const bestLapMs = ownEntry?.best ?? lapMs;

      // Lap-specific rank: where THIS lap's time would slot among other users' bests.
      // Counts distinct users (not self) whose best is faster than this lap.
      let fasterThanThisLap = 0;
      let minOtherBest = Infinity;
      for (const [u, v] of agg.entries()) {
        if (u === username) continue;
        if (v.best < lapMs) fasterThanThisLap++;
        if (v.best < minOtherBest) minOtherBest = v.best;
      }
      const lapRank = fasterThanThisLap + 1;
      // Track record only counts when there's a prior leader to dethrone.
      const isTrackRecord = minOtherBest !== Infinity && lapMs < minOtherBest;

      const prevRank = prevRankRef.current;
      const rankDelta = prevRank == null ? null : prevRank - lapRank;
      if (lapRank > 0) prevRankRef.current = lapRank;
      // HUD reflects all-time best position; toast reflects this lap's position.
      useUserStatsStore
        .getState()
        .setLeaderboardSnapshot(pbRank > 0 ? pbRank : null, total, bestLapMs);

      setToast((t) =>
        t && t.id === id
          ? {
              ...t,
              rank: lapRank,
              total,
              rankDelta,
              allTimeLaps,
              bestLapMs,
              gapToBestMs: Math.max(0, lapMs - bestLapMs),
              isTrackRecord,
              loading: false,
            }
          : t,
      );
    })();

    return () => {
      window.clearTimeout(dismissTimer);
    };
  }, [lapCount, username]);

  if (!toast) return null;

  const climbed = toast.rankDelta != null && toast.rankDelta > 0;
  const onBoardFirstTime = !toast.loading && toast.rankDelta == null && toast.rank != null;
  const headerText = toast.loading
    ? toast.isNewBestLap
      ? "Great job — new PB!"
      : "Lap complete"
    : toast.isTrackRecord
      ? "🏁 Track record!"
      : toast.isNewBestLap
        ? "Great job — new PB!"
        : onBoardFirstTime
          ? "On the board"
          : climbed
            ? "New best position"
            : "Lap complete";

  return (
    <div
      key={toast.id}
      style={{
        position: "fixed",
        top: "18%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 19500,
        pointerEvents: "none",
        padding: "14px 22px",
        background: "rgba(10,14,28,0.92)",
        border: "1px solid rgba(255,236,0,0.55)",
        borderRadius: 12,
        boxShadow: "0 14px 50px rgba(0,0,0,0.55), 0 0 24px rgba(255,236,0,0.25)",
        backdropFilter: "blur(10px)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        textAlign: "center",
        minWidth: 220,
        animation: `mgpToastLifecycle ${TOAST_MS}ms ease-out forwards`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "#FFEC00",
          marginBottom: 4,
        }}
      >
        {headerText}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "0.04em",
          color: "#FFEC00",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {toast.rank != null ? (
          <>
            P{toast.rank}
            {toast.total != null && (
              <span style={{ fontSize: 14, color: "#cbd3e1", fontWeight: 600, marginLeft: 6 }}>
                / {toast.total}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: "#7b8499", fontWeight: 700 }}>P–</span>
        )}
      </div>
      {climbed && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "#86efac",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          ↑ {toast.rankDelta} {toast.rankDelta === 1 ? "place" : "places"}
        </div>
      )}
      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          color: "#cbd3e1",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: "#7b8499" }}>Lap {toast.sessionLap}</span>
        <span style={{ margin: "0 6px", color: "#3a4255" }}>·</span>
        <span style={{ color: "#fff", fontWeight: 700 }}>{formatLap(toast.lapMs)}</span>
        {toast.gapToBestMs > 0 && (
          <span style={{ marginLeft: 6, color: "#ff6b6b" }}>+{formatGap(toast.gapToBestMs)}</span>
        )}
        {toast.isNewBestLap && !onBoardFirstTime && (
          <span style={{ marginLeft: 6, color: "#86efac" }}>PB</span>
        )}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 10,
          color: "#7b8499",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ color: "#cbd3e1", fontWeight: 700 }}>Best</span>{" "}
        <span style={{ color: "#fff" }}>{formatLap(toast.bestLapMs)}</span>
        <span style={{ margin: "0 6px", color: "#3a4255" }}>·</span>
        <span style={{ color: "#cbd3e1", fontWeight: 700 }}>
          {toast.allTimeLaps != null ? toast.allTimeLaps : "…"}
        </span>{" "}
        all-time {toast.allTimeLaps === 1 ? "lap" : "laps"}
      </div>
    </div>
  );
}
