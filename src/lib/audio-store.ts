import { create } from "zustand";

interface AudioStore {
  /** When true, all in-game sounds (engine, bots, crash, drift) are silenced. Radio is independent. */
  gameMuted: boolean;
  toggleGameMuted: () => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  // Always start with sound on — fresh load should never land muted by surprise.
  gameMuted: false,
  toggleGameMuted: () => set((s) => ({ gameMuted: !s.gameMuted })),
}));

/** Module-level snapshot for hot paths (per-frame gain writes) — avoids React subscription overhead. */
export function isGameMuted(): boolean {
  return useAudioStore.getState().gameMuted;
}
