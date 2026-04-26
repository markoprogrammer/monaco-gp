// Vehicle physics tuning constants — tweak these to change driving feel

export const VEHICLE = {
  // Chassis dimensions
  width: 1.8,
  height: 0.6,
  length: 4.2,
  mass: 20,

  // Speed (units per second)
  maxForwardSpeed: 105,          // ~378 km/h, full F1 pace
  maxReverseSpeed: 14,
  accelerationRate: 32,          // explosive launch, F1-like power-to-weight
  brakeRate: 38,                 // strong braking — Space is the main pedal
  coastDecel: 7,                 // engine brake when off throttle

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

  // Collider Y offset — shifts the collider up within the rigid body so the
  // visual car settles closer to the ground (wheels on the road instead of floating).
  // Half-height 0.3 + wheel-bottom local -0.277 → 0.023 puts wheels exactly on road.
  // A bit more lets the tires "bite" into the surface for a planted look.
  colliderYOffset: 0.05,

  // Wall hit — instant speed drop on impact, gentle decel while scraping
  wallImpactSpeedFactor: 0.7,    // currentSpeed *= this on collision enter
  wallScrapeDecel: 6,            // gentle additional decel while still in contact
} as const;
