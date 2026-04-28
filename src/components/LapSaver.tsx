import { useEffect, useRef } from "react";
import { useGameState } from "../hooks/useGameState";
import { useUserStore } from "../lib/user-store";
import { supabase } from "../lib/supabase";

export default function LapSaver() {
  const lastLapTime = useGameState((s) => s.lastLapTime);
  const username = useUserStore((s) => s.username);
  const seenSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!username || lastLapTime == null) return;
    // De-dupe: same lap value can fire effect twice in StrictMode dev.
    const sig = `${username}|${lastLapTime}|${useGameState.getState().lapTimes.length}`;
    if (seenSignature.current === sig) return;
    seenSignature.current = sig;

    const lapMs = Math.round(lastLapTime * 1000);
    if (lapMs <= 0 || lapMs >= 600_000) return;

    void supabase
      .from("lap_times")
      .insert({ username, lap_time_ms: lapMs })
      .then(({ error }) => {
        if (error) console.warn("[lap_times insert]", error.message);
      });
  }, [lastLapTime, username]);

  return null;
}
