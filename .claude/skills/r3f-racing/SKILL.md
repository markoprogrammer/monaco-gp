---
name: r3f-racing
description: React Three Fiber racing game patterns — vehicle physics, chase camera, track generation, multiplayer sync, mobile touch controls, performance optimization
---

# R3F Racing Game Reference

Use this knowledge when building components for the Monaco GP racing game.

## React Three Fiber Setup

- Use `<Canvas>` with `shadows`, `dpr={[1, 2]}` for adaptive resolution
- Wrap physics in `<Physics gravity={[0, -9.81, 0]}>` from @react-three/rapier
- Use `useFrame()` for per-frame updates (camera, HUD)
- Use `useRef<RapierRigidBody>()` for physics body references
- Zustand for all game state — never prop drill in R3F

## Vehicle Physics (Rapier)

Key approach for arcade vehicle:
- `RigidBody` with `CuboidCollider` for chassis
- Apply forces for acceleration: `rigidBody.addForce(forwardVector)`
- Apply torque for steering: `rigidBody.applyTorqueImpulse(steerVector)`
- Handbrake = reduce lateral friction on rear
- Keep all constants in `physics-config.ts`
- Damping: `linearDamping={0.5}` prevents infinite sliding

## Chase Camera (GTA-style)

```
idealOffset = car.position + car.backward * 8 + up * 4
idealLookAt = car.position + car.forward * 3
camera.position.lerp(idealOffset, 0.05)  // smooth follow
camera.lookAt(idealLookAt.lerp(target, 0.1))
```
- Lerp factor 0.03-0.08 for smooth lag
- Pull camera back at high speed for speed feel
- Clamp camera Y to prevent going underground

## Track from Spline

- Define CatmullRom3 curve with control points
- `curve.getPoints(500)` for smooth path
- Generate road mesh: extrude rectangle along curve
- Use `curve.getTangentAt(t)` for road direction
- Guardrails: offset curve left/right by road width/2
- Lap detection: invisible trigger zone at start/finish

## Multiplayer Sync

- Client sends position/rotation at 20Hz via WebSocket
- Other players: interpolate between last 2 received positions
- Buffer 2-3 frames of data for smooth interpolation
- On Bun server: `Bun.serve({ websocket: { message, open, close } })`
- Room management: Map<roomId, Set<playerId>>

## Mobile Touch

- Virtual joystick: track touch position relative to start
- Gas/brake: simple touch zones on right side
- Use `pointer` events (not touch) for cross-platform
- `touch-action: none` on canvas to prevent scroll

## Performance

- Use `<Instances>` for repeated geometry (guardrails, trees)
- LOD: simplify distant objects
- Shadows only on car + track, not environment
- `<AdaptiveDpr>` from drei for auto quality scaling
- Target: 60fps desktop, 30fps mobile, <3s initial load
