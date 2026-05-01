import { create } from "zustand";

export type IntroPhase = "flying" | "lights" | "racing";

interface IntroState {
  phase: IntroPhase;
  // Wall-clock millis at which the current phase started.
  phaseStartedAt: number;
  setPhase: (p: IntroPhase) => void;
}

export const useIntroStore = create<IntroState>((set) => ({
  phase: "flying",
  phaseStartedAt: typeof performance !== "undefined" ? performance.now() : 0,
  setPhase: (p) =>
    set({
      phase: p,
      phaseStartedAt: typeof performance !== "undefined" ? performance.now() : 0,
    }),
}));
