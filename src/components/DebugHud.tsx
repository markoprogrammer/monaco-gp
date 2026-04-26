import { useDebugStore } from "../lib/debug-store";

export default function DebugHud() {
  const debug = useDebugStore((s) => s.debug);
  if (!debug) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        padding: "6px 10px",
        background: "rgba(0,180,80,0.85)",
        color: "#fff",
        font: "600 12px/1 system-ui, sans-serif",
        borderRadius: 4,
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      DEBUG · drag to orbit · wheel to zoom · Shift+D to exit
    </div>
  );
}
