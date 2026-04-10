---
name: milestone
description: Check project progress against the 3-week development plan
disable-model-invocation: true
---

# Milestone Check

When invoked:

1. Read `CLAUDE.md` milestones section
2. Check which files exist and what's implemented
3. Report current status:

## S1: Foundation (10-16 April)
Check for:
- `package.json` with R3F dependencies → scaffold done?
- `src/components/Car.tsx` → car exists?
- `src/hooks/useVehicleControls.ts` → controls work?
- `src/components/Camera.tsx` → chase cam?
- `src/components/Track.tsx` + `src/lib/track-data.ts` → track exists?
- Lap detection logic → timer works?

## S2: Multiplayer (17-23 April)
Check for:
- `src/server/index.ts` → server exists?
- `src/server/room.ts` → room system?
- `src/hooks/useMultiplayer.ts` → client sync?
- Multiple car rendering → ghost cars?

## S3: Polish (24-30 April)
Check for:
- `.glb` files in `public/models/` → 3D models?
- Environment components → Monaco scenery?
- `src/components/HUD.tsx` → speed/lap display?
- `src/components/Leaderboard.tsx` → results?
- Sound files → audio?

Report as:
```
## Progress: S[X] - [milestone name]
✅ Done: [list]
🔧 In Progress: [list]
⬜ Not Started: [list]
📅 Days remaining: [N]
```
