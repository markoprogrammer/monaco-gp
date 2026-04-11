import { useEffect, useRef } from "react";

// Synthetic V12 engine sound using Web Audio API
// Multiple oscillators at harmonic frequencies create a rich engine tone

export function useEngineSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscillators = useRef<OscillatorNode[]>([]);
  const started = useRef(false);

  useEffect(() => {
    // Start audio on first user interaction (browser policy)
    const start = () => {
      if (started.current) return;
      started.current = true;

      const ctx = new AudioContext();
      ctxRef.current = ctx;

      // Master gain
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.08;
      masterGain.connect(ctx.destination);
      gainRef.current = masterGain;

      // Distortion for grit
      const distortion = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        curve[i] = Math.tanh(x * 3);
      }
      distortion.curve = curve;
      distortion.connect(masterGain);

      // V12 harmonics — 6 oscillators at different harmonic ratios
      const harmonics = [
        { ratio: 1, gain: 0.35, type: "sawtooth" as OscillatorType },
        { ratio: 2, gain: 0.25, type: "sawtooth" as OscillatorType },
        { ratio: 3, gain: 0.12, type: "square" as OscillatorType },
        { ratio: 4, gain: 0.08, type: "sawtooth" as OscillatorType },
        { ratio: 6, gain: 0.05, type: "square" as OscillatorType },
        { ratio: 0.5, gain: 0.15, type: "triangle" as OscillatorType },
      ];

      const oscs: OscillatorNode[] = [];
      for (const h of harmonics) {
        const osc = ctx.createOscillator();
        osc.type = h.type;
        osc.frequency.value = 55 * h.ratio; // idle frequency

        const oscGain = ctx.createGain();
        oscGain.gain.value = h.gain;

        osc.connect(oscGain);
        oscGain.connect(distortion);
        osc.start();
        oscs.push(osc);
      }

      oscillators.current = oscs;

      window.removeEventListener("keydown", start);
      window.removeEventListener("click", start);
    };

    window.addEventListener("keydown", start);
    window.addEventListener("click", start);

    return () => {
      window.removeEventListener("keydown", start);
      window.removeEventListener("click", start);
      oscillators.current.forEach((o) => o.stop());
      ctxRef.current?.close();
    };
  }, []);

  // Call this every frame with current speed ratio (0-1)
  const update = (speedRatio: number) => {
    const oscs = oscillators.current;
    if (oscs.length === 0) return;

    const ratios = [1, 2, 3, 4, 6, 0.5];

    // Base frequency: 55Hz idle → 280Hz at full speed
    const baseFreq = 55 + speedRatio * 225;

    for (let i = 0; i < oscs.length; i++) {
      const osc = oscs[i]!;
      osc.frequency.value = baseFreq * ratios[i]!;
    }

    // Volume increases slightly with speed
    if (gainRef.current) {
      gainRef.current.gain.value = 0.04 + speedRatio * 0.08;
    }
  };

  return update;
}
