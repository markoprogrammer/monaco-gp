import { useEffect, useState, type FormEvent } from "react";
import { useUserStore, sanitizeUsername, isValidUsername } from "../lib/user-store";
import { readIncomingPortalParams } from "../lib/portal-params";
import { subscribePresenceCount } from "../lib/multiplayer";
import { supabase } from "../lib/supabase";
import { fetchAllTimeUserCount } from "../lib/all-time-stats";

// Each page load (refresh) shows the start screen — even portal entries must
// confirm the username (prefilled from URL or remembered store).
const incomingPortalUsername = (() => {
  const raw = (readIncomingPortalParams().username ?? "").trim().slice(0, 24);
  return raw.length >= 2 ? raw : "";
})();

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 5,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        fontWeight: 600,
        color: "#fff",
        whiteSpace: "nowrap",
        textAlign: "center",
        minWidth: 28,
      }}
    >
      {children}
    </span>
  );
}

export default function UsernameGate({ children }: { children: React.ReactNode }) {
  const username = useUserStore((s) => s.username);
  const setUsername = useUserStore((s) => s.setUsername);
  const [entered, setEntered] = useState(false);
  const [draft, setDraft] = useState(username ?? incomingPortalUsername);
  const [touched, setTouched] = useState(false);
  const [checking, setChecking] = useState(false);
  const [takenError, setTakenError] = useState(false);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [allTimeUsers, setAllTimeUsers] = useState<number | null>(null);
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

  // Show a live driver counter while the gate is on screen.
  useEffect(() => {
    if (entered) return;
    return subscribePresenceCount(setLiveCount);
  }, [entered]);

  // All-time unique drivers — single fetch when the gate mounts.
  useEffect(() => {
    if (entered) return;
    let cancelled = false;
    void fetchAllTimeUserCount().then((n) => {
      if (!cancelled) setAllTimeUsers(n);
    });
    return () => {
      cancelled = true;
    };
  }, [entered]);

  if (entered && username) return <>{children}</>;

  const valid = isValidUsername(draft);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || checking) return;
    const candidate = sanitizeUsername(draft);

    // Returning user re-entering their own stored handle (case-insensitive): skip check.
    const storedLower = (username ?? "").toLowerCase();
    if (candidate.toLowerCase() !== storedLower) {
      setChecking(true);
      try {
        // ilike with escaped wildcards = exact case-insensitive match.
        const escaped = candidate.replace(/[\\%_]/g, (c) => `\\${c}`);
        const { data, error } = await supabase
          .from("lap_times")
          .select("username")
          .ilike("username", escaped)
          .limit(1);
        if (error) {
          // Fail-open on transient errors — better to let the player race than block.
          console.warn("[username uniqueness check]", error.message);
        } else if ((data ?? []).length > 0) {
          setTakenError(true);
          return;
        }
      } finally {
        setChecking(false);
      }
    }

    setUsername(candidate);
    setEntered(true);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "max(env(safe-area-inset-top), 12px) 12px max(env(safe-area-inset-bottom), 12px)",
        backgroundImage: "url(/images/monaco-overview.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#050810",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(5,8,16,0.55) 0%, rgba(5,8,16,0.25) 40%, rgba(5,8,16,0.85) 100%)",
        }}
      />
      <form
        onSubmit={onSubmit}
        style={{
          position: "relative",
          width: "min(420px, 100%)",
          padding: "24px 22px",
          margin: "auto 0",
          background: "rgba(10, 14, 28, 0.55)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,236,0,0.06) inset",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.3em",
            color: "#FFEC00",
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          Monaco GP
        </div>
        <h1 style={{ fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 700, margin: 0, marginBottom: 6 }}>
          Enter your name
        </h1>
        <p style={{ fontSize: 14, color: "#9aa4b8", margin: 0, marginBottom: 10, lineHeight: 1.45 }}>
          <strong style={{ color: "#FFEC00" }}>Time trial</strong> — chase the fastest lap and climb the global leaderboard.
        </p>
        <p style={{ fontSize: 13, color: "#7b8499", margin: 0, marginBottom: 12, lineHeight: 1.45 }}>
          <strong style={{ color: "#cbd3e1" }}>Live multiplayer:</strong> every other driver online is on the same track with you, in real time.
        </p>

        {/* Live driver counter — pulsing badge to make it obvious people are racing right now */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            marginBottom: 16,
            background: liveCount && liveCount > 0 ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${liveCount && liveCount > 0 ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: liveCount && liveCount > 0 ? "#22c55e" : "#6b7589",
              boxShadow: liveCount && liveCount > 0 ? "0 0 8px #22c55e" : "none",
              animation: liveCount && liveCount > 0 ? "mgpPulse 1.4s ease-in-out infinite" : "none",
            }}
          />
          <span style={{ color: liveCount && liveCount > 0 ? "#86efac" : "#9aa4b8" }}>
            {liveCount == null
              ? "Connecting…"
              : liveCount === 0
                ? "Be the first one on track"
                : liveCount === 1
                  ? "1 driver on track right now — go race them"
                  : `${liveCount} drivers on track right now — go race them`}
          </span>
        </div>

        {allTimeUsers != null && (
          <div
            style={{
              fontSize: 11,
              color: "#7b8499",
              marginBottom: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <strong style={{ color: "#cbd3e1" }}>{allTimeUsers}</strong>{" "}
            {allTimeUsers === 1 ? "driver has" : "drivers have"} ever raced here
          </div>
        )}

        {!isTouch && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "6px 12px",
              padding: "12px 14px",
              marginBottom: 18,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              fontSize: 12,
              color: "#cbd3e1",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Kbd>WASD</Kbd> <span>Drive · steer</span>
            <Kbd>Space</Kbd> <span>Handbrake / drift</span>
            <Kbd>R</Kbd> <span>Respawn on track</span>
            <Kbd>Shift + D</Kbd> <span>Customize car</span>
            <Kbd>⌘ + D</Kbd> <span>Orbit camera</span>
          </div>
        )}

        <input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (takenError) setTakenError(false);
          }}
          onBlur={() => setTouched(true)}
          maxLength={20}
          placeholder="e.g. LEC16"
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: 18,
            fontWeight: 600,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${
              takenError ? "#dc0000" : touched && !valid ? "#dc0000" : "rgba(255,255,255,0.12)"
            }`,
            borderRadius: 10,
            color: "#fff",
            outline: "none",
            boxSizing: "border-box",
            letterSpacing: "0.05em",
          }}
        />

        {touched && !valid && (
          <div style={{ fontSize: 12, color: "#ff6b6b", marginTop: 8 }}>
            2–20 characters
          </div>
        )}
        {takenError && (
          <div style={{ fontSize: 12, color: "#ff6b6b", marginTop: 8 }}>
            That name is already racing. Pick another.
          </div>
        )}

        <button
          type="submit"
          disabled={!valid || checking}
          style={{
            width: "100%",
            marginTop: 18,
            padding: "14px 16px",
            fontSize: 16,
            fontWeight: 700,
            color: valid && !checking ? "#0a0a0a" : "#7a7a7a",
            background: valid && !checking ? "#FFEC00" : "rgba(255,255,255,0.06)",
            border: "none",
            borderRadius: 10,
            cursor: valid && !checking ? "pointer" : "not-allowed",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            transition: "transform 80ms ease",
          }}
          onMouseDown={(e) => valid && !checking && (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {checking ? "Checking…" : "Drive"}
        </button>

        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: 11,
            color: "#7a8497",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Car model: <strong style={{ color: "#cbd3e1" }}>GPT Image 2</strong> ×{" "}
          <a
            href="https://www.tripo3d.ai/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#cbd3e1", textDecoration: "underline" }}
          >
            Tripo3D
          </a>
          <br />
          Music:{" "}
          <a
            href="https://suno.com/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#cbd3e1", textDecoration: "underline" }}
          >
            Suno
          </a>
        </div>
      </form>
    </div>
  );
}
