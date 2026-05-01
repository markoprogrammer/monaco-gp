// Vehicle physics tuning constants — tweak these to change driving feel

export const VEHICLE = {
  // Chassis dimensions
  width: 1.8,
  height: 0.6,
  length: 4.2,
  mass: 20,

  // Speed (units per second) — punchy F1 pace with snappy launch.
  maxForwardSpeed: 110,
  maxReverseSpeed: 16,
  accelerationRate: 38,         // explosive launch
  brakeRate: 44,                // strong, responsive trail-brake
  coastDecel: 6,

  // Steering (radians per second) — quicker hands, retains grip mid-corner.
  maxSteerSpeed: 2.2,
  minSteerFactor: 0.16,         // still maneuverable at top speed

  // Drift / handbrake — slidy but recoverable; arcade-fun.
  driftLateralGrip: 0.08,       // looser drift
  normalLateralGrip: 0.88,      // grippy on the racing line
  handbrakeDecel: 6,            // softer handbrake slowdown so drifts carry speed
  driftSteerBoost: 1.55,        // extra rotation while sideways

  // Restitution (bounciness off walls)
  restitution: 0.35,

  // Damping
  angularDamping: 7.0,

  // Spawn
  spawnHeight: 1,

  colliderYOffset: 0.05,

  // Wall hit — instant speed drop on impact, gentle decel while scraping
  wallImpactSpeedFactor: 0.78,  // brushes barely cost speed
  wallScrapeDecel: 7,
} as const;
