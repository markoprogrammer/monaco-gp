import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AudioStore {
  /** When true, all in-game sounds (engine, bots, crash, drift) are silenced. Radio is independent. */
  gameMuted: boolean;
  toggleGameMuted: () => void;
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      gameMuted: false,
      toggleGameMuted: () => set((s) => ({ gameMuted: !s.gameMuted })),
    }),
    { name: "mgp:audio" },
  ),
);

/** Module-level snapshot for hot paths (per-frame gain writes) — avoids React subscription overhead. */
export function isGameMuted(): boolean {
  return useAudioStore.getState().gameMuted;
}
