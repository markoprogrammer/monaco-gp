---
name: tune
description: Adjust vehicle physics constants based on driving feel complaints
disable-model-invocation: true
---

# Tune Vehicle Physics

When invoked with a complaint (e.g. "/tune too floaty"):

1. Read `src/lib/physics-config.ts`
2. Based on the complaint, adjust constants:

## Common Issues → Fixes

| Complaint | Adjust |
|-----------|--------|
| "Too slow" | Increase `MAX_FORCE`, increase `MAX_SPEED` |
| "Too floaty" | Increase `GRAVITY`, increase `GROUND_FRICTION` |
| "Can't turn" | Increase `STEER_ANGLE`, reduce `STEER_SPEED` dampening |
| "Spins out" | Reduce `STEER_ANGLE`, increase rear `SIDE_FRICTION` |
| "Can't drift" | Reduce `SIDE_FRICTION` on rear wheels when handbrake active |
| "Too heavy" | Reduce `CHASSIS_MASS`, increase `MAX_FORCE` |
| "Too twitchy" | Add steering interpolation (lerp), reduce `STEER_SPEED` |
| "No speed feel" | Increase camera FOV at speed, add motion lines |

## Rules
- Change ONE constant at a time
- Keep previous value as comment: `// was: 500`
- Test after each change
- All constants must stay in physics-config.ts — never hardcode in components
