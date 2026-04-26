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
    // Hold Shift to avoid conflict with right-steering (KeyD).
    if (e.code === "KeyD" && e.shiftKey) useDebugStore.getState().toggle();
  });
}
