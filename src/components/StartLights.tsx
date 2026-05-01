import { useEffect, useState } from "react";
import { useIntroStore } from "../lib/intro-store";

const RED_INTERVAL_MS = 700;
const GO_HOLD_MS = 900;

function beep(freq: number, durationMs: number, volume = 0.18) {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, durationMs);
  } catch {
    /* audio blocked — silently skip */
  }
}

export default function StartLights() {
  const phase = useIntroStore((s) => s.phase);
  const setPhase = useIntroStore((s) => s.setPhase);
  const [reds, setReds] = useState(0);
  const [showGo, setShowGo] = useState(false);

  useEffect(() => {
    if (phase !== "lights") return;
    setReds(0);
    setShowGo(false);

    const timers: number[] = [];
    // Three red lights, one per RED_INTERVAL_MS, with a beep on each.
    for (let i = 1; i <= 3; i++) {
      timers.push(
        window.setTimeout(() => {
          setReds(i);
          beep(640, 130, 0.2);
        }, i * RED_INTERVAL_MS),
      );
    }
    // After the third red, after a short pause, all greens + GO sound.
    timers.push(
      window.setTimeout(() => {
        setShowGo(true);
        beep(900, 220, 0.25);
        setTimeout(() => beep(1200, 280, 0.22), 70);
      }, 3 * RED_INTERVAL_MS + 600),
    );
    // Release controls a frame later so the GO! flash is what the player sees.
    timers.push(
      window.setTimeout(() => {
        setPhase("racing");
        // Linger the GO badge for a moment so it doesn't disappear instantly.
        setTimeout(() => setShowGo(false), GO_HOLD_MS);
      }, 3 * RED_INTERVAL_MS + 700),
    );

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [phase, setPhase]);

  if (phase !== "lights" && !showGo) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "22%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 21000,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        userSelect: "none",
      }}
      aria-hidden="true"
    >
      {!showGo ? (
        <div
          style={{
            display: "flex",
            gap: 14,
            padding: "16px 22px",
            background: "rgba(8,10,18,0.85)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
          }}
        >
          {[0, 1, 2].map((i) => {
            const lit = i < reds;
            return (
              <div
                key={i}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: lit ? "#ff1a1a" : "rgba(50,30,30,0.6)",
                  boxShadow: lit
                    ? "0 0 28px rgba(255,40,40,0.85), inset 0 0 14px rgba(255,180,180,0.6)"
                    : "inset 0 0 8px rgba(0,0,0,0.6)",
                  border: "2px solid rgba(255,255,255,0.06)",
                  transition: "background 80ms linear, box-shadow 80ms linear",
                }}
              />
            );
          })}
        </div>
      ) : (
        <div
          style={{
            padding: "18px 38px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: "0.12em",
            color: "#0a0a0a",
            background: "linear-gradient(180deg, #34ff7a, #11d957)",
            border: "3px solid rgba(0,0,0,0.5)",
            borderRadius: 18,
            boxShadow: "0 0 40px rgba(52,255,122,0.85), 0 12px 36px rgba(0,0,0,0.5)",
            textShadow: "0 2px 0 rgba(255,255,255,0.45)",
            animation: "go-pop 360ms ease-out",
          }}
        >
          GO!
        </div>
      )}
      <style>{`
        @keyframes go-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
