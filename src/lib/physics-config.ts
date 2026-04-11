// Vehicle physics tuning constants — tweak these to change driving feel

export const VEHICLE = {
  // Chassis dimensions
  width: 1.8,
  height: 0.6,
  length: 4.2,
  mass: 20,

  // Speed (units per second)
  maxForwardSpeed: 90,           // very fast — must manage throttle
  maxReverseSpeed: 12,
  accelerationRate: 22,          // powerful — causes wheelspin if not careful
  brakeRate: 25,                 // progressive — must hold brake longer
  coastDecel: 6,                  // noticeable engine brake when off throttle

  // Steering (radians per second)
  maxSteerSpeed: 1.8,            // less twitchy
  minSteerFactor: 0.08,          // almost no steering at top speed — MUST slow down

  // Drift / handbrake
  driftLateralGrip: 0.12,        // slidier drift
  normalLateralGrip: 0.82,       // slides on fast corners — must brake before turn
  handbrakeDecel: 8,             // stronger handbrake slowdown
  driftSteerBoost: 1.3,          // extra steering while drifting

  // Restitution (bounciness off walls)
  restitution: 0.4,              // bouncier off walls

  // Damping
  angularDamping: 8.0,           // less damping = car feels lighter

  // Spawn
  spawnHeight: 1,
} as const;
