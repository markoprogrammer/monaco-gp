import { useState, type FormEvent } from "react";
import { useUserStore, sanitizeUsername, isValidUsername } from "../lib/user-store";

export default function UsernameGate({ children }: { children: React.ReactNode }) {
  const username = useUserStore((s) => s.username);
  const setUsername = useUserStore((s) => s.setUsername);
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);

  if (username) return <>{children}</>;

  const valid = isValidUsername(draft);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setUsername(sanitizeUsername(draft));
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
        backgroundImage: "url(/images/start-grid.png)",
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
        <p style={{ fontSize: 14, color: "#9aa4b8", margin: 0, marginBottom: 22 }}>
          Your lap times will appear on the leaderboard.
        </p>

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
      </form>
    </div>
  );
}
