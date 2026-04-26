// Shared AudioContext for bot engine sounds — single context, multiple panners.
// Created lazily on first user gesture (browser autoplay policy).

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let listenerInitialized = false;

const readyCallbacks: ((ctx: AudioContext, master: GainNode) => void)[] = [];

function ensureStarted() {
  if (ctx) return;
  ctx = new AudioContext();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.55;
  masterGain.connect(ctx.destination);

  for (const cb of readyCallbacks) cb(ctx, masterGain);
  readyCallbacks.length = 0;
}

if (typeof window !== "undefined") {
  const handler = () => {
    ensureStarted();
    window.removeEventListener("keydown", handler);
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("touchstart", handler);
  };
  window.addEventListener("keydown", handler);
  window.addEventListener("pointerdown", handler);
  window.addEventListener("touchstart", handler);
}

export function onAudioReady(cb: (ctx: AudioContext, master: GainNode) => void) {
  if (ctx && masterGain) cb(ctx, masterGain);
  else readyCallbacks.push(cb);
}

export function getAudioCtx(): AudioContext | null {
  return ctx;
}

export function setListenerPose(
  px: number, py: number, pz: number,
  fx: number, fy: number, fz: number,
) {
  if (!ctx) return;
  const l = ctx.listener;
  const t = ctx.currentTime;
  if (l.positionX) {
    l.positionX.setValueAtTime(px, t);
    l.positionY.setValueAtTime(py, t);
    l.positionZ.setValueAtTime(pz, t);
    l.forwardX.setValueAtTime(fx, t);
    l.forwardY.setValueAtTime(fy, t);
    l.forwardZ.setValueAtTime(fz, t);
    if (!listenerInitialized) {
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
      listenerInitialized = true;
    }
  } else {
    // Older Safari fallback
    (l as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition?.(px, py, pz);
    (l as unknown as { setOrientation: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void }).setOrientation?.(fx, fy, fz, 0, 1, 0);
  }
}
