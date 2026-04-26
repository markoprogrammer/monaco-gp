import Bot from "./Bot";

// Field of bots — distributed around the track at varying skill levels.
// Player spawns at SPAWN_T = 0.28; bots are seeded ahead/behind on the spline.
// `skill` ∈ [0,1] scales top speed and corner commitment, so the field finishes
// in different places lap after lap.
const BOT_CONFIG = [
  { startT: 0.36, lateralOffset: -1.6, bodyColor: "#1a4fff", accentColor: "#0a0a0a", freqOffset: -3, skill: 1.05 }, // blue, fastest
  { startT: 0.42, lateralOffset:  1.4, bodyColor: "#f5e63b", accentColor: "#1a1a1a", freqOffset:  2, skill: 1.02 }, // yellow
  { startT: 0.55, lateralOffset: -1.5, bodyColor: "#ff6b1a", accentColor: "#1a1a1a", freqOffset:  4, skill: 1.00 }, // orange
  { startT: 0.18, lateralOffset:  1.6, bodyColor: "#ffffff", accentColor: "#1a1a1a", freqOffset:  5, skill: 0.97 }, // white
  { startT: 0.10, lateralOffset: -1.3, bodyColor: "#2bc06b", accentColor: "#0a0a0a", freqOffset: -1, skill: 0.99 }, // green
];

export default function Bots() {
  return (
    <>
      {BOT_CONFIG.map((b, i) => (
        <Bot
          key={i}
          startT={b.startT}
          lateralOffset={b.lateralOffset}
          bodyColor={b.bodyColor}
          accentColor={b.accentColor}
          freqOffset={b.freqOffset}
          skill={b.skill}
        />
      ))}
    </>
  );
}
