import { useEffect, useState } from "react";

export default function OrientationGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      const isTouch =
        window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShow(isTouch && isPortrait);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        color: "#fff",
        fontFamily: "'Courier New', monospace",
        padding: 32,
        textAlign: "center",
        touchAction: "none",
      }}
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        style={{
          animation: "rotateHint 2s ease-in-out infinite",
        }}
      >
        <rect
          x="22"
          y="14"
          width="52"
          height="68"
          rx="8"
          ry="8"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
        />
        <circle cx="48" cy="74" r="2.5" fill="#fff" />
        <path
          d="M 84 48 A 36 36 0 0 0 12 48"
          fill="none"
          stroke="#22c55e"
          strokeWidth="2.5"
          strokeDasharray="3 3"
        />
        <polygon points="12,48 8,42 16,42" fill="#22c55e" />
      </svg>

      <div style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 1 }}>
        ROTATE YOUR PHONE
      </div>
      <div style={{ fontSize: 14, opacity: 0.7, maxWidth: 280, lineHeight: 1.5 }}>
        Monaco GP requires landscape orientation for full controls.
      </div>

      <style>
        {`@keyframes rotateHint {
          0%, 30% { transform: rotate(0deg); }
          60%, 100% { transform: rotate(-90deg); }
        }`}
      </style>
    </div>
  );
}
