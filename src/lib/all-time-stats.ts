import { create } from "zustand";
import { supabase } from "./supabase";

const COUNT_FETCH_LIMIT = 10000;

export async function fetchAllTimeUserCount(): Promise<number | null> {
  const { data, error } = await supabase
    .from("lap_times")
    .select("username")
    .limit(COUNT_FETCH_LIMIT);
  if (error) {
    console.warn("[all-time-users]", error.message);
    return null;
  }
  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.username);
  return set.size;
}

interface UserStatsStore {
  bestLapMs: number | null;
  rank: number | null;
  total: number | null;
  /** Optimistic update — call right after a lap finishes. */
  recordLap: (ms: number) => void;
  /** Authoritative rank/total/best from a full agg. */
  setLeaderboardSnapshot: (rank: number | null, total: number | null, bestMs: number | null) => void;
  /** Authoritative load from the server (fetches top 5000 to derive rank). */
  loadFor: (username: string) => Promise<void>;
  reset: () => void;
}

const FETCH_LIMIT = 5000;

export const useUserStatsStore = create<UserStatsStore>((set, get) => ({
  bestLapMs: null,
  rank: null,
  total: null,
  recordLap: (ms) => {
    const cur = get().bestLapMs;
    if (cur == null || ms < cur) set({ bestLapMs: ms });
  },
  setLeaderboardSnapshot: (rank, total, bestMs) => {
    const curBest = get().bestLapMs;
    set({
      rank,
      total,
      bestLapMs:
        bestMs == null ? curBest : curBest == null ? bestMs : Math.min(curBest, bestMs),
    });
  },
  loadFor: async (username) => {
    const { data, error } = await supabase
      .from("lap_times")
      .select("username, lap_time_ms")
      .order("lap_time_ms", { ascending: true })
      .limit(FETCH_LIMIT);
    if (error) {
      console.warn("[user-stats load]", error.message);
      return;
    }
    const agg = new Map<string, number>();
    for (const r of data ?? []) {
      const cur = agg.get(r.username);
      if (cur == null || r.lap_time_ms < cur) agg.set(r.username, r.lap_time_ms);
    }
    const sorted = [...agg.entries()].sort((a, b) => a[1] - b[1]);
    const total = sorted.length;
    const lower = username.toLowerCase();
    const idx = sorted.findIndex(([u]) => u.toLowerCase() === lower);
    if (idx < 0) {
      set({ rank: null, total });
      return;
    }
    const entry = sorted[idx];
    if (!entry) {
      set({ rank: null, total });
      return;
    }
    const best = entry[1];
    const curBest = get().bestLapMs;
    set({
      rank: idx + 1,
      total,
      bestLapMs: curBest == null ? best : Math.min(curBest, best),
    });
  },
  reset: () => set({ bestLapMs: null, rank: null, total: null }),
}));
