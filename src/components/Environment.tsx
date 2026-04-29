import { useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, CanvasTexture, NearestFilter, RepeatWrapping, BackSide, DoubleSide, SphereGeometry, Color } from "three";
import { TRACK_POINTS, TRACK_WIDTH } from "../lib/track-data";

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

// Pre-generate all texture types
const FACADE_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < BLDG_COLORS.length; i++) {
  FACADE_TEXTURES.push(
    createFacadeTexture(BLDG_COLORS[i]!, 4 + (i % 4), SHUTTER_COLORS[i % SHUTTER_COLORS.length]!)
  );
}
const GRAND_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 5; i++) {
  GRAND_TEXTURES.push(createGrandTexture(4 + i));
}
const TOWER_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 6; i++) {
  TOWER_TEXTURES.push(createTowerTexture(8 + i * 2, i));
}
const GOLD_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 4; i++) {
  GOLD_TEXTURES.push(createGoldTexture(4 + i));
}
const MODERN_TERRACED_TEXTURES: CanvasTexture[] = [];
for (let i = 0; i < 3; i++) {
  MODERN_TERRACED_TEXTURES.push(createModernTerracedTexture(10 + i * 3));
}

interface Bldg {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  type: "block" | "tower";
  floors: number;
  mansard: boolean;
}

function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// Track samples for elevation lookup — computed once from spline
const _elCurve = new CatmullRomCurve3(TRACK_POINTS, true, "catmullrom", 0.5);
const TRACK_SAMPLES: { x: number; y: number; z: number }[] = [];
for (let i = 0; i < 800; i++) {
  const pt = _elCurve.getPointAt(i / 800);
  TRACK_SAMPLES.push({ x: pt.x, y: pt.y, z: pt.z });
}

function getTrackElevation(x: number, z: number): number {
  let best = 9999, y = 0;
  for (const s of TRACK_SAMPLES) {
    const d = (x - s.x) ** 2 + (z - s.z) ** 2;
    if (d < best) { best = d; y = s.y; }
  }
  return y;
}

function generateCity(): Bldg[] {
  const rng = seededRng(123);
  const buildings: Bldg[] = [];
  const G = -0.5;

  // Track points [x, y, z] for street row + collision
  const rawPts: [number, number, number][] = [
    [-22.5,0,45],[-22.5,0,15],[-22.5,0,-15],[-22.5,0,-45],
    [-18,0.5,-72],[-7.5,1,-87],[15,1.5,-97.5],
    [45,3,-105],[75,5,-112.5],[105,7,-120],
    [135,9,-123],[157.5,10,-117],[168,10,-102],[165,10,-82.5],[150,10,-72],
    [142.5,9,-57],[139.5,8,-37.5],[139.5,7,-18],
    [142.5,6,7.5],[144,5,33],[142.5,4,57],[138,3,78],
    [127.5,2,93],[108,1.5,102],[87,1,99],
    [66,0.5,90],[48,0.3,93],[33,0.2,87],
    [18,0.1,78],[7.5,0,72],[0,0,66],[-7.5,0,63],
    [-15,0,60],[-21,0,54],
  ];

  // Interpolated XZ for collision check
  const trackPts: [number, number][] = [];
  for (let i = 0; i < rawPts.length; i++) {
    const a = rawPts[i]!;
    const b = rawPts[(i + 1) % rawPts.length]!;
    for (let t = 0; t < 4; t++) {
      const f = t / 4;
      trackPts.push([a[0] + (b[0] - a[0]) * f, a[2] + (b[2] - a[2]) * f]);
    }
  }

  function tooClose(x: number, z: number, halfW: number): boolean {
    const minDist = 16 + halfW;
    const minDistSq = minDist * minDist;
    for (const [tx, tz] of trackPts) {
      const dx = x - tx, dz = z - tz;
      if (dx * dx + dz * dz < minDistSq) return true;
    }
    return false;
  }

  // Place a hillside block — extends from ground to roof
  function addHillBlock(x: number, z: number, baseY: number, visH: number) {
    const w = 10 + rng() * 6;
    const d = 8 + rng() * 4;
    if (tooClose(x, z, Math.max(w, d) / 2)) return;
    const roofY = baseY + visH;
    const totalH = Math.max(2, roofY - G);
    buildings.push({
      pos: [x, G + totalH / 2, z],
      size: [w, totalH, d],
      color: BLDG_COLORS[Math.floor(rng() * BLDG_COLORS.length)]!,
      type: "block",
      floors: Math.max(1, Math.floor(visH / 3)),
      mansard: rng() < 0.4,
    });
  }

  // Place a hillside tower
  function addHillTower(x: number, z: number, baseY: number, visH: number) {
    const w = 12 + rng() * 8;
    const d = 12 + rng() * 8;
    if (tooClose(x, z, Math.max(w, d) / 2)) return;
    const roofY = baseY + visH;
    const totalH = Math.max(5, roofY - G);
    buildings.push({
      pos: [x, G + totalH / 2, z],
      size: [w, totalH, d],
      color: rng() > 0.5 ? "#c0c0c0" : "#d0d0d8",
      type: "tower",
      floors: Math.max(3, Math.floor(visH / 3)),
      mansard: false,
    });
  }

  // ================================================
  // RING 1: Street row — along track, elevation-aware
  // ================================================
  for (let i = 0; i < rawPts.length; i++) {
    const a = rawPts[i]!;
    const b = rawPts[(i + 1) % rawPts.length]!;
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1) continue;
    const nx = -dz / len, nz = dx / len;
    const steps = Math.max(1, Math.floor(len / 12));

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const px = a[0] + dx * t;
      const pz = a[2] + dz * t;
      const trackY = a[1] + dy * t;

      for (const side of [1, -1]) {
        const bx = px + nx * 16 * side;
        const bz = pz + nz * 16 * side;
        if (bx < -25) continue;
        if (tooClose(bx, bz, 8)) continue;

        // Sea-facing cascade: base lower on downhill side
        let baseY: number;
        if (side === -1 && trackY > 2) {
          baseY = trackY * 0.3;
        } else {
          baseY = trackY - 1;
        }
        addHillBlock(bx, bz, baseY, 6 + rng() * 7);
      }
    }
  }

  // ================================================
  // RING 2: Second row — behind street, peeks above
  // ================================================
  for (let i = 0; i < rawPts.length; i++) {
    const a = rawPts[i]!;
    const b = rawPts[(i + 1) % rawPts.length]!;
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1) continue;
    const nx = -dz / len, nz = dx / len;
    const steps = Math.max(1, Math.floor(len / 18));

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const px = a[0] + dx * t;
      const pz = a[2] + dz * t;
      const trackY = a[1] + dy * t;

      for (const side of [1, -1]) {
        const bx = px + nx * 34 * side;
        const bz = pz + nz * 34 * side;
        if (bx < -25) continue;

        const baseY = trackY + 3 + rng() * 4;
        addHillBlock(bx, bz, baseY, 8 + rng() * 10);
      }
    }
  }

  // ================================================
  // RING 3: City fills — elevation-aware
  // ================================================
  function fillHill(x0: number, x1: number, z0: number, z1: number,
    step: number, extraBase: number, minVis: number, maxVis: number) {
    for (let gx = x0; gx <= x1; gx += step) {
      for (let gz = z0; gz <= z1; gz += step) {
        const bx = gx + rng() * 3;
        const bz = gz + rng() * 3;
        if (bx < -25) continue;
        const trackY = getTrackElevation(bx, bz);
        addHillBlock(bx, bz, trackY + extraBase, minVis + rng() * (maxVis - minVis));
      }
    }
  }

  // Inside loop
  fillHill(5, 115, -35, 60, 16, 2, 8, 16);
  // Behind Beau Rivage
  fillHill(-10, 100, -130, -100, 16, 4, 10, 18);
  // Behind Casino
  fillHill(110, 180, -160, -100, 16, 5, 10, 20);
  // East of tunnel
  fillHill(155, 200, -50, 70, 16, 4, 10, 16);
  // South
  fillHill(-10, 125, 95, 150, 16, 1, 6, 14);
  // Southeast
  fillHill(125, 160, 85, 150, 16, 2, 8, 14);
  // Northwest
  fillHill(-45, 0, -100, -55, 16, 1, 8, 14);

  // ================================================
  // RING 4: Background towers — skyline
  // ================================================
  function fillSkyline(x0: number, x1: number, z0: number, z1: number, step: number) {
    for (let gx = x0; gx <= x1; gx += step) {
      for (let gz = z0; gz <= z1; gz += step) {
        const bx = gx + rng() * 3;
        const bz = gz + rng() * 3;
        const trackY = getTrackElevation(bx, bz);
        addHillTower(bx, bz, trackY + 8 + rng() * 8, 30 + rng() * 35);
      }
    }
  }

  fillSkyline(-30, 250, -220, -170, 24);
  fillSkyline(200, 280, -90, 70, 26);
  fillSkyline(-20, 140, 155, 200, 26);
  fillSkyline(60, 130, -80, -45, 40);
  fillSkyline(175, 210, -130, -80, 30);

  return buildings;
}

const CITY = generateCity();

/** Generate support wall geometry under elevated track sections */
function buildSupportGeometry() {
  const curve = new CatmullRomCurve3(TRACK_POINTS, true, "catmullrom", 0.5);
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

/** Beach strip with wavy right edge (grass side) */
function buildBeachGeometry() {
  const segments = 80;
  const zStart = -320, zEnd = 280; // match sea length
  const xLeft = -105; // overlaps sea
  const xRight = -55; // base right edge — wider beach

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = zStart + t * (zEnd - zStart);
    const wobble = Math.sin(t * Math.PI * 6) * 4 + Math.sin(t * Math.PI * 11) * 2 + Math.cos(t * Math.PI * 3.7) * 3;

    // Left edge — straight (hidden under sea)
    positions.push(xLeft, -0.48, z);
    // Right edge — wavy (visible against grass)
    positions.push(xRight + wobble, -0.48, z);

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
  const puffs: [number, number, number, number][] = [
    [0,     0,     0,    1.0],
    [0.95, -0.1,   0.05, 0.75],
    [-0.9,  0.05,  0.1,  0.8],
    [0.25,  0.35,  0.4,  0.6],
    [-0.35, 0.3,  -0.35, 0.65],
    [0.55, -0.2,  -0.3,  0.55],
    [-0.55,-0.25,  0.3,  0.5],
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

// Palm tree positions — along the coast between beach and track
const PALM_POSITIONS: [number, number, number][] = [
  [-38, 0, -90], [-42, 0, -70], [-40, 0, -50], [-39, 0, -30], [-42, 0, -10],
  [-40, 0, 10], [-38, 0, 30], [-42, 0, 50], [-40, 0, 70], [-38, 0, 90],
  [-45, 0, 110], [-50, 0, 130], [-30, 0, 70], [-32, 0, 50], [-34, 0, 100],
];

// Yacht positions — scattered in sea near harbour
const YACHT_POSITIONS: { pos: [number, number, number]; rot: number; scale: number; hull: string; accent: string; flag: string }[] = [
  { pos: [-80,  -0.15, -40], rot: 0.3,  scale: 1.0,  hull: "#ffffff", accent: "#1a2540", flag: "#dc0000" },
  { pos: [-95,  -0.15, -10], rot: -0.2, scale: 1.3,  hull: "#f5f5f5", accent: "#0a1628", flag: "#ffec00" },
  { pos: [-72,  -0.15, 20],  rot: 0.5,  scale: 0.9,  hull: "#ffffff", accent: "#243044", flag: "#005aff" },
  { pos: [-110, -0.15, 40],  rot: -0.4, scale: 1.5,  hull: "#ebebeb", accent: "#101820", flag: "#dc0000" },
  { pos: [-85,  -0.15, 80],  rot: 0.2,  scale: 1.1,  hull: "#ffffff", accent: "#1a2540", flag: "#22c55e" },
  { pos: [-100, -0.15, 120], rot: 0.8,  scale: 1.2,  hull: "#f8f8f8", accent: "#0a1628", flag: "#dc0000" },
  { pos: [-130, -0.15, -60], rot: -0.3, scale: 1.4,  hull: "#ffffff", accent: "#243044", flag: "#ffec00" },
  { pos: [-75,  -0.15, -75], rot: 0.6,  scale: 0.85, hull: "#f0f0f0", accent: "#1a2540", flag: "#005aff" },
];

// Cloud positions — scattered, high up, out of the track's way
const CLOUD_POSITIONS: { pos: [number, number, number]; scale: number }[] = [
  { pos: [-180, 140, -160], scale: 18 },
  { pos: [ 160, 150, -220], scale: 15 },
  { pos: [ 350, 145,  140], scale: 20 },
  { pos: [-140, 160,  200], scale: 22 },
  { pos: [ 240, 148, -120], scale: 16 },
  { pos: [ 400, 135,  180], scale: 17 },
  { pos: [-250, 155, -230], scale: 19 },
  { pos: [ 200, 140,  250], scale: 18 },
  { pos: [-220, 160,  160], scale: 16 },
  { pos: [ 350, 150, -180], scale: 14 },
];

export default function Environment() {
  const beachGeom = useMemo(() => buildBeachGeometry(), []);
  const supportGeom = useMemo(() => buildSupportGeometry(), []);

  return (
    <>
      {/* Procedural sky dome — gradient via vertex colors */}
      <mesh geometry={SKY_DOME_GEOM} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={BackSide} depthWrite={false} fog={false} />
      </mesh>

      {/* Sun disc */}
      <mesh position={SUN_POS}>
        <sphereGeometry args={[10, 32, 32]} />
        <meshBasicMaterial color="#ffee00" depthWrite={false} />
      </mesh>

      {/* Lighting */}
      <directionalLight position={SUN_POS} intensity={2.5} castShadow color="#fff5d0" />
      <ambientLight intensity={0.4} />

      {/* Procedural clouds */}
      {CLOUD_POSITIONS.map((c, i) => (
        <Cloud key={i} position={c.pos} scale={c.scale} />
      ))}

      {/* Ground — urban/concrete like Monaco */}
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.5, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#707060" />
      </mesh>

      {/* Beach — wavy edge against grass */}
      <mesh geometry={beachGeom}>
        <meshStandardMaterial color="#d4b483" />
      </mesh>

      {/* Sea — starts after beach, extends to horizon */}
      <mesh rotation-x={-Math.PI / 2} position={[-350, -0.3, -20]}>
        <planeGeometry args={[500, 600]} />
        <meshStandardMaterial color="#1a6b8a" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-300, -0.3, 100]}>
        <planeGeometry args={[400, 300]} />
        <meshStandardMaterial color="#1a6b8a" />
      </mesh>

      {/* Palm trees along the coast */}
      {PALM_POSITIONS.map((p, i) => (
        <PalmTree key={`palm-${i}`} position={p} scale={0.9 + (i % 3) * 0.15} />
      ))}

      {/* Yachts in the harbour */}
      {YACHT_POSITIONS.map((y, i) => (
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

      {/* Grandstands along start/finish straight */}
      <Grandstand position={[-5, 0, -10]} rotation={-Math.PI / 2} length={28} />
      <Grandstand position={[-5, 0, 30]} rotation={-Math.PI / 2} length={28} />

      {/* Colourful sponsor banners along the guardrails near start/finish */}
      {Array.from({ length: 8 }).map((_, i) => {
        const colors = [
          ["#e23030", "#ffffff"],
          ["#f0c040", "#000000"],
          ["#3050e0", "#ffffff"],
          ["#20a050", "#ffffff"],
          ["#ff7020", "#000000"],
          ["#e0e0e0", "#e23030"],
        ];
        const [c, a] = colors[i % colors.length]!;
        return (
          <Banner
            key={`banner-a-${i}`}
            position={[-13.5, 1.8, -30 + i * 9]}
            rotation={Math.PI / 2}
            width={7}
            color={c!}
            accent={a!}
          />
        );
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const colors = [
          ["#3050e0", "#ffffff"],
          ["#e23030", "#ffffff"],
          ["#20a050", "#f0c040"],
          ["#f0c040", "#e23030"],
          ["#9040c0", "#ffffff"],
          ["#ff7020", "#ffffff"],
        ];
        const [c, a] = colors[i % colors.length]!;
        return (
          <Banner
            key={`banner-b-${i}`}
            position={[-31.5, 1.8, -30 + i * 9]}
            rotation={-Math.PI / 2}
            width={7}
            color={c!}
            accent={a!}
          />
        );
      })}

      {/* Monaco city */}
      {CITY.map((b, i) => {
        const classicTex = [...FACADE_TEXTURES, ...GOLD_TEXTURES, ...GRAND_TEXTURES];
        const tex = b.type === "tower"
          ? (i % 2 === 0 ? MODERN_TERRACED_TEXTURES[i % MODERN_TERRACED_TEXTURES.length] : TOWER_TEXTURES[i % TOWER_TEXTURES.length])
          : classicTex[i % classicTex.length];
        const [w, h, d] = b.size;
        return b.mansard ? (
          <group key={i} position={b.pos}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial map={tex} />
            </mesh>
            <mesh position={[0, h / 2 + 0.25, 0]}>
              <boxGeometry args={[w + 0.4, 0.5, d + 0.4]} />
              <meshStandardMaterial color="#c8bea8" />
            </mesh>
            <mesh position={[0, h / 2 + 0.9, 0]} castShadow>
              <boxGeometry args={[w * 0.7, 0.8, d * 0.7]} />
              <meshStandardMaterial color="#4a5a6a" />
            </mesh>
          </group>
        ) : (
          <mesh key={i} position={b.pos} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial map={tex} />
          </mesh>
        );
      })}

      {/* Tunnel — along start/finish straight near beach (z=-30 to z=40) */}
      <group>
        <mesh position={[-22.5, 8, 5]} castShadow receiveShadow>
          <boxGeometry args={[20, 1.5, 72]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        <mesh position={[-33.5, 4, 5]}>
          <boxGeometry args={[2, 9, 72]} />
          <meshStandardMaterial color="#666666" />
        </mesh>
        <mesh position={[-11.5, 4, 5]}>
          <boxGeometry args={[2, 9, 72]} />
          <meshStandardMaterial color="#666666" />
        </mesh>
        <mesh position={[-22.5, 13, 5]} castShadow>
          <boxGeometry args={[24, 8, 72]} />
          <meshStandardMaterial color="#d4c4a8" />
        </mesh>
      </group>

      {/* Track support — stone under elevated road, generated from spline */}
      <mesh geometry={supportGeom}>
        <meshStandardMaterial color="#606060" roughness={0.95} flatShading />
      </mesh>

      {/* Fog — white tint so clouds stay white */}
      <fog attach="fog" args={["#f0f4f8", 200, 600]} />
    </>
  );
}
