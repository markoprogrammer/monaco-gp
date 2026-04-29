import { useCallback, useEffect, useRef, useState } from "react";

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

// Files placed in public/radio/ — served at /radio/<encoded-name>.
const TRACK_FILES = [
  "Pulse at Midnight.mp3",
  "Pulse at Midnight (1).mp3",
  "Monaco GP Rev (2).mp3",
  "Monaco GP Rev (3).mp3",
];

function prettyTitle(file: string): string {
  return file.replace(/\.mp3$/i, "");
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export default function Radio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [order] = useState<string[]>(() => shuffle(TRACK_FILES));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const isTouch = useIsTouch();
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(pointer: coarse)").matches;
  });

  const current = order[idx]!;

  // Create the <audio> element exactly once.
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, []);

  // Auto-advance when a track ends.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnded = () => setIdx((i) => (i + 1) % order.length);
    a.addEventListener("ended", onEnded);
    return () => a.removeEventListener("ended", onEnded);
  }, [order.length]);

  // Whenever the track index changes, swap src and play if allowed.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.src = `/radio/${encodeURIComponent(current)}`;
    if (unlocked && playing) {
      void a.play().catch(() => {});
    }
  }, [current, unlocked, playing]);

  // Volume.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // First user gesture unlocks audio (browser autoplay policy) and kicks off playback.
  useEffect(() => {
    if (unlocked) return;
    const onGesture = () => {
      setUnlocked(true);
      setPlaying(true);
    };
    window.addEventListener("keydown", onGesture, { once: true });
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("touchstart", onGesture, { once: true });
    return () => {
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchstart", onGesture);
    };
  }, [unlocked]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      setUnlocked(true);
      setPlaying(true);
      void a.play().catch(() => {});
    }
  }, [playing]);

  const next = useCallback(() => setIdx((i) => (i + 1) % order.length), [order.length]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + order.length) % order.length), [order.length]);

  // Keyboard shortcuts: M = mute, ] = next, [ = prev
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.code === "KeyM") {
        e.preventDefault();
        toggle();
      } else if (e.code === "BracketRight") {
        e.preventDefault();
        next();
      } else if (e.code === "BracketLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, next, prev]);

  const collapsedPos: React.CSSProperties = isTouch
    ? { top: 16, left: 188 }
    : { bottom: 12, left: 12 };
  // On mobile the open panel drops BELOW the icon row so it doesn't fight
  // with the centred leaderboard button.
  const openPos: React.CSSProperties = isTouch
    ? { top: 56, left: 148 }
    : { bottom: 12, left: 12 };

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        style={{
          position: "fixed",
          ...collapsedPos,
          zIndex: 10000,
          background: "rgba(0,0,0,0.7)",
          border: "none",
          color: "#fff",
          fontFamily: "'Courier New', monospace",
          fontSize: isTouch ? 16 : 11,
          padding: isTouch ? 0 : "6px 10px",
          width: isTouch ? 32 : undefined,
          height: isTouch ? 32 : undefined,
          borderRadius: 6,
          cursor: "pointer",
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Show radio"
      >
        ♪
      </button>
    );
  }

  const btn: React.CSSProperties = {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#fff",
    width: 26,
    height: 26,
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };

  return (
    <div
      style={{
        position: "fixed",
        ...openPos,
        zIndex: 10000,
        background: "rgba(0,0,0,0.7)",
        borderRadius: 6,
        padding: isTouch ? "6px 8px" : "8px 10px",
        fontFamily: "'Courier New', monospace",
        color: "#fff",
        pointerEvents: "auto",
        minWidth: isTouch ? 180 : 230,
        maxWidth: isTouch ? 200 : undefined,
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: 1 }}>RADIO {playing ? "● ON AIR" : "○ PAUSED"}</div>
        <button
          onClick={() => setHidden(true)}
          style={{ ...btn, width: 18, height: 18, fontSize: 11, opacity: 0.6 }}
          aria-label="Hide radio"
          title="Hide"
        >
          ×
        </button>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: "bold",
          marginBottom: 6,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 220,
        }}
        title={prettyTitle(current)}
      >
        {prettyTitle(current)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={prev} style={btn} aria-label="Previous" title="Prev [ [ ]">⏮</button>
        <button onClick={toggle} style={{ ...btn, width: 32 }} aria-label={playing ? "Pause" : "Play"} title="Play/Pause [M]">
          {playing ? "⏸" : "▶"}
        </button>
        <button onClick={next} style={btn} aria-label="Next" title="Next [ ] ]">⏭</button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          style={{ flex: 1, marginLeft: 4, accentColor: "#a855f7" }}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
