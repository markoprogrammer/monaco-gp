import { useState, type FormEvent } from "react";
import { useUserStore, sanitizeUsername, isValidUsername } from "../lib/user-store";
import { readIncomingPortalParams } from "../lib/portal-params";

// Each page load (refresh) shows the start screen again, even if a username is
// remembered. Portal entries (?portal=true) bypass instantly per Vibe Jam spec.
const portalBypass = readIncomingPortalParams().isFromPortal;

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
  const [entered, setEntered] = useState(portalBypass);
  const [draft, setDraft] = useState(username ?? "");
  const [touched, setTouched] = useState(false);

  if (entered && username) return <>{children}</>;

  const valid = isValidUsername(draft);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setUsername(sanitizeUsername(draft));
    setEntered(true);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "url(/images/monaco-skyline.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#050810",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(5,8,16,0.55) 0%, rgba(5,8,16,0.25) 40%, rgba(5,8,16,0.85) 100%)",
        }}
      />
      <form
        onSubmit={onSubmit}
        style={{
          position: "relative",
          width: "min(420px, 90vw)",
          padding: "32px 28px",
          background: "rgba(10, 14, 28, 0.78)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,236,0,0.06) inset",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
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
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          Enter your name
        </h1>
        <p style={{ fontSize: 14, color: "#9aa4b8", margin: 0, marginBottom: 16 }}>
          Type a name, drive Monaco, race the live leaderboard.
        </p>

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

        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={24}
          placeholder="e.g. LEC16"
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: 18,
            fontWeight: 600,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${touched && !valid ? "#dc0000" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 10,
            color: "#fff",
            outline: "none",
            boxSizing: "border-box",
            letterSpacing: "0.05em",
          }}
        />

        {touched && !valid && (
          <div style={{ fontSize: 12, color: "#ff6b6b", marginTop: 8 }}>
            2–24 characters
          </div>
        )}

        <button
          type="submit"
          disabled={!valid}
          style={{
            width: "100%",
            marginTop: 18,
            padding: "14px 16px",
            fontSize: 16,
            fontWeight: 700,
            color: valid ? "#0a0a0a" : "#7a7a7a",
            background: valid ? "#FFEC00" : "rgba(255,255,255,0.06)",
            border: "none",
            borderRadius: 10,
            cursor: valid ? "pointer" : "not-allowed",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            transition: "transform 80ms ease",
          }}
          onMouseDown={(e) => valid && (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Drive
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
