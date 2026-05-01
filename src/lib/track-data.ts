import { Vector3 } from "three";

// Real-shape Circuit de Monaco — flat (y = 0). Points are the line-segment
// vertices of an SVG polyline reference of the actual circuit, centred
// around the origin and scaled up so a lap feels generous.
//
// Source viewBox: 1100 × 510.5, centre (550, 255.25), scale 1.6 → final
// track span ~1760 × 817 world units.

const Y = 0;

export const TRACK_POINTS: Vector3[] = [
  new Vector3(-795.86, Y, 243.54),
  new Vector3(-717.63, Y, 313.23),
  new Vector3(-684.10, Y, 328.42),
  new Vector3(-665.54, Y, 325.31),
  // Wobble vertex at (-670.50, 322.06) removed — only 5u from the previous
  // point and reverses x direction, which Catmull-Rom amplifies into a
  // visible kink in the road outline.
  new Vector3(-665.02, Y, 293.89),
  new Vector3(-682.26, Y, 237.78),
  new Vector3(-684.45, Y, 198.93),
  new Vector3(-676.30, Y, 114.30),
  new Vector3(-662.19, Y, 62.51),
  new Vector3(-641.31, Y, 45.22),
  new Vector3(-605.60, Y, 40.40),
  new Vector3(-593.78, Y, 31.55),
  new Vector3(-517.47, Y, -58.54),
  new Vector3(-514.56, Y, -105.55),
  new Vector3(-504.58, Y, -129.46),
  new Vector3(-412.77, Y, -212.27),
  new Vector3(-382.99, Y, -225.46),
  new Vector3(-361.41, Y, -221.97),
  new Vector3(-339.90, Y, -209.07),
  new Vector3(-174.46, Y, -80.82),
  new Vector3(-156.75, Y, -57.31),
  new Vector3(-145.90, Y, -17.14),
  new Vector3(-128.56, Y, -3.63),
  new Vector3(-104.70, Y, 4.40),
  // Chicane zigzag points removed — Catmull-Rom self-intersected here and
  // boxed the spawn in with overlapping guardrails. Smooth straight instead.
  new Vector3(75.20, Y, 55.76),
  new Vector3(182.62, Y, 114.96),
  new Vector3(263.54, Y, 146.61),
  new Vector3(358.37, Y, 169.26),
  new Vector3(455.38, Y, 164.13),
  new Vector3(535.38, Y, 138.24),
  new Vector3(775.09, Y, -11.06),
  new Vector3(800.00, Y, -36.05),
  new Vector3(798.78, Y, -52.05),
  new Vector3(787.55, Y, -68.90),
  // Mirabeau / Loews / Mirabeau Bas complex — heavily simplified. The raw
  // SVG had ~10 close-spaced vertices through this hairpin which caused
  // Catmull-Rom to overshoot and loop. Three strategic apexes let the
  // spline draw a smooth wide hairpin without doubling back on itself.
  new Vector3(739.98, Y, -93.12),
  new Vector3(670.18, Y, -32.66),
  new Vector3(622.75, Y, -76.51),
  new Vector3(662.61, Y, -230.10),
  new Vector3(428.59, Y, -185.98),
  new Vector3(366.90, Y, -165.50),
  new Vector3(345.71, Y, -134.14),
  new Vector3(331.10, Y, -34.75),
  new Vector3(313.49, Y, 2.32),
  new Vector3(292.58, Y, 25.23),
  new Vector3(271.62, Y, 36.96),
  new Vector3(217.28, Y, 37.46),
  new Vector3(152.91, Y, 7.23),
  new Vector3(72.37, Y, -56.13),
  new Vector3(-47.79, Y, -112.35),
  new Vector3(-333.17, Y, -293.87),
  new Vector3(-368.13, Y, -325.50),
  new Vector3(-381.68, Y, -328.40),
  new Vector3(-415.23, Y, -309.42),
  new Vector3(-588.30, Y, -150.34),
  new Vector3(-674.67, Y, -52.56),
  new Vector3(-723.68, Y, 33.60),
  new Vector3(-749.68, Y, 109.76),
  new Vector3(-760.34, Y, 165.78),
  new Vector3(-800.00, Y, 222.40),
];

// Wider road to match the much larger track scale.
export const TRACK_WIDTH = 18;
export const GUARDRAIL_HEIGHT = 0.75;
