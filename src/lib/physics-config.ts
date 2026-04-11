// Vehicle physics tuning constants — tweak these to change driving feel

export const VEHICLE = {
  // Chassis dimensions
  width: 1.8,
  height: 0.6,
  length: 4.2,
  mass: 20,

  // Speed (units per second)
  maxForwardSpeed: 25,
  maxReverseSpeed: 8,
  accelerationRate: 15, // how fast we reach max speed
  brakeRate: 25,        // how fast we stop
  coastDecel: 8,        // natural slowdown when no input

  // Steering (radians per second)
  maxSteerSpeed: 2.5,
  // Steering reduces at high speed
  minSteerFactor: 0.3,

  // Drift / handbrake
  driftLateralGrip: 0.3,   // 0 = ice, 1 = full grip
  normalLateralGrip: 0.95,
  handbrakeDecel: 12,       // speed reduction while handbrake held

  // Damping
  angularDamping: 10.0,

  // Spawn
  spawnHeight: 2,
} as const;
