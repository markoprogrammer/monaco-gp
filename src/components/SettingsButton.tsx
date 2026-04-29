import { useTuningStore } from "../lib/tuning-store";

export default function SettingsButton() {
  const open = useTuningStore((s) => s.open);
  const toggle = useTuningStore((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={toggle}
      className="desktop-only"
      aria-label={open ? "Close customization" : "Open customization"}
      title="Customize car  (Shift + D)"
      style={{
        position: "fixed",
        bottom: 12,
        left: 280,
        zIndex: 10000,
        background: open ? "rgba(255,236,0,0.9)" : "rgba(0,0,0,0.7)",
        color: open ? "#0a0a0a" : "#fff",
        border: "none",
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        padding: "6px 12px",
        borderRadius: 6,
        cursor: "pointer",
        pointerEvents: "auto",
        letterSpacing: "0.1em",
        fontWeight: 700,
        textTransform: "uppercase",
        userSelect: "none",
      }}
    >
      ⚙ Tune
    </button>
  );
}
