// Bot AI — pre-computed cornering speed profile along the track spline.
// Each spline sample gets a max speed based on local curvature and a forward-decel
// pass so bots brake BEFORE the corner, not in it.

import { CatmullRomCurve3, Vector3 } from "three";
import { TRACK_POINTS } from "./track-data";
import { VEHICLE } from "./physics-config";

const SAMPLES = 480;

// Lateral acceleration the bots are willing to commit to in a corner (m/s^2).
// Higher = faster through corners. Pushed up so bots stay competitive with the player.
const LAT_ACCEL = 44;

// Decel envelope (m/s per metre travelled). Sets how aggressively bots can brake
// into a corner from a fast straight. Lower = brake later, carry more speed in.
const DECEL_PER_M = 0.42;

const curve = new CatmullRomCurve3(TRACK_POINTS, true, "catmullrom", 0.5);
const lapLength = curve.getLength();

const cornerSpeed: number[] = new Array(SAMPLES);

{
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const t1 = new Vector3();
  const t2 = new Vector3();

  for (let i = 0; i < SAMPLES; i++) {
    const tB = i / SAMPLES;
    const tA = ((i - 1 + SAMPLES) % SAMPLES) / SAMPLES;
    const tC = ((i + 1) % SAMPLES) / SAMPLES;
    curve.getPointAt(tA, a);
    curve.getPointAt(tB, b);
    curve.getPointAt(tC, c);

    t1.copy(b).sub(a);
    t2.copy(c).sub(b);
    const segLen = (t1.length() + t2.length()) / 2;
    t1.normalize();
    t2.normalize();
    // Curvature ≈ |Δtangent| / arclength
    const kappa = segLen > 1e-6 ? t1.distanceTo(t2) / segLen : 0;
    const v = kappa > 1e-4
      ? Math.min(VEHICLE.maxForwardSpeed, Math.sqrt(LAT_ACCEL / kappa))
      : VEHICLE.maxForwardSpeed;
    cornerSpeed[i] = v;
  }

  // Backwards smoothing: each sample's speed must be reachable from the next
  // sample under the brake envelope. This makes bots slow BEFORE corner entry.
  const sampleLen = lapLength / SAMPLES;
  const dropPerStep = DECEL_PER_M * sampleLen;
  for (let pass = 0; pass < 6; pass++) {
    for (let i = SAMPLES - 1; i >= 0; i--) {
      const next = cornerSpeed[(i + 1) % SAMPLES]!;
      if (cornerSpeed[i]! > next + dropPerStep) {
        cornerSpeed[i] = next + dropPerStep;
      }
    }
  }
}

export const TRACK_LAP_LENGTH = lapLength;

export function getCornerSpeed(t: number): number {
  const wrapped = ((t % 1) + 1) % 1;
  const idx = Math.floor(wrapped * SAMPLES) % SAMPLES;
  return cornerSpeed[idx]!;
}
