// Shared race-progress registry — mutated each frame by Car/Bot, read by RaceTracker.
// Each progress value is `lap + t` where t ∈ [0, 1) is the parametric position on the spline.

export interface ProgressEntry {
  progress: number; // monotonically increasing across laps
  isPlayer: boolean;
  speed: number;    // current ground speed (units/s) — used by bot AI for spacing
}

export const raceRegistry: ProgressEntry[] = [];

export function registerEntry(isPlayer: boolean): ProgressEntry {
  const entry: ProgressEntry = { progress: 0, isPlayer, speed: 0 };
  raceRegistry.push(entry);
  return entry;
}

export function unregisterEntry(entry: ProgressEntry) {
  const idx = raceRegistry.indexOf(entry);
  if (idx >= 0) raceRegistry.splice(idx, 1);
}

export function clearRegistry() {
  raceRegistry.length = 0;
}
