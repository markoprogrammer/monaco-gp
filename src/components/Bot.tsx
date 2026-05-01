import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { CatmullRomCurve3, Vector3 } from "three";
import { TRACK_POINTS } from "../lib/track-data";
import { VEHICLE } from "../lib/physics-config";
import CarModel from "./CarModel";
import { registerEntry, unregisterEntry, raceRegistry } from "../lib/race-progress";
import { useBotEngineSound } from "../hooks/useBotEngineSound";
import { getCornerSpeed, TRACK_LAP_LENGTH } from "../lib/bot-ai";

interface BotProps {
  startT: number;          // initial spline parameter [0, 1)
  lateralOffset: number;   // metres left/right of centerline
  bodyColor: string;
  accentColor?: string;
  freqOffset?: number;     // engine pitch offset Hz (per-bot variation)
  skill?: number;          // 0..1 — scales top speed and corner commitment
}

const _v = new Vector3();
const _tan = new Vector3();
const _right = new Vector3();

// Lookahead distance into the corner (metres). Bots target the speed they need
// to be at by the time they reach this point ahead of them.
const LOOKAHEAD_M = 22;

// How aggressively bots can change speed (m/s²).
const BOT_ACCEL = 34;
const BOT_BRAKE = 48;

// Bump reaction — when the player rams a bot, perturb its yaw + lateral line
// so it visibly gets knocked off-rhythm, then decays back to the racing line.
const YAW_KICK = 0.55;        // base yaw kick magnitude (radians)
const LATERAL_KICK = 1.8;     // base lateral push magnitude (metres)
const PERT_DECAY_PER_S = 1.6; // exponential decay rate (1/s)

// Spacing — when within this many metres behind another car, throttle off.
const FOLLOW_GAP_M = 9;
// Below this gap, hard cap to the leader's speed.
const HARD_GAP_M = 5;

export default function Bot({
  startT,
  lateralOffset,
  bodyColor,
  accentColor,
  freqOffset = 0,
  skill = 0.95,
}: BotProps) {
  const rb = useRef<RapierRigidBody>(null);
  const t = useRef(startT);
  const lap = useRef(0);
  const lastT = useRef(startT);
  const speed = useRef(getCornerSpeed(startT) * skill);
  const lateral = useRef(lateralOffset);
  // Bump perturbations — added to spline-derived angle/lateral, decay over time.
  const yawPert = useRef(0);
  const lateralPert = useRef(0);
  const speedPert = useRef(0); // negative = slowed by hit
  const prevAngle = useRef(0);
  const prevAngleInit = useRef(false);
  const speedRef = useRef(0);
  const steerSignalRef = useRef(0);

  const progressEntry = useMemo(() => registerEntry(false), []);
  useEffect(() => () => unregisterEntry(progressEntry), [progressEntry]);

  const updateEngine = useBotEngineSound(freqOffset);

  const { curve, initialPos, initialAngle } = useMemo(() => {
    const c = new CatmullRomCurve3(TRACK_POINTS, true, "centripetal", 0.5);
    const p = c.getPointAt(startT);
    const tn = c.getTangentAt(startT);
    const angle = Math.atan2(tn.x, tn.z);
    const right = new Vector3(-tn.z, 0, tn.x).normalize().multiplyScalar(lateralOffset);
    return {
      curve: c,
      initialPos: [p.x + right.x, p.y + 0.6, p.z + right.z] as [number, number, number],
      initialAngle: angle,
    };
  }, [startT, lateralOffset]);

  const maxSpeed = VEHICLE.maxForwardSpeed * skill;

  useFrame((_, delta) => {
    const body = rb.current;
    if (!body) return;
    const dt = Math.min(delta, 0.05);

    // --- Determine target speed: corner-limited at the lookahead point ---
    const lookaheadT = (t.current + LOOKAHEAD_M / TRACK_LAP_LENGTH) % 1;
    const cornerLimit = getCornerSpeed(lookaheadT);
    let target = Math.min(maxSpeed, cornerLimit * skill);

    // --- Inter-car spacing: don't crash into the back of another runner ---
    const myProg = progressEntry.progress;
    let nearestAheadM = Infinity;
    let nearestAheadSpeed = 0;
    for (const e of raceRegistry) {
      if (e === progressEntry) continue;
      // distance ahead, accounting for lap wrap on a per-lap basis
      let dProg = e.progress - myProg;
      // Same lap or one lap ahead — only the near-side matters
      const dM = dProg * TRACK_LAP_LENGTH;
      if (dM > 0 && dM < nearestAheadM && dM < 60) {
        nearestAheadM = dM;
        nearestAheadSpeed = e.speed;
      }
    }
    if (nearestAheadM < HARD_GAP_M) {
      target = Math.min(target, nearestAheadSpeed * 0.85);
    } else if (nearestAheadM < FOLLOW_GAP_M) {
      // Smooth taper between FOLLOW and HARD
      const k = (nearestAheadM - HARD_GAP_M) / (FOLLOW_GAP_M - HARD_GAP_M);
      const cap = nearestAheadSpeed * (0.85 + 0.15 * k);
      target = Math.min(target, cap);
    }

    // --- Ramp current speed toward target with accel/brake limits ---
    const cur = speed.current;
    if (cur < target) speed.current = Math.min(target, cur + BOT_ACCEL * dt);
    else speed.current = Math.max(Math.max(target, 4), cur - BOT_BRAKE * dt);

    // --- Decay bump perturbations toward zero ---
    const decay = Math.exp(-PERT_DECAY_PER_S * dt);
    yawPert.current *= decay;
    lateralPert.current *= decay;
    speedPert.current *= decay;

    // --- Slight lateral wobble: shift line a touch when overtaking close cars ---
    // If a bot is right ahead, drift outward to set up an overtake.
    let lateralTarget = lateralOffset;
    if (nearestAheadM < 12) lateralTarget = lateralOffset + Math.sign(lateralOffset || 1) * 1.4;
    lateral.current += (lateralTarget - lateral.current) * Math.min(1, dt * 2.5);

    // --- Advance along spline by current speed (slowed if just bumped) ---
    const effectiveSpeed = Math.max(0, speed.current + speedPert.current);
    const dtT = (effectiveSpeed / TRACK_LAP_LENGTH) * dt;
    const newT = (t.current + dtT) % 1;
    if (lastT.current > 0.85 && newT < 0.15) lap.current += 1;
    lastT.current = newT;
    t.current = newT;
    progressEntry.progress = lap.current + newT;
    progressEntry.speed = effectiveSpeed;

    curve.getPointAt(newT, _v);
    curve.getTangentAt(newT, _tan);
    const lateralWithPert = lateral.current + lateralPert.current;
    _right.set(-_tan.z, 0, _tan.x).normalize().multiplyScalar(lateralWithPert);

    const angle = Math.atan2(_tan.x, _tan.z) + yawPert.current;
    const ha = angle / 2;

    // Derive a steering signal (-1..+1) from yaw rate, for visual front-wheel turning.
    if (!prevAngleInit.current) {
      prevAngle.current = angle;
      prevAngleInit.current = true;
    }
    let dAngle = angle - prevAngle.current;
    if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
    else if (dAngle < -Math.PI) dAngle += 2 * Math.PI;
    prevAngle.current = angle;
    const yawRate = dt > 0 ? dAngle / dt : 0;
    // Cars going around tight Monaco corners hit ~1.2 rad/s yaw. Map to [-1,1].
    // Negate so steering wheel direction matches turn direction (left turn = wheels turn left).
    steerSignalRef.current = Math.max(-1, Math.min(1, -yawRate / 1.2));
    speedRef.current = effectiveSpeed;

    const px = _v.x + _right.x;
    const py = _v.y + 0.6;
    const pz = _v.z + _right.z;

    body.setNextKinematicTranslation({ x: px, y: py, z: pz });
    body.setNextKinematicRotation({
      x: 0,
      y: Math.sin(ha),
      z: 0,
      w: Math.cos(ha),
    });

    updateEngine(speed.current / VEHICLE.maxForwardSpeed, px, py, pz);
  });

  const onCollisionEnter = useCallback(
    (e: { other: { rigidBody?: { userData?: unknown } } }) => {
      const tag = (e.other.rigidBody?.userData as { tag?: string } | undefined)?.tag;
      // Untagged collider = the player car. Walls are "wall", other bots are "bot".
      if (tag) return;
      // Random-but-meaningful kick. Sign random so left/right hits feel natural.
      const dir = Math.random() < 0.5 ? -1 : 1;
      yawPert.current += dir * (YAW_KICK + Math.random() * 0.4);
      lateralPert.current += dir * (LATERAL_KICK + Math.random() * 1.0);
      // Knock the rhythm — bot loses up to ~25% of current speed for a moment.
      speedPert.current -= speed.current * 0.25;
      // Cap so contact doesn't compound into absurd spins.
      const yawCap = 1.5;
      yawPert.current = Math.max(-yawCap, Math.min(yawCap, yawPert.current));
      const latCap = 4.0;
      lateralPert.current = Math.max(-latCap, Math.min(latCap, lateralPert.current));
    },
    [],
  );

  return (
    <RigidBody
      ref={rb}
      type="kinematicPosition"
      colliders={false}
      position={initialPos}
      rotation={[0, initialAngle, 0]}
      userData={{ tag: "bot" }}
      onCollisionEnter={onCollisionEnter}
    >
      <CuboidCollider
        args={[VEHICLE.width / 2, VEHICLE.height / 2, VEHICLE.length / 2]}
        friction={0.4}
        restitution={0.2}
      />
      <CarModel
        bodyColor={bodyColor}
        accentColor={accentColor ?? "#0a0a0a"}
        speedRef={speedRef}
        steerSignalRef={steerSignalRef}
      />
    </RigidBody>
  );
}
