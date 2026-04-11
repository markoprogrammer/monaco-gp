// Vehicle physics tuning constants — tweak these to change driving feel

export const VEHICLE = {
  // Chassis dimensions
  width: 1.8,
  height: 0.6,
  length: 4.2,
  mass: 20,

  // Speed (units per second)
  maxForwardSpeed: 65,
  maxReverseSpeed: 10,
  accelerationRate: 12,
  brakeRate: 40,
  coastDecel: 2,           // very slow natural decel — must brake!

  // Steering (radians per second)
  maxSteerSpeed: 2.0,
  minSteerFactor: 0.1,     // almost no steering at top speed

  // Drift / handbrake
  driftLateralGrip: 0.15,
  normalLateralGrip: 0.95,
  handbrakeDecel: 5,

  // Restitution (bounciness off walls)
  restitution: 0.3,

  // Damping
  angularDamping: 10.0,

  // Spawn
  spawnHeight: 1,
} as const;
