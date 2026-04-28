import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const CHANNEL_NAME = "monaco-gp:lobby:v1";
const BROADCAST_HZ = 20;
const BROADCAST_INTERVAL_MS = 1000 / BROADCAST_HZ;

const TEAM_COLORS = [
  "#00d2be", "#ff8700", "#005aff", "#229971", "#1c6cf2",
  "#dc0000", "#6692ff", "#b6babd", "#37bedd", "#ffffff",
];

export interface PlayerInfo {
  id: string;
  nick: string;
  color: string;
  joinedAt: number;
}

export interface RemoteCarState {
  /** server-side received timestamp (ms, performance.now of receiver) */
  rxAt: number;
  /** sender's wall clock at send (ms) — for reordering */
  t: number;
  px: number; py: number; pz: number;
  qx: number; qy: number; qz: number; qw: number;
  speed: number;
}

interface MultiplayerStore {
  selfId: string;
  selfNick: string;
  selfColor: string;
  /** players currently in the room (driven by presence) */
  players: Record<string, PlayerInfo>;
  connected: boolean;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

function getOrCreate(key: string, factory: () => string): string {
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const v = factory();
    sessionStorage.setItem(key, v);
    return v;
  } catch {
    return factory();
  }
}

const selfId = getOrCreate("mgp:selfId", makeId);
const selfColor = getOrCreate("mgp:selfColor", () => TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)]!);

export const useMultiplayerStore = create<MultiplayerStore>(() => ({
  selfId,
  selfNick: "",
  selfColor,
  players: {},
  connected: false,
}));

export function getSelfId(): string {
  return selfId;
}

/** Non-reactive map of remote car states, mutated at high frequency by broadcast handler. */
export const remoteCars = new Map<string, RemoteCarState>();

let channel: RealtimeChannel | null = null;
let lastBroadcastAt = 0;

export function initMultiplayer(nick: string): () => void {
  if (channel) return () => {};
  useMultiplayerStore.setState({ selfNick: nick });
  const ch = supabase.channel(CHANNEL_NAME, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: selfId },
    },
  });
  channel = ch;

  ch.on("broadcast", { event: "car" }, (payload) => {
    const d = payload.payload as RemoteCarState & { id: string };
    if (!d || d.id === selfId) return;
    const prev = remoteCars.get(d.id);
    // Drop out-of-order packets
    if (prev && d.t < prev.t) return;
    remoteCars.set(d.id, {
      rxAt: performance.now(),
      t: d.t,
      px: d.px, py: d.py, pz: d.pz,
      qx: d.qx, qy: d.qy, qz: d.qz, qw: d.qw,
      speed: d.speed,
    });
  });

  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<PlayerInfo>();
    const next: Record<string, PlayerInfo> = {};
    for (const id of Object.keys(state)) {
      const meta = state[id]?.[0];
      if (meta) next[id] = meta;
    }
    useMultiplayerStore.setState({ players: next });

    // prune stale remote car entries
    for (const id of remoteCars.keys()) {
      if (!next[id]) remoteCars.delete(id);
    }
  });

  ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      useMultiplayerStore.setState({ connected: true });
      await ch.track({
        id: selfId,
        nick,
        color: selfColor,
        joinedAt: Date.now(),
      } satisfies PlayerInfo);
    }
  });

  return () => {
    if (channel) {
      void channel.untrack();
      void supabase.removeChannel(channel);
      channel = null;
    }
    remoteCars.clear();
    useMultiplayerStore.setState({ players: {}, connected: false });
  };
}

export function broadcastCarState(
  px: number, py: number, pz: number,
  qx: number, qy: number, qz: number, qw: number,
  speed: number,
): void {
  if (!channel) return;
  const now = performance.now();
  if (now - lastBroadcastAt < BROADCAST_INTERVAL_MS) return;
  lastBroadcastAt = now;
  void channel.send({
    type: "broadcast",
    event: "car",
    payload: {
      id: selfId,
      t: Date.now(),
      px, py, pz,
      qx, qy, qz, qw,
      speed,
    },
  });
}
