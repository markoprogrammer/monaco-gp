import { useEffect, useState } from "react";
import { useAudioStore } from "../lib/audio-store";

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  });
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches || "ontouchstart" in window);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isTouch;
}

export default function SoundButton() {
  const muted = useAudioStore((s) => s.gameMuted);
  const toggle = useAudioStore((s) => s.toggleGameMuted);
  const isTouch = useIsTouch();

  const baseStyle: React.CSSProperties = {
    zIndex: 10000,
    background: "rgba(0,0,0,0.7)",
    color: "#fff",
    border: "none",
    fontFamily: "'Courier New', monospace",
    fontSize: 14,
    padding: 0,
    width: 32,
    height: 32,
    borderRadius: 6,
    cursor: "pointer",
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
  };

  const positionStyle: React.CSSProperties = isTouch
    ? { position: "fixed", top: 16, left: 140 }
    : { position: "fixed", bottom: 12, left: 360 };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Unmute game audio" : "Mute game audio"}
      title={muted ? "Unmute game" : "Mute game"}
      style={{ ...baseStyle, ...positionStyle, opacity: muted ? 0.6 : 1 }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
