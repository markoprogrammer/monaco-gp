import { create } from "zustand";

interface GameState {
  currentLap: number;
  lapTime: number;
  bestLapTime: number | null;
  lastLapTime: number | null;
  lapTimes: number[];

  // Sector split times (when each sensor was crossed)
  s1Time: number | null;
  s2Time: number | null;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  lastS1: number | null;
  lastS2: number | null;
  lastS3: number | null;

  // Previous bests — for delta display (before current lap updated them)
  prevBestS1: number | null;
  prevBestS2: number | null;
  prevBestS3: number | null;
  prevBestLap: number | null;

  checkpointPassed: boolean;
  speed: number;

  setSpeed: (speed: number) => void;
  passCheckpoint: () => void;
  hitSector1: () => void;
  hitSector2: () => void;
  crossFinishLine: () => void;
  tick: (delta: number) => void;
}

export const useGameState = create<GameState>((set, get) => ({
  currentLap: 0,
  lapTime: 0,
  bestLapTime: null,
  lastLapTime: null,
  lapTimes: [],
  s1Time: null,
  s2Time: null,
  bestS1: null,
  bestS2: null,
  bestS3: null,
  lastS1: null,
  lastS2: null,
  lastS3: null,
  prevBestS1: null,
  prevBestS2: null,
  prevBestS3: null,
  prevBestLap: null,
  checkpointPassed: false,
  speed: 0,

  setSpeed: (speed) => set({ speed }),
  passCheckpoint: () => set({ checkpointPassed: true }),

  hitSector1: () => {
    const { currentLap, s1Time, lapTime } = get();
    if (currentLap < 1 || s1Time !== null) return;
    set({ s1Time: lapTime });
  },

  hitSector2: () => {
    const { currentLap, s2Time, lapTime } = get();
    if (currentLap < 1 || s2Time !== null) return;
    set({ s2Time: lapTime });
  },

  crossFinishLine: () => {
    const state = get();

    // First crossing — start timing
    if (state.currentLap === 0) {
      set({ currentLap: 1, lapTime: 0, checkpointPassed: false, s1Time: null, s2Time: null });
      return;
    }

    if (!state.checkpointPassed) return;

    const totalTime = state.lapTime;
    const s1 = state.s1Time ?? totalTime;
    const s2 = state.s2Time ?? totalTime;
    const sec1 = s1;
    const sec2 = s2 - s1;
    const sec3 = totalTime - s2;

    const best = state.bestLapTime === null ? totalTime : Math.min(state.bestLapTime, totalTime);

    // Save previous bests BEFORE updating — HUD uses these for delta
    const prevBestS1 = state.bestS1;
    const prevBestS2 = state.bestS2;
    const prevBestS3 = state.bestS3;
    const prevBestLap = state.bestLapTime;

    set({
      currentLap: state.currentLap + 1,
      lapTime: 0,
      bestLapTime: best,
      lastLapTime: totalTime,
      lapTimes: [...state.lapTimes, totalTime],
      lastS1: sec1,
      lastS2: sec2,
      lastS3: sec3,
      // Store previous bests for delta display
      prevBestS1,
      prevBestS2,
      prevBestS3,
      prevBestLap,
      bestS1: state.bestS1 === null ? sec1 : Math.min(state.bestS1, sec1),
      bestS2: state.bestS2 === null ? sec2 : Math.min(state.bestS2, sec2),
      bestS3: state.bestS3 === null ? sec3 : Math.min(state.bestS3, sec3),
      checkpointPassed: false,
      s1Time: null,
      s2Time: null,
    });
  },

  tick: (delta) => {
    const { currentLap, lapTime } = get();
    if (currentLap > 0) {
      set({ lapTime: lapTime + delta });
    }
  },
}));
