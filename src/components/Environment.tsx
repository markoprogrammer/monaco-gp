import { useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, CanvasTexture, NearestFilter, RepeatWrapping, BackSide, DoubleSide, SphereGeometry, Color } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { vertexColor } from "three/tsl";
import { TRACK_POINTS, TRACK_WIDTH } from "../lib/track-data";
import envZones from "../lib/env-zones.json";
import CarModel from "./CarModel";

interface XZ { x: number; z: number }
const SEA_POLYLINE: XZ[] = envZones.seaSegments[0] as XZ[];
const BUILDING_POLYLINES: XZ[][] = envZones.buildingSegments as XZ[][];

/** Standard ray-cast point-in-polygon test for an XZ polygon. */
function pointInPolyXZ(px: number, pz: number, poly: { x: number; z: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x, zi = poly[i]!.z;
    const xj = poly[j]!.x, zj = poly[j]!.z;
    const intersect =
      ((zi > pz) !== (zj > pz)) &&
      px < ((xj - xi) * (pz - zi)) / ((zj - zi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Compute the outward unit normal at index `i` of a polyline, sign-flipped
 *  to point AWAY from the given centroid. Tangent is taken over a window of
 *  ±2 neighbours so it stays smooth when the recorded polyline wiggles.
 */
function polyOutward(points: XZ[], i: number, cx: number, cz: number) {
  const span = 2;
  const a = points[Math.max(0, i - span)]!;
  const b = points[Math.min(points.length - 1, i + span)]!;
  const tx = b.x - a.x;
  const tz = b.z - a.z;
  let nx = -tz;
  let nz = tx;
  const p = points[i]!;
  if (nx * (p.x - cx) + nz * (p.z - cz) < 0) { nx = -nx; nz = -nz; }
  const len = Math.hypot(nx, nz) || 1;
  return { ox: nx / len, oz: nz / len, tx, tz };
}

const SUN_POS: [number, number, number] = [-300, 130, -50];

// Monaco palette — vibrant Mediterranean
const BLDG_COLORS = [
  "#f2d9c0", "#e6a88a", "#d4765e", "#f0c87a", "#f5e08a",
  "#e8d5b0", "#c9886e", "#f0ece4", "#d4a06a", "#e0b898",
  "#c4785a", "#f5d5a8", "#deb887", "#e8b89a", "#f0dcc8",
];

// Shutter colors — Monaco green/brown/dark blue tones
const SHUTTER_COLORS = ["#3a5a3a", "#4a6a4a", "#2e4e3e", "#3a4a5a", "#4a3a2e"];

/** Monaco facade texture — tall green-shuttered windows, iron balconies, stone bands */
function createFacadeTexture(wallColor: string, floors: number, shutterColor: string): CanvasTexture {
  const w = 256, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Wall base
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, w, h);

  // Subtle wall texture — slight noise
  ctx.fillStyle = "rgba(0,0,0,0.02)";
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }

  const floorH = Math.floor(h / Math.max(floors, 3));
  const winCols = 5;
  const winW = 14;
  const winH = Math.floor(floorH * 0.6);
  const winGap = Math.floor(w / (winCols + 1));

  for (let f = 0; f < Math.min(floors, 8); f++) {
    const fy = h - (f + 1) * floorH + Math.floor(floorH * 0.15);

    // Stone band / cornice between floors
    ctx.fillStyle = "rgba(180,170,150,0.5)";
    ctx.fillRect(0, fy + winH + 4, w, 3);
    ctx.fillStyle = "rgba(160,150,130,0.3)";
    ctx.fillRect(0, fy - 3, w, 2);

    for (let c = 0; c < winCols; c++) {
      const wx = winGap * (c + 1) - winW / 2;

      // Window recess shadow
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(wx - 2, fy - 2, winW + 4, winH + 4);

      // Stone window surround
      ctx.fillStyle = "rgba(200,190,170,0.7)";
      ctx.fillRect(wx - 3, fy - 3, winW + 6, 3); // lintel
      ctx.fillRect(wx - 3, fy, 3, winH); // left jamb
      ctx.fillRect(wx + winW, fy, 3, winH); // right jamb

      // Shutters (left and right)
      ctx.fillStyle = shutterColor;
      ctx.fillRect(wx, fy, Math.floor(winW / 2) - 1, winH);
      ctx.fillRect(wx + Math.floor(winW / 2) + 1, fy, Math.floor(winW / 2) - 1, winH);

      // Shutter line detail
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(wx + Math.floor(winW / 2) - 1, fy, 2, winH);

      // Glass peek between shutters
      ctx.fillStyle = "#1a2535";
      ctx.fillRect(wx + Math.floor(winW / 2) - 1, fy, 2, winH);

      // Balcony railing — dark iron line below window
      if (f > 0) {
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(wx - 4, fy + winH + 1, winW + 8, 2);
        // Railing verticals
        for (let r = 0; r < 5; r++) {
          ctx.fillRect(wx - 3 + r * Math.floor((winW + 6) / 4), fy + winH + 1, 1, 3);
        }
      }
    }
  }

  // Ground floor — taller, darker, shop fronts
  const gfH = floorH + 4;
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, h - gfH, w, gfH);

  // Ground floor arched entries
  for (let c = 0; c < 3; c++) {
    const gx = Math.floor(w / 4) * (c + 1) - 12;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(gx, h - gfH + 5, 24, gfH - 8);
    ctx.fillStyle = "rgba(60,50,40,0.5)";
    ctx.fillRect(gx + 2, h - gfH + 7, 20, gfH - 12);
  }

  // Roof cornice — thick ornamental band
  ctx.fillStyle = "rgba(190,180,160,0.8)";
  ctx.fillRect(0, 0, w, 6);
  ctx.fillStyle = "rgba(170,160,140,0.6)";
  ctx.fillRect(0, 6, w, 2);

  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

/** Grand white Monaco facade — elegant classical style */
function createGrandTexture(floors: number): CanvasTexture {
  const w = 256, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Warm white wall
  ctx.fillStyle = "#f5f0e8";
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal stone lines
  ctx.fillStyle = "rgba(0,0,0,0.03)";
  for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);

  const floorH = Math.floor(h / Math.max(floors, 3));
  const winCols = 5;
  const winW = 16;
  const winH = Math.floor(floorH * 0.55);
  const winGap = Math.floor(w / (winCols + 1));

  for (let f = 0; f < Math.min(floors, 7); f++) {
    const fy = h - (f + 1) * floorH + Math.floor(floorH * 0.18);

    // Heavy stone cornice between floors
    ctx.fillStyle = "rgba(210,205,195,0.6)";
    ctx.fillRect(0, fy + winH + 5, w, 4);
    ctx.fillStyle = "rgba(220,215,205,0.4)";
    ctx.fillRect(0, fy - 4, w, 3);

    for (let c = 0; c < winCols; c++) {
      const wx = winGap * (c + 1) - winW / 2;

      // Window recess
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(wx - 3, fy - 4, winW + 6, winH + 8);

      // Stone surround — thick classical
      ctx.fillStyle = "rgba(225,220,210,0.9)";
      ctx.fillRect(wx - 4, fy - 5, winW + 8, 4); // lintel
      ctx.fillRect(wx - 4, fy, 4, winH); // left
      ctx.fillRect(wx + winW, fy, 4, winH); // right
      ctx.fillRect(wx - 4, fy + winH, winW + 8, 3); // sill

      // Pediment on top floor
      if (f === floors - 1) {
        ctx.fillStyle = "rgba(215,210,200,0.8)";
        ctx.fillRect(wx - 2, fy - 8, winW + 4, 4);
      }

      // Glass — light grey-blue
      ctx.fillStyle = "#8a9aaa";
      ctx.fillRect(wx, fy, winW, winH);

      // Mullion cross — white
      ctx.fillStyle = "rgba(240,236,228,0.9)";
      ctx.fillRect(wx + winW / 2 - 1, fy, 2, winH);
      ctx.fillRect(wx, fy + Math.floor(winH * 0.4), winW, 2);

      // Iron balcony — ornate dark railing
      if (f >= 1 && f <= floors - 2) {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(wx - 5, fy + winH + 2, winW + 10, 2);
        // Vertical balusters
        for (let r = 0; r < 7; r++) {
          ctx.fillRect(wx - 4 + r * Math.floor((winW + 8) / 6), fy + winH + 2, 1, 4);
        }
        // Balcony floor
        ctx.fillStyle = "rgba(160,155,145,0.7)";
        ctx.fillRect(wx - 5, fy + winH + 4, winW + 10, 2);
      }
    }
  }

  // Grand ground floor — arched openings
  const gfH = floorH + 8;
  ctx.fillStyle = "rgba(215,210,200,0.4)";
  ctx.fillRect(0, h - gfH, w, gfH);
  for (let c = 0; c < 3; c++) {
    const gx = Math.floor(w / 4) * (c + 1) - 14;
    ctx.fillStyle = "rgba(200,195,185,0.6)";
    ctx.fillRect(gx - 2, h - gfH + 4, 28, gfH - 6);
    ctx.fillStyle = "rgba(100,95,85,0.4)";
    ctx.fillRect(gx, h - gfH + 6, 24, gfH - 10);
  }

  // Ornamental roof cornice — double band
  ctx.fillStyle = "rgba(210,205,195,0.9)";
  ctx.fillRect(0, 0, w, 8);
  ctx.fillStyle = "rgba(190,185,175,0.7)";
  ctx.fillRect(0, 8, w, 3);
  // Dentil molding
  for (let d = 0; d < 32; d++) {
    ctx.fillStyle = "rgba(200,195,185,0.8)";
    ctx.fillRect(d * 8 + 1, 5, 4, 3);
  }

  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

/** Modern high-rise texture — varied styles */
function createTowerTexture(floors: number, variant: number): CanvasTexture {
  const w = 256, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Different base colors per variant
  const bases = ["#e8d8c4", "#d0d5da", "#c8d0c8", "#ddd0c0", "#b8c4d0", "#e0d0b8"];
  const glasses = ["#4a6575", "#3a5060", "#506a5a", "#5a6880", "#3a4a5a", "#5a7065"];
  ctx.fillStyle = bases[variant % bases.length]!;
  ctx.fillRect(0, 0, w, h);

  const floorH = Math.floor(h / Math.max(floors, 5));
  // Vary column count and window proportions
  const winCols = 6 + (variant % 4);
  const winW = Math.floor(w / winCols) - 6;
  const winH = Math.floor(floorH * (0.45 + (variant % 3) * 0.08));
  const winGap = Math.floor(w / winCols);

  for (let f = 0; f < Math.min(floors, 16); f++) {
    const fy = h - (f + 1) * floorH + Math.floor(floorH * 0.2);

    // Floor slab — varies by variant
    if (variant % 2 === 0) {
      ctx.fillStyle = "rgba(160,155,140,0.4)";
      ctx.fillRect(0, fy + winH + 2, w, 3);
    } else {
      ctx.fillStyle = "rgba(180,175,165,0.3)";
      ctx.fillRect(0, fy + winH + 1, w, 2);
    }

    for (let c = 0; c < winCols; c++) {
      const wx = winGap * c + Math.floor((winGap - winW) / 2);

      // Glass
      ctx.fillStyle = glasses[variant % glasses.length]!;
      ctx.fillRect(wx, fy, winW, winH);

      // Reflection — different positions
      ctx.fillStyle = "rgba(180,210,230,0.12)";
      if (variant % 3 === 0) ctx.fillRect(wx, fy, winW / 3, winH);
      else if (variant % 3 === 1) ctx.fillRect(wx + winW * 0.6, fy, winW * 0.4, winH * 0.6);
      else ctx.fillRect(wx, fy + winH * 0.3, winW * 0.5, winH * 0.7);

      // Balcony/frame style varies
      if (variant % 3 === 0) {
        // Horizontal balcony railing
        ctx.fillStyle = "rgba(200,195,185,0.7)";
        ctx.fillRect(wx - 2, fy + winH, winW + 4, 3);
      } else if (variant % 3 === 1) {
        // Thin frame
        ctx.fillStyle = "rgba(170,165,155,0.5)";
        ctx.fillRect(wx - 1, fy - 1, winW + 2, 1);
        ctx.fillRect(wx - 1, fy + winH, winW + 2, 1);
        ctx.fillRect(wx - 1, fy, 1, winH);
        ctx.fillRect(wx + winW, fy, 1, winH);
      } else {
        // Deep set mullion
        ctx.fillStyle = "rgba(190,185,175,0.6)";
        ctx.fillRect(wx + Math.floor(winW / 2), fy, 2, winH);
      }

      // Vertical divider between windows
      ctx.fillStyle = "rgba(180,175,165,0.4)";
      ctx.fillRect(wx + winW + 1, fy - 1, winGap - winW - 2, floorH);
    }
  }

  // Roof detail
  ctx.fillStyle = "rgba(180,175,165,0.5)";
  ctx.fillRect(0, 0, w, 4);

  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

/** Modern glass skyscraper — amber/golden tinted reflective panels, like sunset on a Monaco harbour tower. */
function createGlassTowerTexture(floors: number, variant: number): CanvasTexture {
  const w = 256, h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Vertical gradient — slightly darker frame at the top.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#3a3530");
  grad.addColorStop(1, "#5a4d3a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Amber glass tones — yellowish, with variation per variant.
  const ambers = [
    ["#f5c763", "#d99a3a", "#c47e22"],
    ["#f7d27a", "#e0a44a", "#b87830"],
    ["#ffd66e", "#dca33d", "#a8702a"],
    ["#f0bd58", "#d4933a", "#a06820"],
  ];
  const palette = ambers[variant % ambers.length]!;

  const cols = 5 + (variant % 3);
  const colW = Math.floor(w / cols);
  const winW = colW - 4;
  const floorH = Math.floor(h / Math.max(floors, 8));
  const winH = Math.floor(floorH * 0.78);

  for (let f = 0; f < floors; f++) {
    const fy = h - (f + 1) * floorH + Math.floor(floorH * 0.11);
    for (let c = 0; c < cols; c++) {
      const wx = c * colW + 2;

      // Pseudo-random pick from amber palette per panel — varies by floor & col.
      const idx = (c * 7 + f * 11 + variant * 3) % palette.length;
      ctx.fillStyle = palette[idx]!;
      ctx.fillRect(wx, fy, winW, winH);

      // Bright reflection streak
      ctx.fillStyle = "rgba(255,240,200,0.35)";
      ctx.fillRect(wx, fy, Math.floor(winW * 0.28), winH);

      // Deeper amber pool in the lower half (warm interior)
      ctx.fillStyle = "rgba(180,110,40,0.22)";
      ctx.fillRect(wx, fy + Math.floor(winH * 0.55), winW, Math.floor(winH * 0.45));

      // Mullion (vertical divider mid-window)
      ctx.fillStyle = "rgba(40,30,20,0.55)";
      ctx.fillRect(wx + Math.floor(winW / 2), fy, 1, winH);
    }
    // Floor slab — dark band between floors
    ctx.fillStyle = "rgba(30,22,16,0.7)";
    ctx.fillRect(0, fy + winH, w, floorH - winH);
  }

  // Crown — slightly brighter strip at the top to suggest a lit cornice.
  ctx.fillStyle = "rgba(255,210,120,0.25)";
  ctx.fillRect(0, 0, w, 6);

  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

/** Classic gold Monaco facade — warm yellow, ornate balconies, arched ground floor */
function createGoldTexture(floors: number): CanvasTexture {
  const w = 256, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Warm gold/yellow wall
  ctx.fillStyle = "#e8c878";
  ctx.fillRect(0, 0, w, h);

  // Subtle texture
  ctx.fillStyle = "rgba(200,170,80,0.1)";
  for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1);

  const floorH = Math.floor(h / Math.max(floors, 3));
  const winCols = 4;
  const winW = 16;
  const winH = Math.floor(floorH * 0.55);
  const winGap = Math.floor(w / (winCols + 1));

  for (let f = 0; f < Math.min(floors, 7); f++) {
    const fy = h - (f + 1) * floorH + Math.floor(floorH * 0.15);

    // Ornate cornice between floors
    ctx.fillStyle = "rgba(220,200,140,0.7)";
    ctx.fillRect(0, fy + winH + 5, w, 5);
    ctx.fillStyle = "rgba(200,180,120,0.5)";
    ctx.fillRect(0, fy - 4, w, 3);

    for (let c = 0; c < winCols; c++) {
      const wx = winGap * (c + 1) - winW / 2;

      // Ornate frame — thick gold surround
      ctx.fillStyle = "rgba(210,190,120,0.9)";
      ctx.fillRect(wx - 5, fy - 6, winW + 10, winH + 12);

      // Inner recess
      ctx.fillStyle = "rgba(180,160,100,0.6)";
      ctx.fillRect(wx - 2, fy - 2, winW + 4, winH + 4);

      // Shutters — green
      ctx.fillStyle = "#3a6848";
      ctx.fillRect(wx, fy, Math.floor(winW / 2) - 1, winH);
      ctx.fillRect(wx + Math.floor(winW / 2) + 1, fy, Math.floor(winW / 2) - 1, winH);

      // Glass between shutters
      ctx.fillStyle = "#4a7a90";
      ctx.fillRect(wx + Math.floor(winW / 2) - 1, fy, 2, winH);

      // Ornate iron balcony
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(wx - 6, fy + winH + 2, winW + 12, 2);
      for (let r = 0; r < 8; r++) {
        ctx.fillRect(wx - 5 + r * Math.floor((winW + 10) / 7), fy + winH + 2, 1, 4);
      }
      // Curved balcony bottom
      ctx.fillStyle = "rgba(30,30,30,0.6)";
      ctx.fillRect(wx - 6, fy + winH + 5, winW + 12, 1);
    }
  }

  // Grand arched ground floor
  const gfH = floorH + 10;
  ctx.fillStyle = "rgba(190,165,90,0.5)";
  ctx.fillRect(0, h - gfH, w, gfH);
  for (let c = 0; c < 3; c++) {
    const gx = Math.floor(w / 4) * (c + 1) - 16;
    // Arch shape (rectangle + semicircle)
    ctx.fillStyle = "rgba(200,180,110,0.8)";
    ctx.fillRect(gx - 3, h - gfH + 8, 32, gfH - 10);
    ctx.fillStyle = "rgba(50,45,35,0.5)";
    ctx.fillRect(gx, h - gfH + 12, 26, gfH - 16);
    // Arch top
    ctx.beginPath();
    ctx.arc(gx + 13, h - gfH + 12, 13, Math.PI, 0);
    ctx.fillStyle = "rgba(50,45,35,0.5)";
    ctx.fill();
  }

  // Ornamental roof cornice
  ctx.fillStyle = "rgba(220,200,140,0.9)";
  ctx.fillRect(0, 0, w, 8);
  for (let d = 0; d < 16; d++) {
    ctx.fillRect(d * 16 + 2, 4, 8, 5);
  }

  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

/** Ultra-modern terraced tower — white with curved green balconies */
function createModernTerracedTexture(floors: number): CanvasTexture {
  const w = 256, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Light grey-white base
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(0, 0, w, h);

  const floorH = Math.floor(h / Math.max(floors, 6));

  for (let f = 0; f < Math.min(floors, 18); f++) {
    const fy = h - (f + 1) * floorH;

    // Dark glass band
    ctx.fillStyle = "#3a4a55";
    ctx.fillRect(0, fy + 3, w, Math.floor(floorH * 0.5));

    // Glass reflection
    ctx.fillStyle = "rgba(120,170,200,0.2)";
    ctx.fillRect(0, fy + 3, w / 3, Math.floor(floorH * 0.5));

    // White concrete balcony slab — thick sweeping band
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, fy + Math.floor(floorH * 0.5) + 3, w, 4);
    // Shadow under slab
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(0, fy + Math.floor(floorH * 0.5) + 7, w, 2);

    // Green vegetation strips on balcony — every other floor
    if (f % 2 === 0) {
      ctx.fillStyle = "#4a8a3a";
      ctx.fillRect(8, fy + Math.floor(floorH * 0.5) + 1, w - 16, 3);
      // Varied green tones
      for (let g = 0; g < 8; g++) {
        const gx = 12 + g * 28;
        ctx.fillStyle = g % 2 === 0 ? "#3a7a2e" : "#5a9a4a";
        ctx.fillRect(gx, fy + Math.floor(floorH * 0.5) - 1, 20, 4);
      }
    }

    // White railing dots
    ctx.fillStyle = "rgba(240,240,240,0.6)";
    for (let r = 0; r < 32; r++) {
      ctx.fillRect(r * 8 + 2, fy + Math.floor(floorH * 0.5) + 3, 1, 3);
    }
  }

  // Roof
  ctx.fillStyle = "#d8d8d8";
  ctx.fillRect(0, 0, w, 4);

  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

// Pre-generate texture banks at module load. Counts are kept lean —
// each <canvas> draw is ~10-30ms on first paint and they all live in
// memory permanently. Re-using fewer textures is faster to start AND
// reduces GPU texture-binds because more meshes share the same map.
const FACADE_TEXTURES: CanvasTexture[] = [];
const FACADE_BANK = Math.min(BLDG_COLORS.length, 4);
for (let i = 0; i < FACADE_BANK; i++) {
  FACADE_TEXTURES.push(
    createFacadeTexture(BLDG_COLORS[i]!, 4 + (i % 4), SHUTTER_COLORS[i % SHUTTER_COLORS.length]!)
  );
}
const GRAND_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 2; i++) {
  GRAND_TEXTURES.push(createGrandTexture(4 + i));
}
const TOWER_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 3; i++) {
  TOWER_TEXTURES.push(createTowerTexture(8 + i * 2, i));
}
const GLASS_TOWER_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 2; i++) {
  GLASS_TOWER_TEXTURES.push(createGlassTowerTexture(12 + i * 2, i));
}
const GOLD_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 2; i++) {
  GOLD_TEXTURES.push(createGoldTexture(4 + i));
}
const MODERN_TERRACED_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 2; i++) {
  MODERN_TERRACED_TEXTURES.push(createModernTerracedTexture(10 + i * 3));
}

interface Bldg {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  type: "block" | "tower";
  floors: number;
  mansard: boolean;
  roofColor?: string;
}

function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// Track samples — computed once from spline. The track is now flat (y=0)
// and much larger; we still keep `getTrackElevation` for legacy callers.
const _elCurve = new CatmullRomCurve3(TRACK_POINTS, true, "centripetal", 0.5);
const TRACK_SAMPLES: { x: number; y: number; z: number }[] = [];
for (let i = 0; i < 800; i++) {
  const pt = _elCurve.getPointAt(i / 800);
  TRACK_SAMPLES.push({ x: pt.x, y: pt.y, z: pt.z });
}

// Track bounds, computed once. Used to position the city, sea, beach.
const TRACK_BOUNDS = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of TRACK_POINTS) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
})();

function getTrackElevation(_x: number, _z: number): number {
  // Track is now flat — kept for any legacy hook that still calls this.
  return 0;
}

function generateCity(): Bldg[] {
  const rng = seededRng(123);
  const buildings: Bldg[] = [];
  const G = -0.5;

  // Track centroid + outward normal per sample. We'll seed buildings along
  // the track contour, on the OUTSIDE of the loop, in two stepped rows.
  let cx = 0, cz = 0;
  for (const s of TRACK_SAMPLES) { cx += s.x; cz += s.z; }
  cx /= TRACK_SAMPLES.length;
  cz /= TRACK_SAMPLES.length;

  const trackPts: [number, number][] = TRACK_SAMPLES.map((s) => [s.x, s.z]);
  function tooCloseToTrack(x: number, z: number, halfW: number): boolean {
    const minDist = 16 + halfW;
    const minDistSq = minDist * minDist;
    for (const [tx, tz] of trackPts) {
      const dx = x - tx, dz = z - tz;
      if (dx * dx + dz * dz < minDistSq) return true;
    }
    return false;
  }

  // Cream / white / soft Mediterranean palette inspired by the photo:
  // mostly warm white-cream facades with a few terracotta-roof toned ones.
  const FRONT_COLORS = ["#f4ecd8", "#ece4cd", "#f2dcc0", "#e8d6b0", "#f0e7d0", "#dfc8a4"];
  const BACK_COLORS = ["#f7f1e0", "#eae0c8", "#fbf6e8", "#e0d2b0", "#f4e8d0"];
  const TERRACOTTA = ["#c66a4a", "#b35a3a", "#a84a30"];

  // Light, varied building generation — small footprint blocks with the
  // occasional taller mansard, sized so the town feels sparse and pretty
  // rather than densely packed.
  function placeBuilding(
    x: number,
    z: number,
    palette: string[],
    minH: number,
    maxH: number,
    minSize = 6,
    sizeRange = 6,
  ) {
    const w = minSize + rng() * sizeRange;
    const d = minSize + rng() * (sizeRange * 0.7);
    if (tooCloseToTrack(x, z, Math.max(w, d) / 2)) return;
    const visH = minH + rng() * (maxH - minH);
    const totalH = Math.max(2, visH - G);
    const wantsMansard = rng() < 0.35;
    const roof = wantsMansard ? TERRACOTTA[Math.floor(rng() * TERRACOTTA.length)]! : undefined;
    buildings.push({
      pos: [x, G + totalH / 2, z],
      size: [w, totalH, d],
      color: palette[Math.floor(rng() * palette.length)]!,
      type: "block",
      floors: Math.max(1, Math.floor(visH / 3)),
      mansard: wantsMansard,
      roofColor: roof,
    });
  }

  // Walk track samples and lay two stepped rows on BOTH sides of the
  // road — outer ring (away from centroid) gets the full town silhouette,
  // inner ring (inside the loop) gets a sparser harbour-front so the
  // sea-facing side isn't bare. Front row low, back row taller.
  const STRIDE = 6;
  for (let i = 0; i < TRACK_SAMPLES.length; i += STRIDE) {
    const s = TRACK_SAMPLES[i]!;
    const sNext = TRACK_SAMPLES[(i + 1) % TRACK_SAMPLES.length]!;
    const tx = sNext.x - s.x;
    const tz = sNext.z - s.z;
    const tlen = Math.hypot(tx, tz) || 1;
    let nxn = -tz / tlen;
    let nzn = tx / tlen;
    if (nxn * (s.x - cx) + nzn * (s.z - cz) < 0) {
      nxn = -nxn;
      nzn = -nzn;
    }

    const jitterFront = ((i * 7) % 11) - 5;
    const jitterBack = ((i * 13) % 9) - 4;

    // Outer side — front row (close to track) + back row (taller, set back).
    {
      const fx = s.x + nxn * 22 + (-nzn) * jitterFront;
      const fz = s.z + nzn * 22 + nxn * jitterFront;
      placeBuilding(fx, fz, FRONT_COLORS, 6, 12, 7, 5);

      const bx = s.x + nxn * 48 + (-nzn) * jitterBack;
      const bz = s.z + nzn * 48 + nxn * jitterBack;
      placeBuilding(bx, bz, BACK_COLORS, 12, 22, 9, 7);
    }

    // Inner side is sea / harbour — no buildings here.
  }

  // A handful of taller signature buildings placed sparsely further out
  // (the modern white/glass towers visible above the harbor in the photo).
  const TOWER_STRIDE = 36;
  for (let i = 0; i < TRACK_SAMPLES.length; i += TOWER_STRIDE) {
    const s = TRACK_SAMPLES[i]!;
    const sNext = TRACK_SAMPLES[(i + 1) % TRACK_SAMPLES.length]!;
    const tx = sNext.x - s.x;
    const tz = sNext.z - s.z;
    const tlen = Math.hypot(tx, tz) || 1;
    let nxn = -tz / tlen;
    let nzn = tx / tlen;
    if (nxn * (s.x - cx) + nzn * (s.z - cz) < 0) {
      nxn = -nxn;
      nzn = -nzn;
    }
    const x = s.x + nxn * 80;
    const z = s.z + nzn * 80;
    if (tooCloseToTrack(x, z, 12)) continue;
    const visH = 24 + rng() * 18;
    const totalH = Math.max(8, visH - G);
    buildings.push({
      pos: [x, G + totalH / 2, z],
      size: [11 + rng() * 4, totalH, 11 + rng() * 4],
      color: rng() > 0.5 ? "#e8e2d4" : "#dadada",
      type: "tower",
      floors: Math.max(4, Math.floor(visH / 3)),
      mansard: false,
    });
  }

  return buildings;
}

const CITY = generateCity();

/** Generate support wall geometry under elevated track sections */
function buildSupportGeometry() {
  const curve = new CatmullRomCurve3(TRACK_POINTS, true, "centripetal", 0.5);
  const segments = 600; // more segments = smoother on curves
  const ground = -0.6;
  const minElev = 1.0;
  const hw = (TRACK_WIDTH / 2) - 0.5; // almost full track width

  const positions: number[] = [];
  const indices: number[] = [];

  let prevIdx = -1; // index of previous valid slice's first vertex
  let prevSegI = -999; // segment index of previous valid slice

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    if (pt.y < minElev) {
      prevIdx = -1; // reset — don't connect across gaps
      continue;
    }

    const tangent = curve.getTangentAt(t);
    const rx = -tangent.z, rz = tangent.x;
    const len = Math.sqrt(rx * rx + rz * rz) || 1;
    const nx = (rx / len) * hw, nz = (rz / len) * hw;

    const base = positions.length / 3;
    positions.push(pt.x - nx, ground, pt.z - nz);     // 0: bottom-left
    positions.push(pt.x + nx, ground, pt.z + nz);     // 1: bottom-right
    positions.push(pt.x - nx, pt.y - 0.3, pt.z - nz); // 2: top-left
    positions.push(pt.x + nx, pt.y - 0.3, pt.z + nz); // 3: top-right

    // Only connect if previous slice was consecutive (no gap)
    if (prevIdx >= 0 && i - prevSegI <= 2) {
      const p = prevIdx;
      // Left wall — both windings for double-sided
      indices.push(p, base, p + 2);
      indices.push(base, base + 2, p + 2);
      indices.push(p, p + 2, base);
      indices.push(base, p + 2, base + 2);
      // Right wall — both windings
      indices.push(p + 1, p + 3, base + 1);
      indices.push(base + 1, p + 3, base + 3);
      indices.push(p + 1, base + 1, p + 3);
      indices.push(base + 1, base + 3, p + 3);
      // Bottom face
      indices.push(p, p + 1, base);
      indices.push(base, p + 1, base + 1);
    } else if (prevIdx < 0) {
      // Start cap — close the front face of a new section
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }

    prevIdx = base;
    prevSegI = i;
  }

  // End cap for last section
  if (prevIdx >= 0) {
    const p = prevIdx;
    indices.push(p, p + 2, p + 1);
    indices.push(p + 1, p + 2, p + 3);
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// Beach + sea live to the SOUTH of the track (positive z). Beach is a thin
// strip hugging the southern edge; sea extends beyond to the horizon.
const BEACH_Z_NEAR = TRACK_BOUNDS.maxZ + 60; // matches inSea() threshold above
const BEACH_Z_FAR = TRACK_BOUNDS.maxZ + 140;
const BEACH_X_LEFT = TRACK_BOUNDS.minX - 200;
const BEACH_X_RIGHT = TRACK_BOUNDS.maxX + 200;

/** Beach strip whose track-facing edge hugs the southern outline of the
 *  track (so the sand follows wherever the road bulges south), with a wavy
 *  micro-detail on top. The far edge is straight and tucked under the sea. */
/** Sea geometry for the harbour INSIDE the closed track loop. We inset
 *  each track sample slightly toward the loop centroid to leave a small
 *  gap between road and water, then fan-triangulate from the centroid. */
function buildInnerSeaGeometry() {
  let cx = 0, cz = 0;
  for (const s of TRACK_SAMPLES) { cx += s.x; cz += s.z; }
  cx /= TRACK_SAMPLES.length;
  cz /= TRACK_SAMPLES.length;

  const INSET = 14; // gap between road and water edge
  const positions: number[] = [];
  const indices: number[] = [];

  // Vertex 0 = centroid
  positions.push(cx, -0.45, cz);

  for (let i = 0; i < TRACK_SAMPLES.length; i++) {
    const s = TRACK_SAMPLES[i]!;
    const sNext = TRACK_SAMPLES[(i + 1) % TRACK_SAMPLES.length]!;
    const tx = sNext.x - s.x;
    const tz = sNext.z - s.z;
    const tlen = Math.hypot(tx, tz) || 1;
    let nxn = -tz / tlen;
    let nzn = tx / tlen;
    // Inward normal — toward centroid.
    if (nxn * (s.x - cx) + nzn * (s.z - cz) > 0) {
      nxn = -nxn;
      nzn = -nzn;
    }
    const px = s.x + nxn * INSET;
    const pz = s.z + nzn * INSET;
    positions.push(px, -0.45, pz);
  }

  const N = TRACK_SAMPLES.length;
  for (let i = 0; i < N; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % N);
    indices.push(0, a, b);
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildBeachGeometry() {
  const segments = 192;
  const xStart = BEACH_X_LEFT;
  const xEnd = BEACH_X_RIGHT;
  const NEAR_OFFSET = 28; // gap between southernmost track edge and beach
  const FALLBACK_NEAR = TRACK_BOUNDS.maxZ + NEAR_OFFSET;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = xStart + t * (xEnd - xStart);
    const wobble = Math.sin(t * Math.PI * 6) * 4 + Math.sin(t * Math.PI * 11) * 2 + Math.cos(t * Math.PI * 3.7) * 3;

    // Find southernmost track sample within a small horizontal window of `x`.
    // That gives us a contour that follows the track's south edge.
    let southZ = -Infinity;
    const win = 60;
    for (const s of TRACK_SAMPLES) {
      if (Math.abs(s.x - x) > win) continue;
      if (s.z > southZ) southZ = s.z;
    }
    const nearZ = (southZ === -Infinity ? FALLBACK_NEAR : southZ + NEAR_OFFSET) + wobble;
    // Clamp so the beach never invades the sea plane area.
    const beachNear = Math.min(nearZ, BEACH_Z_FAR - 8);

    // Near edge (track side) — follows track contour
    positions.push(x, -0.48, beachNear);
    // Far edge (sea side) — straight (hidden under sea plane)
    positions.push(x, -0.48, BEACH_Z_FAR);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1);
      indices.push(base + 1, base + 2, base + 3);
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Procedural sky dome — inverted sphere with vertex gradient */
function buildSkyDome() {
  const g = new SphereGeometry(900, 32, 16);
  const pos = g.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const horizon = new Color("#e4ecf4");
  const zenith = new Color("#4a90d0");
  const v = new Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, (y + 100) / 900));
    v.copy(horizon).lerp(zenith, t);
    colors[i * 3] = v.r;
    colors[i * 3 + 1] = v.g;
    colors[i * 3 + 2] = v.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return g;
}

/** Fluffy cloud built from overlapping spheres */
function Cloud({ position, scale = 12 }: { position: [number, number, number]; scale?: number }) {
  // Reduced from 7 to 4 puffs per cloud — same look at altitude, much less geometry.
  const puffs: [number, number, number, number][] = [
    [0,     0,     0,    1.0],
    [0.95, -0.1,   0.05, 0.75],
    [-0.9,  0.05,  0.1,  0.8],
    [0.0,   0.32,  0.0,  0.62],
  ];
  return (
    <group position={position} scale={scale}>
      {puffs.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[s, 8, 6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

/** Simple palm tree — trunk + splayed fronds */
function PalmTree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const trunkH = 4.5;
  const fronds = 7;
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.3, trunkH, 8]} />
        <meshStandardMaterial color="#6b4a28" roughness={0.95} />
      </mesh>
      {Array.from({ length: fronds }).map((_, i) => {
        const a = (i / fronds) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.6, trunkH + 0.1, Math.sin(a) * 0.6]}
            rotation={[0.35 * Math.sin(a), -a, 0.35 * Math.cos(a)]}
            castShadow
          >
            <boxGeometry args={[0.2, 0.08, 2.0]} />
            <meshStandardMaterial color={i % 2 ? "#3e7a2e" : "#4f9a3a"} roughness={0.7} />
          </mesh>
        );
      })}
      {/* Coconut cluster */}
      <mesh position={[0, trunkH, 0]}>
        <sphereGeometry args={[0.35, 8, 6]} />
        <meshStandardMaterial color="#4a3520" />
      </mesh>
    </group>
  );
}

/** Harbour yacht — chunkier hull, waterline stripe, deck details, flag at masthead. */
function Yacht({ position, rotation = 0, scale = 1, hull = "#ffffff", accent = "#1a2540", flag = "#dc0000" }:
  { position: [number, number, number]; rotation?: number; scale?: number; hull?: string; accent?: string; flag?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {/* Main hull */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[2.6, 1.0, 7.5]} />
        <meshStandardMaterial color={hull} />
      </mesh>
      {/* Waterline stripe — thin coloured band along the hull */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[2.62, 0.18, 7.52]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {/* Tapered prow (front wedge) */}
      <mesh position={[0, 0.5, 4.1]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.8, 1.0, 0.9]} />
        <meshStandardMaterial color={hull} />
      </mesh>
      <mesh position={[0, 0.5, 4.6]}>
        <boxGeometry args={[1.0, 1.0, 0.4]} />
        <meshStandardMaterial color={hull} />
      </mesh>
      {/* Cabin / superstructure */}
      <mesh position={[0, 1.4, -0.6]} castShadow>
        <boxGeometry args={[2.0, 0.8, 4.0]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      {/* Cabin window band */}
      <mesh position={[0, 1.45, -0.6]}>
        <boxGeometry args={[2.02, 0.4, 3.9]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.2} />
      </mesh>
      {/* Sun deck (upper level) */}
      <mesh position={[0, 2.05, -1.4]} castShadow>
        <boxGeometry args={[1.5, 0.5, 2.2]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      {/* Mast */}
      <mesh position={[0, 3.0, -1.6]}>
        <cylinderGeometry args={[0.05, 0.05, 2.6, 6]} />
        <meshStandardMaterial color="#cccccc" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Flag at the top of the mast */}
      <mesh position={[0.45, 4.0, -1.6]}>
        <boxGeometry args={[0.7, 0.4, 0.02]} />
        <meshStandardMaterial color={flag} side={DoubleSide} />
      </mesh>
      {/* Stern flagpole */}
      <mesh position={[0, 1.5, -3.6]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
        <meshStandardMaterial color="#bbbbbb" />
      </mesh>
    </group>
  );
}

/** Grandstand — stepped seats with colourful crowd specks */
function Grandstand({ position, rotation = 0, length = 26 }:
  { position: [number, number, number]; rotation?: number; length?: number }) {
  const rows = 5;
  const seatsPerRow = 20;
  const shirts = ["#e23030", "#3050e0", "#f0c040", "#40a050", "#ff7020", "#9040c0", "#ffffff", "#20b0c0"];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: rows }).map((_, r) => (
        <mesh key={`step-${r}`} position={[0, r * 0.7 + 0.35, -r * 1.0]} castShadow receiveShadow>
          <boxGeometry args={[length, 0.7, 1.0]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: seatsPerRow }).map((_, c) => (
          <mesh
            key={`p-${r}-${c}`}
            position={[(c - (seatsPerRow - 1) / 2) * (length / seatsPerRow), r * 0.7 + 1.05, -r * 1.0 - 0.2]}
          >
            <boxGeometry args={[0.35, 0.7, 0.35]} />
            <meshStandardMaterial color={shirts[(c * 3 + r * 5) % shirts.length]!} />
          </mesh>
        ))
      )}
      {/* Roof beam */}
      <mesh position={[0, rows * 0.7 + 2.5, -rows * 1.0 + 0.5]} castShadow>
        <boxGeometry args={[length + 2, 0.15, (rows + 1) * 1.0]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
      {/* Roof supports */}
      {[-length / 2 + 1, 0, length / 2 - 1].map((x, i) => (
        <mesh key={`sup-${i}`} position={[x, rows * 0.7 + 1.2, -rows * 1.0 + 0.5]}>
          <boxGeometry args={[0.2, 2.8, 0.2]} />
          <meshStandardMaterial color="#b0b0b0" />
        </mesh>
      ))}
    </group>
  );
}

/** Tiny parked F1 — low body, front + rear wing, two side bargeboards. */
function Bolide({ position, rotation = 0, color = "#dc0000", accent = "#0a0a0a" }:
  { position: [number, number, number]; rotation?: number; color?: string; accent?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Main body */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.45, 4.4]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Cockpit hump */}
      <mesh position={[0, 0.7, -0.2]} castShadow>
        <boxGeometry args={[0.7, 0.35, 1.2]} />
        <meshStandardMaterial color={accent} roughness={0.55} />
      </mesh>
      {/* Front wing */}
      <mesh position={[0, 0.18, 2.0]} castShadow>
        <boxGeometry args={[2.0, 0.12, 0.6]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
      {/* Rear wing */}
      <mesh position={[0, 0.95, -2.0]} castShadow>
        <boxGeometry args={[1.6, 0.5, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      {/* Wheels */}
      {[
        [-0.85, 0.32, 1.4], [0.85, 0.32, 1.4],
        [-0.85, 0.32, -1.4], [0.85, 0.32, -1.4],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.4, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** Colorful sponsor banner/board */
function Banner({ position, rotation = 0, width = 4, color = "#e03040", accent = "#ffffff" }:
  { position: [number, number, number]; rotation?: number; width?: number; color?: string; accent?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <boxGeometry args={[width, 1.0, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* accent stripe */}
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[width * 0.95, 0.2, 0.02]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {/* posts */}
      <mesh position={[-width / 2 + 0.1, -0.7, 0]}>
        <boxGeometry args={[0.08, 1.4, 0.08]} />
        <meshStandardMaterial color="#606060" />
      </mesh>
      <mesh position={[width / 2 - 0.1, -0.7, 0]}>
        <boxGeometry args={[0.08, 1.4, 0.08]} />
        <meshStandardMaterial color="#606060" />
      </mesh>
    </group>
  );
}

const SKY_DOME_GEOM = buildSkyDome();

// Node material for the dome — explicit so WebGPU picks up the colour
// attribute uploaded onto SKY_DOME_GEOM via `vertexColor()`.
const SKY_MATERIAL = (() => {
  const m = new MeshBasicNodeMaterial();
  m.colorNode = vertexColor();
  m.side = BackSide;
  m.depthWrite = false;
  m.fog = false;
  return m;
})();

// Palm tree positions — strung along the beach (south edge).
const PALM_POSITIONS: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const count = 28;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = BEACH_X_LEFT + 30 + t * (BEACH_X_RIGHT - BEACH_X_LEFT - 60);
    const z = BEACH_Z_NEAR + 14 + ((i * 7) % 13) - 6;
    out.push([x, 0, z]);
  }
  return out;
})();

// Yacht positions — drifting in the inner harbour sea (inside the loop).
// Each yacht hugs the inset water edge near a track sample, with its bow
// pointing toward the centroid so the fleet looks moored along the quay.
const YACHT_POSITIONS: { pos: [number, number, number]; rot: number; scale: number; hull: string; accent: string; flag: string }[] = (() => {
  const palette = [
    { hull: "#ffffff", accent: "#1a2540", flag: "#dc0000" },
    { hull: "#f5f5f5", accent: "#0a1628", flag: "#ffec00" },
    { hull: "#ffffff", accent: "#243044", flag: "#005aff" },
    { hull: "#ebebeb", accent: "#101820", flag: "#dc0000" },
    { hull: "#ffffff", accent: "#1a2540", flag: "#22c55e" },
    { hull: "#f8f8f8", accent: "#0a1628", flag: "#dc0000" },
    { hull: "#ffffff", accent: "#243044", flag: "#ffec00" },
    { hull: "#f0f0f0", accent: "#1a2540", flag: "#005aff" },
  ];
  let cx = 0, cz = 0;
  for (const s of TRACK_SAMPLES) { cx += s.x; cz += s.z; }
  cx /= TRACK_SAMPLES.length;
  cz /= TRACK_SAMPLES.length;

  const out: { pos: [number, number, number]; rot: number; scale: number; hull: string; accent: string; flag: string }[] = [];
  const count = 22;
  const step = Math.max(1, Math.floor(TRACK_SAMPLES.length / count));
  let idx = 0;
  for (let i = 0; i < TRACK_SAMPLES.length && idx < count; i += step) {
    const s = TRACK_SAMPLES[i]!;
    const sNext = TRACK_SAMPLES[(i + 1) % TRACK_SAMPLES.length]!;
    const tx = sNext.x - s.x;
    const tz = sNext.z - s.z;
    const tlen = Math.hypot(tx, tz) || 1;
    let nxn = -tz / tlen;
    let nzn = tx / tlen;
    if (nxn * (s.x - cx) + nzn * (s.z - cz) > 0) {
      nxn = -nxn;
      nzn = -nzn;
    }
    const offset = 22 + ((idx * 7) % 18);
    const px = s.x + nxn * offset;
    const pz = s.z + nzn * offset;
    const angle = Math.atan2(nxn, nzn);
    const c = palette[idx % palette.length]!;
    out.push({
      pos: [px, -0.15, pz],
      rot: angle + Math.PI / 2 + ((idx * 0.21) % 1) * 0.4 - 0.2,
      scale: 0.9 + ((idx * 17) % 10) * 0.06,
      hull: c.hull,
      accent: c.accent,
      flag: c.flag,
    });
    idx++;
  }
  return out;
})();

// Cloud positions — sprinkled high above the whole map (track + sea).
const CLOUD_POSITIONS: { pos: [number, number, number]; scale: number }[] = (() => {
  const out: { pos: [number, number, number]; scale: number }[] = [];
  const count = 70;
  const xMin = TRACK_BOUNDS.minX - 2000;
  const xMax = TRACK_BOUNDS.maxX + 2000;
  const zMin = TRACK_BOUNDS.minZ - 2000;
  const zMax = TRACK_BOUNDS.maxZ + 2000;
  for (let i = 0; i < count; i++) {
    const x = xMin + ((i * 911) % (xMax - xMin));
    const z = zMin + ((i * 1373) % (zMax - zMin));
    out.push({
      pos: [x, 240 + ((i * 17) % 140), z],
      scale: 32 + ((i * 13) % 38),
    });
  }
  return out;
})();

export default function Environment() {
  const beachGeom = useMemo(() => buildBeachGeometry(), []);
  const innerSeaGeom = useMemo(() => buildInnerSeaGeometry(), []);
  const supportGeom = useMemo(() => buildSupportGeometry(), []);

  // Suppress unused — we keep these around as the strategy evolves.
  void beachGeom;
  void innerSeaGeom;
  void supportGeom;

  // Track centroid + outward normals (computed once for all the local
  // features below: beach segment, hill backdrop behind start, etc.).
  const { centroid, outward } = useMemo(() => {
    let cx = 0, cz = 0;
    for (const s of TRACK_SAMPLES) { cx += s.x; cz += s.z; }
    cx /= TRACK_SAMPLES.length;
    cz /= TRACK_SAMPLES.length;
    const n = TRACK_SAMPLES.length;
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const s = TRACK_SAMPLES[i]!;
      const next = TRACK_SAMPLES[(i + 1) % n]!;
      const tx = next.x - s.x;
      const tz = next.z - s.z;
      const tlen = Math.hypot(tx, tz) || 1;
      let nx = -tz / tlen;
      let nz = tx / tlen;
      if (nx * (s.x - cx) + nz * (s.z - cz) < 0) {
        nx = -nx;
        nz = -nz;
      }
      out.push({ x: nx, z: nz });
    }
    return { centroid: { x: cx, z: cz }, outward: out };
  }, []);

  // BEACH SEGMENT — runs along the OUTER side of the track. Stretches
  // from before the start straight, all the way past the tunnel and a
  // bit further along that side. Sea sits beyond the beach.
  const beachLocal = useMemo(() => {
    // Beach + sea strip rides along the recorded SEA_POLYLINE, outward
    // (away from track centroid). One vertex per polyline point on the
    // inner edge, one on the outer — joined into a quad strip.
    const positions: number[] = [];
    const indices: number[] = [];
    const seaPos: number[] = [];
    const seaIdx: number[] = [];
    const Y_BEACH = -0.25;
    const Y_SEA = -0.55;
    const INNER = 13;
    const OUTER = 65;
    const SEA_FAR = 1500; // sea reaches well past the horizon (fog handles fade)
    // Clip sea reach if a building polyline point sits anywhere near the
    // outward path. Wider corridor + bigger gap so the sea cleanly stops
    // before the building zones.
    const CORRIDOR_HALFWIDTH = 280;
    const BUILDING_GAP = 80;
    const buildingPts: XZ[] = BUILDING_POLYLINES.flat();

    const pts = SEA_POLYLINE;
    const trackPoly = TRACK_POINTS as { x: number; z: number }[];
    // Reject beach/sea verts that land too close to ANY part of the road
    // (the spline can fold back at hairpins so the local outward normal
    // sometimes lands on a different stretch of track).
    const ROAD_CLEAR = 18;
    const tooCloseToTrack = (px: number, pz: number) => {
      const min2 = ROAD_CLEAR * ROAD_CLEAR;
      for (const ts of TRACK_SAMPLES) {
        const dx = ts.x - px;
        const dz = ts.z - pz;
        if (dx * dx + dz * dz < min2) return true;
      }
      return false;
    };
    const TAPER_LEN = 18;
    // Track per-point sea width so we can drop quads that would render as
    // thin puddles instead of open water.
    const seaWidth: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const { ox, oz } = polyOutward(pts, i, centroid.x, centroid.z);
      const distFromStart = i;
      const distFromEnd = pts.length - 1 - i;
      const taper = Math.min(1, Math.min(distFromStart, distFromEnd) / TAPER_LEN);
      // Clip beach outer too: if it lands inside the loop OR clips a road
      // sample, shorten it. Below we step back from the candidate outward
      // distance until both checks pass.
      let beachOuter = OUTER;
      while (beachOuter > INNER + 2) {
        const tx = p.x + ox * beachOuter;
        const tz = p.z + oz * beachOuter;
        if (!pointInPolyXZ(tx, tz, trackPoly) && !tooCloseToTrack(tx, tz)) break;
        beachOuter -= 4;
      }
      if (beachOuter < INNER + 2) beachOuter = INNER + 2;
      let reach = beachOuter + 8 + (SEA_FAR - beachOuter - 8) * taper;
      // Clip if a building polyline point sits in the outward corridor.
      for (const bp of buildingPts) {
        const dx = bp.x - p.x;
        const dz = bp.z - p.z;
        const proj = dx * ox + dz * oz;
        if (proj < beachOuter + 5 || proj > reach) continue;
        const perp = Math.abs(dx * (-oz) + dz * ox);
        if (perp < CORRIDOR_HALFWIDTH) {
          const clipped = proj - BUILDING_GAP;
          if (clipped < reach) reach = clipped;
        }
      }
      // Walk reach back if the outer sea vertex lands inside the loop.
      const STEP = 20;
      for (let r = reach; r > beachOuter + 8; r -= STEP) {
        const tx = p.x + ox * r;
        const tz = p.z + oz * r;
        if (!pointInPolyXZ(tx, tz, trackPoly)) {
          reach = r;
          break;
        }
        reach = beachOuter + 8;
      }
      if (reach < beachOuter + 8) reach = beachOuter + 8;
      const wobble = Math.sin(i * 0.32) * 3;
      positions.push(p.x + ox * INNER, Y_BEACH, p.z + oz * INNER);
      positions.push(p.x + ox * (beachOuter + wobble), Y_BEACH, p.z + oz * (beachOuter + wobble));
      seaPos.push(p.x + ox * (beachOuter + wobble), Y_SEA, p.z + oz * (beachOuter + wobble));
      seaPos.push(p.x + ox * reach, Y_SEA, p.z + oz * reach);
      seaWidth.push(reach - (beachOuter + wobble));
    }
    const MIN_SEA_WIDTH = 35;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      // Drop sea quads where either end is a thin sliver (reads as a puddle).
      if (seaWidth[i]! >= MIN_SEA_WIDTH && seaWidth[i + 1]! >= MIN_SEA_WIDTH) {
        seaIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }

    const beach = new BufferGeometry();
    beach.setAttribute("position", new Float32BufferAttribute(positions, 3));
    beach.setIndex(indices);
    beach.computeVertexNormals();
    const sea = new BufferGeometry();
    sea.setAttribute("position", new Float32BufferAttribute(seaPos, 3));
    sea.setIndex(seaIdx);
    sea.computeVertexNormals();
    return { beachGeom: beach, seaGeom: sea };
  }, [centroid]);

  // Yachts moored in the sea strip — sampled along the polyline.
  const yachts = useMemo(() => {
    const palette = [
      { hull: "#ffffff", accent: "#1a2540", flag: "#dc0000" },
      { hull: "#f5f5f5", accent: "#0a1628", flag: "#ffec00" },
      { hull: "#ffffff", accent: "#243044", flag: "#005aff" },
      { hull: "#ebebeb", accent: "#101820", flag: "#dc0000" },
      { hull: "#ffffff", accent: "#1a2540", flag: "#22c55e" },
    ];
    const out: { pos: [number, number, number]; rot: number; scale: number; hull: string; accent: string; flag: string }[] = [];
    const pts = SEA_POLYLINE;
    // Reject any yacht placement near a building polyline point or near
    // any track sample (hairpin folds can put outward direction on the
    // building side / on top of the road).
    const buildingPts: XZ[] = BUILDING_POLYLINES.flat();
    const farFromBuildings = (px: number, pz: number) => {
      const min2 = 140 * 140;
      for (const bp of buildingPts) {
        const dx = bp.x - px;
        const dz = bp.z - pz;
        if (dx * dx + dz * dz < min2) return false;
      }
      return true;
    };
    const farFromRoad = (px: number, pz: number) => {
      const min2 = 60 * 60;
      for (const ts of TRACK_SAMPLES) {
        const dx = ts.x - px;
        const dz = ts.z - pz;
        if (dx * dx + dz * dz < min2) return false;
      }
      return true;
    };
    const stride = 6;
    let yi = 0;
    for (let i = 0; i < pts.length; i += stride) {
      const p = pts[i]!;
      const { ox, oz } = polyOutward(pts, i, centroid.x, centroid.z);
      const lanes = [85, 145, 215];
      const lane = lanes[yi % 3]!;
      const offset = lane + ((yi * 31) % 60);
      const px = p.x + ox * offset;
      const pz = p.z + oz * offset;
      if (!farFromBuildings(px, pz)) { yi++; continue; }
      if (!farFromRoad(px, pz)) { yi++; continue; }
      const angle = Math.atan2(ox, oz);
      const c = palette[yi % palette.length]!;
      out.push({
        pos: [px, -0.15, pz],
        rot: angle + Math.PI / 2 + ((yi * 0.21) % 1) * 0.4 - 0.2,
        scale: 1.0 + ((yi * 17) % 10) * 0.07,
        hull: c.hull,
        accent: c.accent,
        flag: c.flag,
      });
      yi++;
    }
    return out;
  }, [centroid]);

  // Palms along the beach — strung along the recorded sea polyline.
  const beachFlora = useMemo(() => {
    const palms: { pos: [number, number, number]; scale: number }[] = [];
    const pts = SEA_POLYLINE;
    const stride = 5;
    let pi = 0;
    for (let i = 0; i < pts.length; i += stride) {
      const p = pts[i]!;
      const { ox, oz, tx, tz } = polyOutward(pts, i, centroid.x, centroid.z);
      const radial = 22 + ((pi * 13) % 9);
      const lateral = (((pi * 17) % 7) - 3) * 0.6;
      const tlen = Math.hypot(tx, tz) || 1;
      palms.push({
        pos: [
          p.x + ox * radial + (-tx / tlen) * lateral,
          -0.25,
          p.z + oz * radial + (-tz / tlen) * lateral,
        ],
        scale: 0.9 + ((pi * 7) % 6) * 0.08,
      });
      pi++;
    }
    return { palms };
  }, [centroid]);

  // GREEN HILLS BEHIND START — start spawn is at SPAWN_T=0.78. Behind it
  // (further along outward normal) we put a wide rolling green hill base
  // with a city stepping up toward the hill ridge. This gives the player
  // a beautiful green backdrop on the start straight.
  const startBackdrop = useMemo(() => {
    // Buildings + skyscrapers march along every recorded BUILDING_POLYLINE.
    // For each polyline point we drop up to four rows of buildings stepping
    // outward (away from track centroid), plus a sparse row of glassy
    // skyscrapers further behind.
    const hills: never[] = []; // hills removed — kept for return-shape compatibility

    // Monaco-style amphitheatre — four rows of buildings stepping up away
    // from the road. Closest row is short old-town with tile roofs, then
    // increasing rows of taller flat-roofed apartment blocks (the
    // characteristic stacked Monaco silhouette).
    const colorsLight = [
      "#f4ecd8", "#ece4cd", "#f2dcc0", "#e8d6b0", "#f0e7d0",
      "#e6c98d", "#d9b984", "#efc89a", "#f2c8a8", "#e8b59a",
      "#dbb392", "#f5d6b8", "#e1a484",
    ];
    const colorsAccent = ["#c87a5e", "#b85a44", "#9a3a30"]; // occasional red/terracotta block
    const colorsRoof = ["#c66a4a", "#b35a3a", "#a84a30", "#8b3a22", "#cf7e4a"];
    const PERIMETER_TEXTURES: CanvasTexture[] = [
      ...FACADE_TEXTURES,
      ...GRAND_TEXTURES,
      ...GOLD_TEXTURES,
      ...MODERN_TERRACED_TEXTURES,
    ];
    const buildings: {
      pos: [number, number, number];
      size: [number, number, number];
      rot: number;
      color: string;
      roof: string;
      roofType: "cone" | "flat";
      tex: CanvasTexture;
    }[] = [];
    // Each row: { radial, widthMin, widthRange, heightMin, heightRange, depthMin, depthRange, coneRoofChance }
    const rows = [
      { radial: 30, wMin: 7,  wRange: 5, hMin: 12, hRange: 14, dMin: 7, dRange: 4, coneChance: 0.7 },
      { radial: 42, wMin: 10, wRange: 6, hMin: 22, hRange: 18, dMin: 9, dRange: 4, coneChance: 0.2 },
      { radial: 56, wMin: 12, wRange: 7, hMin: 35, hRange: 22, dMin: 11, dRange: 5, coneChance: 0.05 },
      { radial: 72, wMin: 14, wRange: 8, hMin: 48, hRange: 26, dMin: 13, dRange: 6, coneChance: 0.0 },
    ];
    const ROAD_CLEARANCE = 14;
    const tooCloseToRoad = (px: number, pz: number, halfFoot: number) => {
      const minDist = ROAD_CLEARANCE + halfFoot;
      const minDist2 = minDist * minDist;
      for (const ts of TRACK_SAMPLES) {
        const dx = ts.x - px;
        const dz = ts.z - pz;
        if (dx * dx + dz * dz < minDist2) return true;
      }
      return false;
    };

    // Walk every recorded building polyline. `seedBase` keeps building
    // ids unique across polylines so colour/texture cycles don't desync.
    let seedBase = 0;
    const skyscrapers: { pos: [number, number, number]; size: [number, number, number]; rot: number; tex: CanvasTexture }[] = [];
    const mountains: { pos: [number, number, number]; radius: number; height: number; color: string }[] = [];
    // Greenish-grey palette — Monaco/Côte d'Azur backdrop mountains.
    const mountainColors = ["#6f7d5b", "#7a8965", "#5e6c4d", "#85947a", "#6b7568", "#7c8b7a"];
    // Spawn (start line) world xz — buildings near here use a tighter
    // stride so the start straight reads as a denser, real-feeling city.
    const spawnPt = _elCurve.getPointAt(0.78);
    const NEAR_START_R2 = 260 * 260;
    for (const polyline of BUILDING_POLYLINES) {
      // Default stride is sparse for perf; near the start it tightens
      // so the player sees a denser city block at the grid.
      for (let i = 0; i < polyline.length; i++) {
        const p = polyline[i]!;
        const dxs = p.x - spawnPt.x;
        const dzs = p.z - spawnPt.z;
        const isNearStart = (dxs * dxs + dzs * dzs) < NEAR_START_R2;
        const stride = isNearStart ? 2 : 5;
        if (i % stride !== 0) continue;
        const { ox, oz, tx, tz } = polyOutward(polyline, i, centroid.x, centroid.z);
        const yaw = Math.atan2(tx, tz);
        const jitter = (((i * 7) % 9) - 4) * 0.6;
        // Limit to 3 rows (was 4). Back row was sparse anyway.
        const rowsToUse = Math.min(3, rows.length);
        for (let r = 0; r < rowsToUse; r++) {
          const row = rows[r]!;
          // Sparse back row except near the start, where we keep every
          // anchor for a denser city silhouette.
          if (r >= 2 && !isNearStart && (i % 4) !== 0) continue;
          const seed = seedBase + i * 31 + r * 13;
          const fx = p.x + ox * row.radial;
          const fz = p.z + oz * row.radial;
          const w = row.wMin + (seed % row.wRange);
          const d = row.dMin + ((seed * 7) % row.dRange);
          const h = row.hMin + ((seed * 11) % row.hRange);
          const px = fx + (-oz) * jitter;
          const pz = fz + ox * jitter;
          const halfFoot = Math.max(w, d) / 2;
          if (tooCloseToRoad(px, pz, halfFoot)) continue;
          const isAccent = (seed % 17) === 0;
          const color = isAccent
            ? colorsAccent[seed % colorsAccent.length]!
            : colorsLight[seed % colorsLight.length]!;
          const roofType: "cone" | "flat" =
            ((seed * 13) % 100) / 100 < row.coneChance ? "cone" : "flat";
          buildings.push({
            pos: [px, h / 2, pz],
            size: [w, h, d],
            rot: yaw,
            color,
            roof: colorsRoof[seed % colorsRoof.length]!,
            roofType,
            tex: PERIMETER_TEXTURES[seed % PERIMETER_TEXTURES.length]!,
          });
        }
      }

      // Skyscrapers — sparse glassy towers sitting deep behind the
      // building rows on this polyline.
      for (let i = 0; i < polyline.length; i += 22) {
        const p = polyline[i]!;
        const { ox, oz, tx, tz } = polyOutward(polyline, i, centroid.x, centroid.z);
        const yaw = Math.atan2(tx, tz);
        const radial = 120 + ((i * 7) % 28);
        const w = 14 + ((i * 11) % 9);
        const d = 14 + ((i * 13) % 9);
        const h = 32 + ((i * 19) % 38);
        const px = p.x + ox * radial;
        const pz = p.z + oz * radial;
        const halfFoot = Math.max(w, d) / 2;
        if (tooCloseToRoad(px, pz, halfFoot)) continue;
        skyscrapers.push({
          pos: [px, h / 2, pz],
          size: [w, h, d],
          rot: yaw,
          tex: GLASS_TOWER_TEXTURES[(seedBase + i) % GLASS_TOWER_TEXTURES.length]!,
        });
      }
      // Mountain massif — each anchor spawns a main peak plus 1–2 smaller
      // side peaks so the silhouette reads as a natural ridge rather than
      // a single pyramid. Skipped wherever the sea polyline is in the
      // outward path so mountains never end up rising out of the water.
      const seaPts: XZ[] = SEA_POLYLINE;
      const SEA_REJECT = 220;
      const isOverSea = (px: number, pz: number) => {
        for (const sp of seaPts) {
          const dx = sp.x - px;
          const dz = sp.z - pz;
          if (dx * dx + dz * dz < SEA_REJECT * SEA_REJECT) return true;
        }
        return false;
      };
      // One massif every ~24 polyline points (much sparser than before).
      // Each massif = a main peak plus 3–4 satellite peaks clustered close
      // together so the silhouette reads as one big chunky range, not a
      // line of small cones.
      for (let i = 0; i < polyline.length; i += 50) {
        const p = polyline[i]!;
        const { ox, oz } = polyOutward(polyline, i, centroid.x, centroid.z);
        const seed = seedBase + i * 17;
        const radial = 260 + ((seed * 13) % 130);
        const lateral = (((seed * 23) % 100) - 50);
        const height = 150 + ((seed * 31) % 180);
        const radius = 95 + ((seed * 41) % 80);
        const cx = p.x + ox * radial + (-oz) * lateral;
        const cz = p.z + oz * radial + ox * lateral;
        if (tooCloseToRoad(cx, cz, radius)) continue;
        if (isOverSea(cx, cz)) continue;
        const color = mountainColors[seed % mountainColors.length]!;
        mountains.push({ pos: [cx, height / 2 - 1.2, cz], radius, height, color });
        const sideCount = 3 + (seed % 2); // 3 or 4 satellites
        for (let s = 0; s < sideCount; s++) {
          const a = (s / sideCount) * Math.PI * 2 + (seed * 0.011);
          const off = radius * (0.5 + ((seed * (s + 7)) % 25) / 100);
          const sx = cx + Math.cos(a) * off;
          const sz = cz + Math.sin(a) * off;
          if (tooCloseToRoad(sx, sz, radius * 0.55)) continue;
          if (isOverSea(sx, sz)) continue;
          const sh = height * (0.55 + ((seed * (s + 3)) % 35) / 100);
          const sr = radius * (0.55 + ((seed * (s + 5)) % 30) / 100);
          mountains.push({
            pos: [sx, sh / 2 - 1.2, sz],
            radius: sr,
            height: sh,
            color: mountainColors[(seed + s + 2) % mountainColors.length]!,
          });
        }
      }
      seedBase += polyline.length * 100;
    }

    return { hills, buildings, skyscrapers, mountains };
  }, [centroid]);

  // PADDOCK FOLLOWING THE TRACK — walk every Nth spline sample and place
  // a parked car offset INWARD toward the loop centroid. The row of cars
  // (and garages further inward, grandstands deeper still) curves with
  // the racing line.
  const paddock = useMemo(() => {
    const trackPoly = TRACK_POINTS as { x: number; z: number }[];
    const bolideColors = [
      "#dc0000", "#1f3fff", "#ffec00", "#ff7a00", "#22c55e",
      "#9b30ff", "#00b4d8", "#ff3a8c", "#ffffff", "#0a0a0a",
    ];
    const garageColors = ["#dc0000", "#1f3fff", "#ffec00", "#222", "#ffffff"];
    const bolides: { pos: [number, number, number]; rot: number; color: string; accent: string }[] = [];
    const garages: { pos: [number, number, number]; rot: number; w: number; d: number; h: number; color: string }[] = [];
    const stands: { pos: [number, number, number]; rot: number; length: number }[] = [];

    const ROAD_CLEARANCE = 16;
    const tooClose = (x: number, z: number) => {
      const min2 = ROAD_CLEARANCE * ROAD_CLEARANCE;
      for (const ts of TRACK_SAMPLES) {
        const dx = ts.x - x;
        const dz = ts.z - z;
        if (dx * dx + dz * dz < min2) return true;
      }
      return false;
    };

    const inwardAt = (i: number) => {
      const s = TRACK_SAMPLES[i]!;
      const next = TRACK_SAMPLES[(i + 4) % TRACK_SAMPLES.length]!;
      const tx = next.x - s.x;
      const tz = next.z - s.z;
      let nx = -tz;
      let nz = tx;
      // Flip toward centroid (inward).
      if (nx * (s.x - centroid.x) + nz * (s.z - centroid.z) > 0) {
        nx = -nx; nz = -nz;
      }
      const len = Math.hypot(nx, nz) || 1;
      return { ix: nx / len, iz: nz / len, tx, tz, x: s.x, z: s.z };
    };

    const N = TRACK_SAMPLES.length;
    const CAR_RADIAL = 18;
    const GARAGE_RADIAL = 30;
    const STAND_RADIAL = 60;
    // Strides chosen to keep startup fast — each parked car is a full GLB
    // clone with its own material set, so 50× hurts. Aim for ~12 cars.
    const CAR_STRIDE = 24;
    const GARAGE_STRIDE = 16;
    const STAND_STRIDE = 60;

    for (let i = 0; i < N; i += CAR_STRIDE) {
      const o = inwardAt(i);
      const px = o.x + o.ix * CAR_RADIAL;
      const pz = o.z + o.iz * CAR_RADIAL;
      if (!pointInPolyXZ(px, pz, trackPoly)) continue;
      if (tooClose(px, pz)) continue;
      const tangentYaw = Math.atan2(o.tx, o.tz);
      const c = bolideColors[i % bolideColors.length]!;
      bolides.push({ pos: [px, 0, pz], rot: tangentYaw, color: c, accent: "#0a0a0a" });
    }

    for (let i = 0; i < N; i += GARAGE_STRIDE) {
      const o = inwardAt(i);
      const gx = o.x + o.ix * GARAGE_RADIAL;
      const gz = o.z + o.iz * GARAGE_RADIAL;
      if (!pointInPolyXZ(gx, gz, trackPoly)) continue;
      if (tooClose(gx, gz)) continue;
      const tangentYaw = Math.atan2(o.tx, o.tz);
      garages.push({
        pos: [gx, 0, gz],
        rot: tangentYaw,
        w: 7.2,
        d: 5.6,
        h: 4.2,
        color: garageColors[i % garageColors.length]!,
      });
    }

    for (let i = 0; i < N; i += STAND_STRIDE) {
      const o = inwardAt(i);
      // Walk inward in steps until the candidate is well inside the loop
      // and clear of any other road segment (hairpin folds).
      let r = STAND_RADIAL;
      let sx = o.x + o.ix * r;
      let sz = o.z + o.iz * r;
      let attempts = 0;
      while (
        attempts < 6 &&
        (!pointInPolyXZ(sx, sz, trackPoly) || tooClose(sx, sz))
      ) {
        r -= 8;
        sx = o.x + o.ix * r;
        sz = o.z + o.iz * r;
        attempts++;
      }
      if (!pointInPolyXZ(sx, sz, trackPoly) || tooClose(sx, sz)) continue;
      // Verify both endpoints of the grandstand footprint are inside the
      // loop AND clear of the road, so the box doesn't poke onto the track.
      const tangentYaw = Math.atan2(o.tx, o.tz);
      const length = 30;
      const halfL = length / 2;
      const cx = Math.cos(tangentYaw);
      const cz = Math.sin(tangentYaw);
      const ex1 = sx + cx * halfL;
      const ez1 = sz + cz * halfL;
      const ex2 = sx - cx * halfL;
      const ez2 = sz - cz * halfL;
      if (!pointInPolyXZ(ex1, ez1, trackPoly) || tooClose(ex1, ez1)) continue;
      if (!pointInPolyXZ(ex2, ez2, trackPoly) || tooClose(ex2, ez2)) continue;
      stands.push({
        pos: [sx, 0, sz],
        rot: tangentYaw - Math.PI / 2,
        length,
      });
    }

    return { bolides, stands, garages };
  }, [centroid]);

  return (
    <>
      <color attach="background" args={["#bcd9ec"]} />
      <fog attach="fog" args={["#bcd9ec", 1500, 9000]} />

      {/* Lighting */}
      <directionalLight position={SUN_POS} intensity={2.2} color="#fff5d0" />
      <ambientLight intensity={0.55} />

      {/* Clouds — sprinkled high above the whole map */}
      {CLOUD_POSITIONS.map((c, i) => (
        <Cloud key={`cloud-${i}`} position={c.pos} scale={c.scale} />
      ))}

      {/* Ground — covers the whole map. Pushed well below the sea/beach
          layers so the depth buffer can cleanly separate them at distance
          (otherwise the sea flickers / z-fights with the ground). */}
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1.5, 0]}>
        <planeGeometry args={[5000, 5000]} />
        <meshStandardMaterial color="#7c8a5e" roughness={0.95} />
      </mesh>

      {/* Local beach segment + sea — only just before the tunnel */}
      <mesh geometry={beachLocal.beachGeom}>
        <meshStandardMaterial color="#e3c79a" roughness={0.95} side={DoubleSide} />
      </mesh>
      <mesh geometry={beachLocal.seaGeom}>
        <meshStandardMaterial color="#1f6c8a" roughness={0.4} metalness={0.06} side={DoubleSide} />
      </mesh>

      {/* Yachts in the local sea */}
      {yachts.map((y, i) => (
        <Yacht
          key={`yacht-${i}`}
          position={y.pos}
          rotation={y.rot}
          scale={y.scale}
          hull={y.hull}
          accent={y.accent}
          flag={y.flag}
        />
      ))}

      {/* Palms lining the beach */}
      {beachFlora.palms.map((p, i) => (
        <PalmTree key={`palm-${i}`} position={p.pos} scale={p.scale} />
      ))}


      {/* Town stepping up toward the hills, behind the start */}
      {startBackdrop.buildings.map((b, i) => {
        const [w, h, d] = b.size;
        return (
          <group key={`bld-${i}`} position={b.pos} rotation={[0, b.rot, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial map={b.tex} color={b.color} roughness={0.85} />
            </mesh>
            {b.roofType === "cone" ? (
              <mesh position={[0, h / 2 + 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[(Math.max(w, d) / 2) * 0.95, 1.1, 4]} />
                <meshStandardMaterial color={b.roof} roughness={0.8} />
              </mesh>
            ) : (
              <mesh position={[0, h / 2 + 0.18, 0]} castShadow>
                <boxGeometry args={[w + 0.4, 0.36, d + 0.4]} />
                <meshStandardMaterial color="#5a5048" roughness={0.85} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Paddock inside the loop — parked GLB cars + pit garages + grandstands */}
      {paddock.bolides.map((b, i) => (
        <group key={`bolide-${i}`} position={b.pos} rotation={[0, b.rot, 0]}>
          <CarModel bodyColor={b.color} staticDecor />
        </group>
      ))}
      {paddock.garages.map((g, i) => (
        <group key={`garage-${i}`} position={g.pos} rotation={[0, g.rot, 0]}>
          {/* Garage box */}
          <mesh position={[0, g.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[g.w, g.h, g.d]} />
            <meshStandardMaterial color="#dadada" roughness={0.85} />
          </mesh>
          {/* Coloured roller-door front face */}
          <mesh position={[0, g.h * 0.45, g.d / 2 + 0.02]} castShadow>
            <boxGeometry args={[g.w * 0.86, g.h * 0.78, 0.06]} />
            <meshStandardMaterial color={g.color} roughness={0.5} metalness={0.2} />
          </mesh>
          {/* Roof trim */}
          <mesh position={[0, g.h + 0.18, 0]} castShadow>
            <boxGeometry args={[g.w + 0.4, 0.36, g.d + 0.4]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {paddock.stands.map((s, i) => (
        <Grandstand key={`stand-${i}`} position={s.pos} rotation={s.rot} length={s.length} />
      ))}

      {/* Mountain backdrop — greenish-grey peaks rising behind the city
          on the building side only (no mountains on the harbour side). */}
      {startBackdrop.mountains.map((m, i) => {
        // Mountain = wide frustum body + rounded low-poly dome on top.
        // Avoids the sharp pyramid peak the cone produced.
        const bodyH = m.height * 0.78;
        const capR = m.radius * 0.36;
        return (
          <group key={`mountain-${i}`} position={m.pos}>
            <mesh position={[0, -m.height * 0.11, 0]}>
              <cylinderGeometry args={[capR, m.radius, bodyH, 12, 1]} />
              <meshStandardMaterial color={m.color} roughness={1} flatShading />
            </mesh>
            <mesh position={[0, bodyH / 2 - m.height * 0.11, 0]}>
              <sphereGeometry args={[capR, 10, 6]} />
              <meshStandardMaterial color={m.color} roughness={1} flatShading />
            </mesh>
          </group>
        );
      })}

      {/* Skyscrapers up on the hills — sparse, glassy amber-window towers */}
      {startBackdrop.skyscrapers.map((t, i) => (
        <group key={`tower-${i}`} position={t.pos} rotation={[0, t.rot, 0]}>
          <mesh>
            <boxGeometry args={t.size} />
            <meshStandardMaterial
              map={t.tex}
              emissiveMap={t.tex}
              emissive="#7a4d18"
              emissiveIntensity={0.25}
              roughness={0.35}
              metalness={0.45}
            />
          </mesh>
          {/* Flat roof slab */}
          <mesh position={[0, t.size[1] / 2 + 0.2, 0]}>
            <boxGeometry args={[t.size[0] + 0.6, 0.4, t.size[2] + 0.6]} />
            <meshStandardMaterial color="#3a3530" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Tunnel — covers a stretch of the spline so cars dive under a roof */}
      {(() => {
        const tunnelStart = 0.32;
        const tunnelEnd = 0.40;
        const tunnelSegs = 24;
        const out: React.ReactNode[] = [];
        for (let i = 0; i < tunnelSegs; i++) {
          const t = tunnelStart + (i / tunnelSegs) * (tunnelEnd - tunnelStart);
          const tNext = tunnelStart + ((i + 1) / tunnelSegs) * (tunnelEnd - tunnelStart);
          const p = _elCurve.getPointAt(t);
          const pNext = _elCurve.getPointAt(tNext);
          const tan = _elCurve.getTangentAt(t);
          const angle = Math.atan2(tan.x, tan.z);
          const segLen = Math.hypot(pNext.x - p.x, pNext.z - p.z) + 0.5;
          out.push(
            <group key={`tun-${i}`} position={[p.x, 0, p.z]} rotation={[0, angle, 0]}>
              <mesh position={[0, 7, 0]} castShadow>
                <boxGeometry args={[TRACK_WIDTH + 6, 1.2, segLen]} />
                <meshStandardMaterial color="#c8b896" roughness={0.85} />
              </mesh>
              <mesh position={[-(TRACK_WIDTH + 6) / 2 + 1, 3.4, 0]} castShadow>
                <boxGeometry args={[2, 7, segLen]} />
                <meshStandardMaterial color="#9a8870" roughness={0.9} />
              </mesh>
              <mesh position={[(TRACK_WIDTH + 6) / 2 - 1, 3.4, 0]} castShadow>
                <boxGeometry args={[2, 7, segLen]} />
                <meshStandardMaterial color="#9a8870" roughness={0.9} />
              </mesh>
            </group>,
          );
        }
        return <>{out}</>;
      })()}
    </>
  );
}
