# Monaco GP — Game Spec

> Source of truth for game design. Updated from wiki session.
> Last sync: 2026-04-10

---

## One-liner

Open a webpage, instantly drive a car around Monaco, qualify, then race up to 10 players.

---

## Core Loop

```
QUALIFY (solo laps) → LOBBY (wait for players) → RACE (3 laps, multiplayer) → RESULTS → REPEAT
```

No menus. No login. No loading. URL → driving in < 3 seconds.

---

## Driving Feel

| Attribute | Target |
|-----------|--------|
| Style | Arcade — NOT simulation |
| Reference | GTA V driving feel |
| Acceleration | Snappy, instant response |
| Steering | Tight, slightly oversteery |
| Drifting | Easy to initiate with handbrake, satisfying |
| Collisions | Bouncy, forgiving — no damage model |
| Speed feel | Camera FOV widens, motion blur optional |

**The #1 priority is that driving feels fun.** If it doesn't feel good on a flat plane, nothing else matters.

---

## Camera

GTA-style 3rd person chase cam:
- Position: behind + above car (~5m back, ~3m up)
- Follow: smooth lerp (0.05–0.1 factor), slight delay in turns
- Look-at: slightly ahead of car, not directly at it
- Speed effect: pull camera back slightly at high speed
- Tunnel: camera should not clip through tunnel ceiling

---

## Track — Circuit de Monaco (simplified)

Total length: ~3.3 km (real is 3.337 km)

### Key Sections

| # | Section | Character |
|---|---------|-----------|
| 1 | Start/Finish | Flat straight |
| 2 | Sainte Devote | Medium right, entry corner |
| 3 | Beau Rivage | Uphill straight, buildings both sides |
| 4 | Casino Square | Hairpin + open area |
| 5 | Mirabeau | Downhill right into tight left |
| 6 | Tunnel | ~300m, dark→light transition |
| 7 | Chicane | Tight left-right by harbor |
| 8 | Swimming Pool | Fast left-right esses |
| 9 | Rascasse | Slow hairpin, tight |
| 10 | Anthony Noghes | Last corner back to straight |

### Track Construction

- Define center line as CatmullRom spline (30-50 control points)
- Generate road mesh: 10m wide, curbs on edges
- Guardrails/barriers: both sides, collision-enabled
- Elevation changes: Beau Rivage uphill, Mirabeau downhill

---

## Monaco Environment

Priority order (do what you can):

| Priority | Element | Notes |
|----------|---------|-------|
| P0 | Road + guardrails | Must have |
| P0 | Tunnel | Iconic, lighting change |
| P1 | Harbor water | Blue plane with slight animation |
| P1 | Building silhouettes | Simple boxes with textures |
| P2 | Yachts in harbor | Low-poly boat models |
| P2 | Palm trees | Billboard or simple geometry |
| P3 | Casino building | Recognizable landmark |
| P3 | Grandstands | Near start/finish |

Style: **Low-poly geometry + good materials + good lighting = sim look without sim poly count.**

---

## Multiplayer

### Room System
- Max 10 players per room
- Auto-create new room when current fills
- Players can race with < 10 (start after 60s timeout OR when full)
- Server manages room lifecycle

### Sync
- Client sends own position/rotation at 20Hz (every 50ms)
- Server relays to all other players in room
- Client interpolates other player positions (lerp between updates)
- No server-side physics — trust client positions (acceptable for game jam)

### Flow
```
Player connects → assigned to room →
  qualifying phase (60s or until all have a time) →
  countdown (3, 2, 1, GO) →
  race (3 laps) →
  results screen (10s) →
  back to qualifying for next race
```

---

## UI / HUD

### In-Game HUD (minimal, non-intrusive)
- Speed (km/h) — bottom center
- Lap counter (1/3) — top right
- Current lap time — top center
- Best lap time — below current
- Position in race (1st, 2nd...) — top left

### Lobby Screen (overlay)
- "Waiting for players... 3/10"
- Player list with quali times
- Countdown when starting

### Results Screen (overlay)
- Final positions with times
- "Race again" button (auto-proceeds after 10s)

---

## Audio (P2 — nice to have)

| Sound | Trigger |
|-------|---------|
| Engine | Pitch increases with speed |
| Tire screech | During drift / high steering + speed |
| Collision | Hitting guardrail |
| Countdown | 3, 2, 1, GO beeps |

---

## Mobile Support (P2)

- Virtual joystick (left thumb) — steering
- Gas/brake buttons (right thumb)
- Responsive canvas — fill viewport
- Touch events, not mouse events

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First paint | < 2 seconds |
| Playable | < 3 seconds (no loading screen!) |
| FPS desktop | 60 fps on mid-range GPU |
| FPS mobile | 30 fps on iPhone 13+ |
| Bundle size | < 5 MB initial |

---

## Out of Scope (for this jam)

- Car customization / skins
- Multiple tracks
- AI opponents (bots)
- Damage model
- Weather effects
- Replay system
- Account system / persistent stats
