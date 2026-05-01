import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useDebugStore } from "./debug-store";
import preset from "./presets/kg-monaco.json";

const STORAGE_KEY = "monaco-gp-tuning-v1";

export interface PartParams {
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

export const PART_KEYS = [
  "main-body-car",
  "enteirer",
  "driver-wheel",
  "front-lights",
  "back-lights",
  "back-space-btw-lights",
  "back-table",
  "central-mirror",
  "left-mirror",
  "right-mirror",
  "front-diffusor",
  "right-door-diffusor",
  "tires",
  "rims",
] as const;

export type PartKey = (typeof PART_KEYS)[number];

const DEFAULT_PARTS = preset.parts as Record<PartKey, PartParams>;

const { parts: _, ...DEFAULTS } = preset;

export type NumericKey =
  | "carScale" | "bodyYOffset" | "tireRadius" | "maxSteer" | "rakeRad"
  | "shieldX" | "shieldY" | "shieldZ" | "shieldScale"
  | "numberX" | "numberY" | "numberZ" | "numberScale"
  | "plateX" | "plateY" | "plateZ" | "plateW" | "plateH"
  | "ambientIntensity" | "rimThreshold"
  | "tireWrapOuter" | "tireWrapInner" | "tireWrapWidth";

export type TextKey = "shieldText" | "raceNumber" | "plateText";

export interface TuningState {
  open: boolean;
  parts: Record<PartKey, PartParams>;
  carScale: number;
  bodyYOffset: number;
  tireRadius: number;
  maxSteer: number;
  rakeRad: number;
  shieldText: string;
  raceNumber: string;
  plateText: string;
  shieldX: number; shieldY: number; shieldZ: number; shieldScale: number;
  numberX: number; numberY: number; numberZ: number; numberScale: number;
  plateX: number; plateY: number; plateZ: number; plateW: number; plateH: number;
  ambientIntensity: number;
  rimThreshold: number;
  tireWrapOuter: number;
  tireWrapInner: number;
  tireWrapWidth: number;
  toggle: () => void;
  setOpen: (v: boolean) => void;
  setPart: (k: PartKey, patch: Partial<PartParams>) => void;
  setNumeric: (k: NumericKey, v: number) => void;
  setText: (k: TextKey, v: string) => void;
  reset: () => void;
  exportJson: () => string;
}

export const useTuningStore = create<TuningState>()(
  persist(
    (set, get) => ({
      open: false,
      parts: structuredClone(DEFAULT_PARTS),
      ...DEFAULTS,
      toggle: () => {
        const next = !get().open;
        set({ open: next });
        const dbg = useDebugStore.getState();
        if (dbg.debug !== next) dbg.toggle();
      },
      setOpen: (v) => {
        set({ open: v });
        const dbg = useDebugStore.getState();
        if (dbg.debug !== v) dbg.toggle();
      },
      setPart: (k, patch) => set((s) => ({ parts: { ...s.parts, [k]: { ...s.parts[k], ...patch } } })),
      setNumeric: (k, v) => set({ [k]: v } as Partial<TuningState>),
      setText: (k, v) => set({ [k]: v } as Partial<TuningState>),
      reset: () => {
        set({ parts: structuredClone(DEFAULT_PARTS), ...DEFAULTS });
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      },
      exportJson: () => {
        const s = get();
        const data: Record<string, unknown> = { parts: s.parts };
        (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).forEach((k) => {
          data[k] = s[k];
        });
        return JSON.stringify(data, null, 2);
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist only the data, not transient UI state or functions.
      partialize: (state) => {
        const data: Record<string, unknown> = { parts: state.parts };
        (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).forEach((k) => {
          data[k] = state[k];
        });
        return data as Partial<TuningState>;
      },
      version: 9,
    },
  ),
);

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    // Shift+D opens tuning panel (plain D = steering; Cmd/Ctrl+D = orbit cam).
    if (e.code === "KeyD" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      useTuningStore.getState().toggle();
    }
  });
}
