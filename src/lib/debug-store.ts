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
    // Cmd/Ctrl+D toggles orbit camera. Shift+D kept as alt for browsers where Cmd+D is blocked.
    // Plain D is reserved for right-steering.
    if (e.code === "KeyD" && (e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      useDebugStore.getState().toggle();
    }
  });
}
