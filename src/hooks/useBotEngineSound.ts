import { useEffect, useRef } from "react";
import { onAudioReady } from "../lib/audio";

// Per-bot 3D positional engine sound — procedural V12 (3 oscillators).
// Returns an update fn called every frame with speed ratio + bot world position.
//
// `freqOffset` lets each bot have a slightly different idle pitch so the field
// doesn't sound like a single car when bunched together.
export function useBotEngineSound(freqOffset: number = 0) {
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);

  useEffect(() => {
    let cleanupFn: (() => void) | null = null;

    onAudioReady((ctx, master) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;

      const panner = ctx.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 6;
      panner.maxDistance = 90;
      panner.rolloffFactor = 1.4;

      gain.connect(panner);
      panner.connect(master);

      const harmonics = [
        { ratio: 1, gain: 0.42, type: "sawtooth" as OscillatorType },
        { ratio: 2, gain: 0.22, type: "sawtooth" as OscillatorType },
        { ratio: 0.5, gain: 0.20, type: "triangle" as OscillatorType },
      ];

      const oscs: OscillatorNode[] = [];
      for (const h of harmonics) {
        const osc = ctx.createOscillator();
        osc.type = h.type;
        osc.frequency.value = (50 + freqOffset) * h.ratio;
        const og = ctx.createGain();
        og.gain.value = h.gain;
        osc.connect(og);
        og.connect(gain);
        osc.start();
        oscs.push(osc);
      }

      oscillatorsRef.current = oscs;
      gainRef.current = gain;
      pannerRef.current = panner;

      cleanupFn = () => {
        for (const o of oscs) {
          try { o.stop(); } catch { /* may already be stopped */ }
          try { o.disconnect(); } catch { /* ignore */ }
        }
        try { gain.disconnect(); } catch { /* ignore */ }
        try { panner.disconnect(); } catch { /* ignore */ }
      };
    });

    return () => {
      cleanupFn?.();
    };
  }, [freqOffset]);

  // Called per frame: speedRatio ∈ [0, 1], bot world position (x, y, z).
  const update = (
    speedRatio: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const oscs = oscillatorsRef.current;
    const panner = pannerRef.current;
    const gain = gainRef.current;
    if (oscs.length === 0 || !panner || !gain) return;

    const ratios = [1, 2, 0.5];
    const baseFreq = 50 + freqOffset + speedRatio * 220;
    for (let i = 0; i < oscs.length; i++) {
      oscs[i]!.frequency.value = baseFreq * ratios[i]!;
    }

    if (panner.positionX) {
      const t = panner.context.currentTime;
      panner.positionX.setValueAtTime(x, t);
      panner.positionY.setValueAtTime(y, t);
      panner.positionZ.setValueAtTime(z, t);
    } else {
      (panner as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition?.(x, y, z);
    }

    gain.gain.value = 0.10 + speedRatio * 0.18;
  };

  return update;
}
