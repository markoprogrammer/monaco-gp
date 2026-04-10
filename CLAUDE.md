# Monaco GP — Project Instructions

## Overview
Monaco GP is a web-based 3D racing game for Vibe Jam 2026.
Player opens the page → instantly drives around Monaco → qualifies → races multiplayer.

**Deadline: 1 May 2026, 13:37 UTC**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript (strict) + Vite |
| 3D Engine | React Three Fiber (@react-three/fiber) |
| 3D Helpers | @react-three/drei |
| Physics | @react-three/rapier |
| State | Zustand |
| Backend | Bun + native WebSocket |
| Package Manager | Bun |

---

## Project Structure

```
monaco-gp/
  src/
    main.tsx                ← entry point
    App.tsx                 ← R3F Canvas + scene setup
    components/
      Car.tsx               ← player vehicle (model + physics)
      Track.tsx             ← Monaco circuit geometry
      Camera.tsx            ← GTA-style chase cam
      Environment.tsx       ← sky, lighting, Monaco scenery
      HUD.tsx               ← speed, lap time, position
      Leaderboard.tsx       ← quali/race results
      Lobby.tsx             ← waiting room UI
    hooks/
      useVehicleControls.ts ← WASD/arrow input → vehicle forces
      useGameState.ts       ← zustand store (phase, lap, time)
      useMultiplayer.ts     ← WebSocket connection + sync
    lib/
      track-data.ts         ← Monaco circuit spline points
      physics-config.ts     ← vehicle tuning constants
    server/
      index.ts              ← Bun WebSocket server
      room.ts               ← room management (create, join, fill)
      types.ts              ← shared message types
  public/
    models/                 ← .glb 3D models (car, environment)
  docs/
    spec.md                 ← game spec (source of truth for design)
```

---

## Design Principles

1. **Fun first** — driving must feel good before anything else matters
2. **Instant play** — no login, no signup, no loading screens. Open URL → drive
3. **Arcade physics** — responsive, drifty, forgiving. NOT a simulation
4. **Scope discipline** — MVP is: 1 track, 1 car model, working multiplayer. Everything else is bonus
5. **Web performance** — low-poly with good materials and lighting. Target 60fps on mid-range hardware

---

## Game Flow

```
[OPEN PAGE] → [FREE DRIVE / QUALI] → [LOBBY - wait for players] → [RACE] → [RESULTS] → [LOOP]
```

### Phases
1. **Qualifying** — player drives solo laps, best lap time = grid position
2. **Lobby** — wait for room to fill (max 10 players), show countdown
3. **Race** — 3 laps, multiplayer, grid start based on quali times
4. **Results** — leaderboard, option to race again

---

## Camera

GTA-style chase cam:
- 3rd person, behind and above the car
- Smooth follow with slight lag (lerp)
- Rotates with car direction, not instantly
- Slight zoom-out at high speed (optional)

---

## Controls

| Input | Action |
|-------|--------|
| W / ↑ | Accelerate |
| S / ↓ | Brake / Reverse |
| A / ← | Steer left |
| D / → | Steer right |
| Space | Handbrake / Drift |

Touch controls for mobile: virtual joystick (left) + pedals (right). Implement AFTER desktop works.

---

## Monaco Track

Simplified Circuit de Monaco. Key sections (in order):
1. **Start/Finish straight**
2. **Sainte Devote** — first right turn
3. **Beau Rivage** — uphill straight
4. **Casino Square** — hairpin area
5. **Tunnel** — iconic tunnel with lighting change
6. **Chicane** — tight left-right after tunnel
7. **Swimming Pool** — fast section by the harbor
8. **Rascasse** — slow hairpin
9. **Back to Start/Finish**

Track is defined as a spline/curve in `track-data.ts`. Road mesh is generated from the spline. Guardrails on both sides.

---

## Multiplayer Protocol

WebSocket messages (JSON):

```typescript
// Client → Server
{ type: "join" }
{ type: "qualify", lapTime: number }
{ type: "update", position: [x,y,z], rotation: [x,y,z,w], speed: number }

// Server → Client
{ type: "room", roomId: string, players: Player[] }
{ type: "countdown", seconds: number }
{ type: "race_start" }
{ type: "player_update", playerId: string, position: [x,y,z], rotation: [x,y,z,w] }
{ type: "race_end", results: Result[] }
```

Server is authoritative for: room state, race start/end, results.
Client is authoritative for: own position (server relays to others).

---

## Milestones

### S1: Foundation (10–16 April)
- [ ] Vite + R3F + Rapier scaffold
- [ ] Flat plane with car that drives (WASD)
- [ ] Vehicle physics tuned to feel fun
- [ ] GTA chase camera
- [ ] Basic track shape from spline
- [ ] Lap detection + timer

**Gate: driving feels fun on the track**

### S2: Multiplayer (17–23 April)
- [ ] Bun WebSocket server
- [ ] Room system (create, join, fill, rotate)
- [ ] Player sync (positions relayed)
- [ ] Qualifying → Lobby → Race flow
- [ ] Ghost cars (other players rendered)
- [ ] Grid start

**Gate: 2+ players can race together**

### S3: Polish (24–30 April)
- [ ] Monaco environment (buildings, harbor, tunnel, palms)
- [ ] Car model (.glb)
- [ ] Lighting + shadows
- [ ] HUD (speed, lap, position)
- [ ] Leaderboard
- [ ] Sound effects (engine, drift)
- [ ] Mobile touch controls
- [ ] Deploy to domain

**Gate: looks good, plays good, deployed**

---

## Coding Conventions

- TypeScript strict mode, no `any`
- Functional components only
- One component per file
- Zustand for all game state — no prop drilling
- Physics constants in `physics-config.ts` — easy to tweak
- No premature optimization — profile first
- Commit often with descriptive messages

---

## AI Coding Rules (Vibe Jam)

- 90% of code must be AI-generated
- Use Claude Code as primary coding tool
- Describe what you want, iterate on result
- Keep human edits to tuning constants and creative decisions
