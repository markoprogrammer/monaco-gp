import { useCallback, useRef } from "react";
import { onAudioReady } from "../lib/audio";

// Procedural metal-impact crash sound. White-noise burst through a low-pass
// filter that sweeps from bright to dull, plus a sub-bass thump from a quick
// sine drop, gives a "metallic clang + body thud" feel without samples.
export function useCrashSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const lastPlayedAt = useRef(0);

  if (ctxRef.current === null) {
    onAudioReady((ctx, master) => {
      ctxRef.current = ctx;
      masterRef.current = master;

      // Cache a short white-noise buffer for reuse.
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.floor(sr * 0.5), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noiseBufferRef.current = buf;
    });
  }

  // intensity ∈ [0, 1] — scales loudness and brightness
  const play = useCallback((intensity: number = 1) => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    const buf = noiseBufferRef.current;
    if (!ctx || !master || !buf) return;

    // Avoid retriggering too frequently (prevents continuous-scrape clutter)
    const now = ctx.currentTime;
    if (now - lastPlayedAt.current < 0.08) return;
    lastPlayedAt.current = now;

    const amp = Math.max(0.3, Math.min(1, intensity));

    // ---- Noise burst (metallic crunch) ----
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.Q.value = 1.2;
    noiseFilter.frequency.setValueAtTime(2400 * amp + 600, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 0.32);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0, now);
    noiseGain.gain.linearRampToValueAtTime(0.45 * amp, now + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);

    noise.start(now);
    noise.stop(now + 0.42);

    // ---- Sub thump (chassis impact) ----
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(40, now + 0.18);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0, now);
    subGain.gain.linearRampToValueAtTime(0.55 * amp, now + 0.01);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    sub.connect(subGain);
    subGain.connect(master);
    sub.start(now);
    sub.stop(now + 0.3);
  }, []);

  return play;
}
