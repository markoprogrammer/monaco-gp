import { useState } from "react";
import {
  useTuningStore,
  PART_KEYS,
  type PartKey,
  type NumericKey,
  type TextKey,
  type PartParams,
} from "../lib/tuning-store";

const NUMERIC_GROUPS: { title: string; keys: { k: NumericKey; min: number; max: number; step: number }[] }[] = [
  {
    title: "Geometry",
    keys: [
      { k: "carScale", min: 1, max: 8, step: 0.05 },
      { k: "bodyYOffset", min: -1, max: 1, step: 0.005 },
      { k: "tireRadius", min: 0.05, max: 1, step: 0.005 },
      { k: "maxSteer", min: 0, max: 1, step: 0.01 },
      { k: "rakeRad", min: -0.3, max: 0.3, step: 0.005 },
      { k: "rimThreshold", min: 0.01, max: 0.08, step: 0.001 },
      { k: "tireWrapOuter", min: 0.04, max: 0.12, step: 0.001 },
      { k: "tireWrapInner", min: 0.02, max: 0.10, step: 0.001 },
      { k: "tireWrapWidth", min: 0.005, max: 0.08, step: 0.001 },
    ],
  },
  {
    title: "MGP shield (side)",
    keys: [
      { k: "shieldX", min: -0.5, max: 0.5, step: 0.005 },
      { k: "shieldY", min: -0.2, max: 0.4, step: 0.005 },
      { k: "shieldZ", min: 0, max: 0.4, step: 0.005 },
      { k: "shieldScale", min: 0.02, max: 0.4, step: 0.005 },
    ],
  },
  {
    title: "Race number (hood)",
    keys: [
      { k: "numberX", min: -0.5, max: 0.5, step: 0.005 },
      { k: "numberY", min: -0.2, max: 0.4, step: 0.005 },
      { k: "numberZ", min: -0.3, max: 0.3, step: 0.005 },
      { k: "numberScale", min: 0.02, max: 0.4, step: 0.005 },
    ],
  },
  {
    title: "License plate (rear)",
    keys: [
      { k: "plateX", min: -0.6, max: 0, step: 0.005 },
      { k: "plateY", min: 0, max: 0.3, step: 0.005 },
      { k: "plateZ", min: -0.2, max: 0.2, step: 0.005 },
      { k: "plateW", min: 0.02, max: 0.3, step: 0.005 },
      { k: "plateH", min: 0.01, max: 0.15, step: 0.005 },
    ],
  },
];

const TEXT_INPUTS: { k: TextKey; label: string; max: number }[] = [
  { k: "shieldText", label: "Shield text", max: 6 },
  { k: "raceNumber", label: "Race number", max: 4 },
  { k: "plateText", label: "License plate", max: 10 },
];

const SLIDER_STYLE: React.CSSProperties = { width: "100%" };
const ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "92px 1fr 56px",
  alignItems: "center",
  gap: "6px",
  marginBottom: "4px",
  fontSize: "11px",
};

function NumberRow({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div style={ROW_STYLE}>
      <span style={{ opacity: 0.85 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={SLIDER_STYLE} />
      <input type="number" value={value} step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "56px", fontSize: "10px", padding: "2px 4px", background: "#222", color: "#fff", border: "1px solid #444" }} />
    </div>
  );
}

function PartEditor({ k }: { k: PartKey }) {
  const part = useTuningStore((s) => s.parts[k]);
  const setPart = useTuningStore((s) => s.setPart);
  const [open, setOpen] = useState(false);

  const update = (patch: Partial<PartParams>) => setPart(k, patch);

  return (
    <div style={{ borderBottom: "1px solid #333", paddingBottom: "6px", marginBottom: "6px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent", border: "none", color: "#fff", width: "100%", textAlign: "left",
          padding: "4px 0", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
          fontSize: "12px", fontWeight: 600,
        }}
      >
        <span style={{ width: "12px", height: "12px", background: part.color, border: "1px solid #555", borderRadius: "2px" }} />
        <span>{open ? "▾" : "▸"} {k}</span>
      </button>
      {open && (
        <div style={{ paddingLeft: "8px" }}>
          <div style={ROW_STYLE}>
            <span>color</span>
            <input type="color" value={part.color} onChange={(e) => update({ color: e.target.value })} style={{ width: "100%", height: "20px", padding: 0, border: "1px solid #444", background: "#222" }} />
            <span style={{ fontSize: "10px", opacity: 0.6 }}>{part.color}</span>
          </div>
          <NumberRow label="metalness" value={part.metalness} min={0} max={1} step={0.01} onChange={(v) => update({ metalness: v })} />
          <NumberRow label="roughness" value={part.roughness} min={0} max={1} step={0.01} onChange={(v) => update({ roughness: v })} />
          <div style={ROW_STYLE}>
            <span>emissive</span>
            <input type="color" value={part.emissive} onChange={(e) => update({ emissive: e.target.value })} style={{ width: "100%", height: "20px", padding: 0, border: "1px solid #444", background: "#222" }} />
            <span style={{ fontSize: "10px", opacity: 0.6 }}>{part.emissive}</span>
          </div>
          <NumberRow label="emissive ×" value={part.emissiveIntensity} min={0} max={3} step={0.05} onChange={(v) => update({ emissiveIntensity: v })} />
          <NumberRow label="clearcoat" value={part.clearcoat} min={0} max={1} step={0.01} onChange={(v) => update({ clearcoat: v })} />
          <NumberRow label="cc rough" value={part.clearcoatRoughness} min={0} max={1} step={0.01} onChange={(v) => update({ clearcoatRoughness: v })} />
        </div>
      )}
    </div>
  );
}

function NumericRow({ k, min, max, step }: { k: NumericKey; min: number; max: number; step: number }) {
  const value = useTuningStore((s) => s[k]);
  const setNumeric = useTuningStore((s) => s.setNumeric);
  return <NumberRow label={k} value={value} min={min} max={max} step={step} onChange={(v) => setNumeric(k, v)} />;
}

function NumericGroup({ title, keys }: { title: string; keys: { k: NumericKey; min: number; max: number; step: number }[] }) {
  return (
    <div style={{ borderBottom: "1px solid #333", paddingBottom: "6px", marginBottom: "6px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, padding: "4px 0" }}>{title}</div>
      {keys.map(({ k, min, max, step }) => (
        <NumericRow key={k} k={k} min={min} max={max} step={step} />
      ))}
    </div>
  );
}

function TextRow({ k, label, max }: { k: TextKey; label: string; max: number }) {
  const value = useTuningStore((s) => s[k]);
  const setText = useTuningStore((s) => s.setText);
  return (
    <div style={ROW_STYLE}>
      <span>{label}</span>
      <input
        type="text"
        value={value}
        maxLength={max}
        onChange={(e) => setText(k, e.target.value)}
        style={{ gridColumn: "2 / span 2", fontSize: "11px", padding: "3px 6px", background: "#222", color: "#fff", border: "1px solid #444" }}
      />
    </div>
  );
}

function TextGroup() {
  return (
    <div style={{ borderBottom: "1px solid #333", paddingBottom: "6px", marginBottom: "6px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, padding: "4px 0" }}>Decal text</div>
      {TEXT_INPUTS.map(({ k, label, max }) => (
        <TextRow key={k} k={k} label={label} max={max} />
      ))}
    </div>
  );
}

export default function CarTuningPanel() {
  const open = useTuningStore((s) => s.open);
  const setOpen = useTuningStore((s) => s.setOpen);
  const reset = useTuningStore((s) => s.reset);
  const exportJson = useTuningStore((s) => s.exportJson);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: open prompt for manual copy
      window.prompt("Copy params:", exportJson());
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "8px",
        right: "8px",
        bottom: "8px",
        width: "320px",
        background: "rgba(15,15,18,0.92)",
        backdropFilter: "blur(6px)",
        color: "#fff",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "11px",
        border: "1px solid #333",
        borderRadius: "8px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        zIndex: 9999,
        pointerEvents: "auto",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid #333" }}>
        <span style={{ fontWeight: 700, fontSize: "12px" }}>Car Tuning · Shift+D</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button onClick={handleCopy} style={btnStyle()}>{copied ? "✓ copied" : "Copy JSON"}</button>
          <button onClick={() => reset()} style={btnStyle()}>Reset</button>
          <button onClick={() => setOpen(false)} style={btnStyle()}>×</button>
        </div>
      </div>
      <div style={{ overflowY: "auto", padding: "8px 10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, padding: "4px 0", opacity: 0.85 }}>Parts</div>
        {PART_KEYS.map((k) => <PartEditor key={k} k={k} />)}
        {NUMERIC_GROUPS.map((g) => <NumericGroup key={g.title} title={g.title} keys={g.keys} />)}
        <TextGroup />
      </div>
    </div>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: "10px",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
