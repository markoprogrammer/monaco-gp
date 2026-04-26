import { useEffect, useRef, useState } from "react";
import { setVehicleInput } from "../hooks/useVehicleControls";

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches || "ontouchstart" in window);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isTouch;
}

const PAD = 90; // joystick radius (px)
const KNOB = 56;

function Joystick() {
  const padRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const active = pointerId.current !== null;

  const apply = (clientX: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const v = Math.max(-1, Math.min(1, (clientX - cx) / (rect.width / 2)));
    setDx(v);
    setVehicleInput("left", v < -0.15);
    setVehicleInput("right", v > 0.15);
  };

  const release = () => {
    pointerId.current = null;
    setDx(0);
    setVehicleInput("left", false);
    setVehicleInput("right", false);
  };

  return (
    <div
      ref={padRef}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerId.current = e.pointerId;
        apply(e.clientX);
      }}
      onPointerMove={(e) => {
        if (pointerId.current !== e.pointerId) return;
        apply(e.clientX);
      }}
      onPointerUp={(e) => {
        if (pointerId.current !== e.pointerId) return;
        release();
      }}
      onPointerCancel={() => release()}
      style={{
        width: PAD * 2,
        height: PAD * 2,
        borderRadius: "50%",
        background: "rgba(0,0,0,0.35)",
        border: "2px solid rgba(255,255,255,0.25)",
        position: "relative",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <div style={{
        position: "absolute",
        left: PAD - KNOB / 2 + dx * (PAD - KNOB / 2),
        top: PAD - KNOB / 2,
        width: KNOB,
        height: KNOB,
        borderRadius: "50%",
        background: active ? "rgba(34,197,94,0.85)" : "rgba(255,255,255,0.65)",
        boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
        transition: active ? "none" : "left 0.12s ease-out, background 0.12s",
      }} />
    </div>
  );
}

function PedalButton({
  label,
  color,
  onPress,
  onRelease,
  size = 88,
}: {
  label: string;
  color: string;
  onPress: () => void;
  onRelease: () => void;
  size?: number;
}) {
  const pointerId = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerId.current = e.pointerId;
        setPressed(true);
        onPress();
      }}
      onPointerUp={(e) => {
        if (pointerId.current !== e.pointerId) return;
        pointerId.current = null;
        setPressed(false);
        onRelease();
      }}
      onPointerCancel={() => {
        pointerId.current = null;
        setPressed(false);
        onRelease();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: pressed ? color : `${color}cc`,
        border: "2px solid rgba(255,255,255,0.35)",
        color: "#fff",
        fontFamily: "'Courier New', monospace",
        fontWeight: "bold",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        boxShadow: pressed ? "inset 0 4px 10px rgba(0,0,0,0.5)" : "0 4px 10px rgba(0,0,0,0.4)",
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: "transform 0.06s, background 0.06s",
      }}
    >
      {label}
    </div>
  );
}

export default function MobileControls() {
  const isTouch = useIsTouch();
  if (!isTouch) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      pointerEvents: "none",
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Left: steering joystick */}
      <div style={{
        position: "absolute",
        left: 24,
        bottom: 32,
        pointerEvents: "auto",
      }}>
        <Joystick />
      </div>

      {/* Right: GAS top, BRAKE + DRIFT row at bottom (BRAKE left, easier reach) */}
      <div style={{
        position: "absolute",
        right: 24,
        bottom: 32,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 16,
        pointerEvents: "auto",
      }}>
        <PedalButton
          label="GAS"
          color="#22c55e"
          onPress={() => setVehicleInput("forward", true)}
          onRelease={() => setVehicleInput("forward", false)}
        />
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <PedalButton
            label="BRAKE"
            color="#ef4444"
            onPress={() => setVehicleInput("backward", true)}
            onRelease={() => setVehicleInput("backward", false)}
          />
          <PedalButton
            label="DRIFT"
            color="#f59e0b"
            size={70}
            onPress={() => setVehicleInput("handbrake", true)}
            onRelease={() => setVehicleInput("handbrake", false)}
          />
        </div>
      </div>

      {/* Center-bottom: reset only */}
      <div style={{
        position: "absolute",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        pointerEvents: "auto",
      }}>
        <PedalButton
          label="RESET"
          color="#6366f1"
          size={56}
          onPress={() => setVehicleInput("reset", true)}
          onRelease={() => setVehicleInput("reset", false)}
        />
      </div>
    </div>
  );
}
