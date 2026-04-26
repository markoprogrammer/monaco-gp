import { useEffect, useRef } from "react";
import { onAudioReady } from "../lib/audio";

// Procedural tire-screech loop. Continuously running noise source through a
// bandpass filter that whines around 3.5 kHz, with gain modulated by drift
// intensity so it fades in/out smoothly while sliding.
export function useDriftSound() {
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    onAudioReady((ctx, master) => {
      const sr = ctx.sampleRate;
      // ~2-second pink-ish noise loop (white noise low-passed for energy distribution)
      const buf = ctx.createBuffer(1, Math.floor(sr * 2), sr);
      const data = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        lp = lp * 0.96 + w * 0.04;
        data[i] = lp * 6;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 3400;
      filter.Q.value = 4.5;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      // LFO modulating filter freq for "warbling" tire whine
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      src.start();
      lfo.start();

      sourceRef.current = src;
      filterRef.current = filter;
      gainRef.current = gain;
      lfoRef.current = lfo;
      lfoGainRef.current = lfoGain;

      cleanup = () => {
        try { src.stop(); src.disconnect(); } catch { /* ignore */ }
        try { lfo.stop(); lfo.disconnect(); } catch { /* ignore */ }
        try { filter.disconnect(); } catch { /* ignore */ }
        try { gain.disconnect(); } catch { /* ignore */ }
        try { lfoGain.disconnect(); } catch { /* ignore */ }
      };
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // intensity ∈ [0, 1] — drift severity (handbrake or slip ratio).
  // speedRatio modulates pitch slightly so faster slides sound higher.
  const update = (intensity: number, speedRatio: number = 0.5) => {
    const gain = gainRef.current;
    const filter = filterRef.current;
    if (!gain || !filter) return;

    const target = Math.max(0, Math.min(0.22, intensity * 0.22));
    // Smoothly approach target gain to avoid clicks
    gain.gain.setTargetAtTime(target, gain.context.currentTime, 0.06);

    const baseFreq = 2200 + speedRatio * 1800;
    filter.frequency.setTargetAtTime(baseFreq, filter.context.currentTime, 0.05);
  };

  return update;
}
