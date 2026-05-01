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
/** True only when at least one OTHER player is present — gates outbound broadcasts. */
let hasOthers = false;
/** Last position/rotation/speed actually sent — used to skip frames when idle. */
let lastSent: { px: number; py: number; pz: number; qx: number; qy: number; qz: number; qw: number; speed: number } | null = null;
/** Force the next broadcast through even if nothing changed (e.g. new joiner). */
let forceNextBroadcast = false;
const POS_EPS_SQ = 0.05 * 0.05;       // 5cm
const SPEED_EPS = 0.5;                 // 0.5 m/s
const QUAT_DOT_THRESHOLD = 0.9999;     // ≈ <0.8° rotation change
const HEARTBEAT_MS = 2000;             // send at least one packet every 2s

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

    // Skip per-frame broadcasts when nobody else is listening.
    const wasAlone = !hasOthers;
    hasOthers = Object.keys(next).some((id) => id !== selfId);
    // Someone just joined → push a fresh state immediately so they see us.
    if (wasAlone && hasOthers) forceNextBroadcast = true;

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
    hasOthers = false;
    lastSent = null;
    forceNextBroadcast = false;
    useMultiplayerStore.setState({ players: {}, connected: false });
  };
}

/**
 * Listen-only presence subscription for the start screen — counts how many
 * drivers are currently in the lobby without registering ourselves. The caller
 * receives the count on every sync; returns a cleanup function.
 */
export function subscribePresenceCount(onChange: (count: number) => void): () => void {
  const ch = supabase.channel(CHANNEL_NAME, {
    config: { broadcast: { self: false }, presence: { key: `spectator:${Math.random().toString(36).slice(2, 10)}` } },
  });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<PlayerInfo>();
    // Count only entries whose key looks like a tracked player (uuid/short id),
    // never counting other spectators that may also be watching the lobby.
    const count = Object.values(state).filter((entries) => {
      const meta = entries?.[0];
      return !!meta && !!meta.id;
    }).length;
    onChange(count);
  });
  ch.subscribe();
  // Note: we never call ch.track(), so we don't appear in others' presence state.
  return () => {
    void supabase.removeChannel(ch);
  };
}

export interface SelfPose {
  px: number; py: number; pz: number;
  qx: number; qy: number; qz: number; qw: number;
  speed: number;
}
let selfPose: SelfPose | null = null;
export function getSelfPose(): SelfPose | null {
  return selfPose;
}

export function broadcastCarState(
  px: number, py: number, pz: number,
  qx: number, qy: number, qz: number, qw: number,
  speed: number,
): void {
  // Always cache so the minimap (and any other local-only consumer) can read
  // the live position even when the player is alone in the room.
  selfPose = { px, py, pz, qx, qy, qz, qw, speed };

  if (!channel) return;
  // Optimisation: don't broadcast position when alone. Lap times still go to
  // the DB via LapSaver, and presence/join events still flow on this channel.
  if (!hasOthers) return;
  const now = performance.now();
  if (now - lastBroadcastAt < BROADCAST_INTERVAL_MS) return;

  // Idle suppression: skip when nothing meaningful changed. Send a heartbeat
  // every HEARTBEAT_MS so receivers don't drift on the last interpolated state.
  if (!forceNextBroadcast && lastSent) {
    const dx = px - lastSent.px;
    const dy = py - lastSent.py;
    const dz = pz - lastSent.pz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const dotQ = qx * lastSent.qx + qy * lastSent.qy + qz * lastSent.qz + qw * lastSent.qw;
    const dSpeed = Math.abs(speed - lastSent.speed);
    const stale = now - lastBroadcastAt;
    const moved = distSq >= POS_EPS_SQ || Math.abs(dotQ) < QUAT_DOT_THRESHOLD || dSpeed >= SPEED_EPS;
    if (!moved && stale < HEARTBEAT_MS) return;
  }

  lastBroadcastAt = now;
  forceNextBroadcast = false;
  lastSent = { px, py, pz, qx, qy, qz, qw, speed };
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
