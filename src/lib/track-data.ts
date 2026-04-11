import { Vector3 } from "three";

// Simplified Circuit de Monaco — scaled 1.5x for longer laps
// Same layout, more room to drive

const S = 1.5; // scale factor

export const TRACK_POINTS: Vector3[] = [
  // === Start/Finish straight ===
  new Vector3(-15 * S, 0, 30 * S),
  new Vector3(-15 * S, 0, 10 * S),
  new Vector3(-15 * S, 0, -10 * S),
  new Vector3(-15 * S, 0, -30 * S),

  // === Sainte Devote ===
  new Vector3(-12 * S, 0.5, -48 * S),
  new Vector3(-5 * S, 1, -58 * S),
  new Vector3(10 * S, 1.5, -65 * S),

  // === Beau Rivage — uphill ===
  new Vector3(30 * S, 3, -70 * S),
  new Vector3(50 * S, 5, -75 * S),
  new Vector3(70 * S, 7, -80 * S),

  // === Casino Square — hairpin ===
  new Vector3(90 * S, 9, -82 * S),
  new Vector3(105 * S, 10, -78 * S),
  new Vector3(112 * S, 10, -68 * S),
  new Vector3(110 * S, 10, -55 * S),
  new Vector3(100 * S, 10, -48 * S),

  // === Mirabeau — downhill ===
  new Vector3(95 * S, 9, -38 * S),
  new Vector3(93 * S, 8, -25 * S),
  new Vector3(93 * S, 7, -12 * S),

  // === Tunnel ===
  new Vector3(95 * S, 6, 5 * S),
  new Vector3(96 * S, 5, 22 * S),
  new Vector3(95 * S, 4, 38 * S),
  new Vector3(92 * S, 3, 52 * S),

  // === Chicane ===
  new Vector3(85 * S, 2, 62 * S),
  new Vector3(72 * S, 1.5, 68 * S),
  new Vector3(58 * S, 1, 66 * S),

  // === Swimming Pool ===
  new Vector3(44 * S, 0.5, 60 * S),
  new Vector3(32 * S, 0.3, 62 * S),
  new Vector3(22 * S, 0.2, 58 * S),

  // === Rascasse ===
  new Vector3(12 * S, 0.1, 52 * S),
  new Vector3(5 * S, 0, 48 * S),
  new Vector3(0 * S, 0, 44 * S),
  new Vector3(-5 * S, 0, 42 * S),

  // === Anthony Noghes ===
  new Vector3(-10 * S, 0, 40 * S),
  new Vector3(-14 * S, 0, 36 * S),
];

export const TRACK_WIDTH = 15;
export const GUARDRAIL_HEIGHT = 1.5;
