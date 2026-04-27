import { create } from "zustand";

interface DebugState {
  debug: boolean;
  toggle: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  debug: false,
  toggle: () => set((s) => ({ debug: !s.debug })),
}));

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    // Cmd/Ctrl+D = orbit camera. Plain D = steering. Shift+D = tuning panel (handled in tuning-store).
    if (e.code === "KeyD" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      useDebugStore.getState().toggle();
    }
  });
}
