---
name: playtest
description: Run a driving feel checklist — camera, physics, performance, track
disable-model-invocation: true
---

# Playtest Check

When invoked:

1. Run `bun run dev` if not already running
2. Check these criteria and report:

## Driving Feel
- [ ] Car responds to WASD immediately (no input lag)
- [ ] Acceleration feels snappy
- [ ] Steering is tight but not twitchy
- [ ] Drifting with spacebar feels satisfying
- [ ] Car doesn't flip over or behave erratically
- [ ] Speed feels fast (camera effects help)

## Camera
- [ ] Follows car smoothly (no jitter)
- [ ] Slight lag in turns (GTA feel)
- [ ] Doesn't clip through geometry
- [ ] Tunnel transition works (no camera stuck)

## Performance
- [ ] 60fps on desktop (check with Stats.js)
- [ ] No visible jank or stutter
- [ ] Initial load < 3 seconds

## Track
- [ ] Can complete a full lap
- [ ] Lap detection works
- [ ] Timer is accurate
- [ ] Guardrails prevent going off-track

Report findings as a checklist with pass/fail for each item.
