import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  Color,
  Mesh,
  MeshPhysicalMaterial as WebGLMeshPhysicalMaterial,
  MeshStandardMaterial,
  Group,
  CanvasTexture,
  SRGBColorSpace,
  LatheGeometry,
  Vector2,
  type Object3D,
  type Texture,
} from "three";
import { MeshPhysicalNodeMaterial } from "three/webgpu";

// WebGPU is the default renderer (set in App.tsx); the matching node-based
// material is required so colour + lighting actually drive uniforms instead
// of being pinned at the default zero values. ?webgl=1 forces WebGL fallback,
// in which case the classic material is still correct.
const IS_WEBGL_FORCED =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("webgl") === "1";
const MeshPhysicalMaterial = (IS_WEBGL_FORCED ? WebGLMeshPhysicalMaterial : MeshPhysicalNodeMaterial) as typeof WebGLMeshPhysicalMaterial;
type MeshPhysicalMaterial = WebGLMeshPhysicalMaterial;
import { useTuningStore, PART_KEYS, type PartKey } from "../lib/tuning-store";

const CREASE_ANGLE = (50 * Math.PI) / 180;
const FERRARI_YELLOW = "#FFEC00";

interface VehicleInputLike {
  left: boolean;
  right: boolean;
  handbrake?: boolean;
}

interface CarModelProps {
  bodyColor?: string;
  accentColor?: string;
  brakeIntensity?: number;
  headlights?: boolean;
  inputRef?: RefObject<VehicleInputLike>;
  speedRef?: RefObject<number>;
  brakeRef?: RefObject<number>;
  driftRef?: RefObject<number>;
  // For bots: numeric steer signal -1..+1 (overrides inputRef-derived steering when set).
  steerSignalRef?: RefObject<number>;
  // Static decoration (parked cars in paddock). Skips the per-frame
  // material/wheel/body-roll updates so dozens of these don't cost any
  // CPU after the first paint.
  staticDecor?: boolean;
}

const CAR_URL = "/models/car.glb";

const WHEEL_NAMES = {
  fl: "front-lef-wheel",
  fr: "right-front-wheel",
  rl: "rear-left-wheel",
  rr: "right-rear-wheel",
} as const;

type WheelKey = keyof typeof WHEEL_NAMES;

function makeMgpShieldTexture(text: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = FERRARI_YELLOW;
  ctx.beginPath();
  ctx.moveTo(40, 28);
  ctx.lineTo(216, 28);
  ctx.lineTo(216, 160);
  ctx.quadraticCurveTo(128, 240, 40, 160);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#009246";
  ctx.fillRect(40, 28, 176, 16);
  ctx.fillStyle = "#ce2b37";
  ctx.fillRect(40, 12, 176, 16);
  ctx.fillStyle = "#000";
  const fontSize = text.length <= 3 ? 84 : text.length <= 5 ? 64 : 48;
  ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 130);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeLicensePlateTexture(text: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = FERRARI_YELLOW;
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 152);
  ctx.fillStyle = "#cd0a17";
  ctx.fillRect(20, 32, 56, 96);
  ctx.fillStyle = "#fff";
  ctx.fillRect(48, 32, 28, 96);
  ctx.fillStyle = "#000";
  ctx.font = "bold 28px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MC", 48, 80);
  ctx.fillStyle = "#000";
  const plateFont = text.length <= 6 ? 96 : text.length <= 8 ? 78 : 64;
  ctx.font = `bold ${plateFont}px 'Courier New', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 110, 84);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeNumberTexture(n: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(128, 128, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = "#000";
  const numFont = n.length <= 2 ? 160 : n.length <= 3 ? 110 : 80;
  ctx.font = `bold ${numFont}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(n, 128, 134);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Map GLB node name → tuning store part key
const NODE_TO_PART: Record<string, PartKey> = {
  "main-body-car": "main-body-car",
  "enteirer": "enteirer",
  "driver-wheel": "driver-wheel",
  "front-lights": "front-lights",
  "back-lights": "back-lights",
  "back-space-btw-lights": "back-space-btw-lights",
  "back-table": "back-table",
  "central-mirror": "central-mirror",
  "left-mirror": "left-mirror",
  "right-mirror": "right-mirror",
  "front-diffusor": "front-diffusor",
  "right-door-diffusor": "right-door-diffusor",
  "front-lef-wheel": "tires",
  "right-front-wheel": "tires",
  "rear-left-wheel": "tires",
  "right-rear-wheel": "tires",
};

export default function CarModel({ inputRef, speedRef, brakeRef, driftRef, bodyColor, steerSignalRef, staticDecor = false }: CarModelProps) {
  const carGltf = useLoader(GLTFLoader, CAR_URL);

  // One MeshPhysicalMaterial per part key. Live-updated from tuning store.
  const materialsRef = useRef<Record<PartKey, MeshPhysicalMaterial> | null>(null);

  const { bodyScene, wheelMeshes, wheelPositions } = useMemo(() => {
    const scene = carGltf.scene.clone(true);

    const meshes: Partial<Record<WheelKey, Object3D>> = {};
    const positions: Partial<Record<WheelKey, [number, number, number]>> = {};

    (Object.entries(WHEEL_NAMES) as [WheelKey, string][]).forEach(([key, name]) => {
      const w = scene.getObjectByName(name) as Mesh | undefined;
      if (!w || !(w instanceof Mesh)) {
        console.warn(`[CarModel] wheel node '${name}' not found in GLB`);
        return;
      }
      positions[key] = [w.position.x, w.position.y, w.position.z];
      w.position.set(0, 0, 0);
      w.parent?.remove(w);
      meshes[key] = w;
    });

    // Create one physical material per part key, hooked to tuning state.
    // For bots: bodyColor prop overrides main-body-car color from the start.
    const initial = useTuningStore.getState().parts;
    const mats = {} as Record<PartKey, MeshPhysicalMaterial>;
    PART_KEYS.forEach((k) => {
      const p = initial[k];
      const startColor = (k === "main-body-car" && bodyColor) ? bodyColor : p.color;
      mats[k] = new MeshPhysicalMaterial({
        color: new Color(startColor),
        metalness: p.metalness,
        roughness: p.roughness,
        emissive: new Color(p.emissive),
        emissiveIntensity: p.emissiveIntensity,
        clearcoat: p.clearcoat,
        clearcoatRoughness: p.clearcoatRoughness,
        vertexColors: false,
      });
    });
    materialsRef.current = mats;
    const fallback = mats["main-body-car"];

    const resolvePart = (m: Mesh): PartKey => {
      let cur: Object3D | null = m;
      while (cur) {
        const k = NODE_TO_PART[cur.name];
        if (k) return k;
        cur = cur.parent;
      }
      return "main-body-car";
    };

    // Transfer textures from original GLB materials → our per-part materials.
    // First scan: capture first texture-bearing material per part.
    const partTextures: Partial<Record<PartKey, {
      map?: Texture; normalMap?: Texture; roughnessMap?: Texture; metalnessMap?: Texture;
    }>> = {};
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const part = resolvePart(obj);
      if (partTextures[part]) return;
      const orig = obj.material as MeshStandardMaterial | undefined;
      if (!orig) return;
      const slot: { map?: Texture; normalMap?: Texture; roughnessMap?: Texture; metalnessMap?: Texture } = {};
      if (orig.map) slot.map = orig.map;
      if (orig.normalMap) slot.normalMap = orig.normalMap;
      if (orig.roughnessMap) slot.roughnessMap = orig.roughnessMap;
      if (orig.metalnessMap) slot.metalnessMap = orig.metalnessMap;
      if (slot.map || slot.normalMap || slot.roughnessMap || slot.metalnessMap) {
        partTextures[part] = slot;
      }
    });
    PART_KEYS.forEach((k) => {
      const tx = partTextures[k];
      if (!tx) return;
      if (tx.map) mats[k].map = tx.map;
      if (tx.normalMap) mats[k].normalMap = tx.normalMap;
      if (tx.roughnessMap) mats[k].roughnessMap = tx.roughnessMap;
      if (tx.metalnessMap) mats[k].metalnessMap = tx.metalnessMap;
      mats[k].needsUpdate = true;
    });

    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        const part = resolvePart(obj);
        obj.material = mats[part] ?? fallback;
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Skip toCreasedNormals for textured meshes — it can break UVs by duplicating verts without UV preservation.
        if (!partTextures[part]) {
          obj.geometry = toCreasedNormals(obj.geometry, CREASE_ANGLE);
        }
      }
    });

    // Wheel mesh gets the RIMS material (visible inner part = rim).
    // The buggy outer surface is masked by a procedural tire torus rendered on top in JSX.
    Object.values(meshes).forEach((m) => {
      m?.traverse((obj) => {
        if (obj instanceof Mesh) {
          const orig = obj.material as MeshStandardMaterial | undefined;
          if (orig?.map && !mats["rims"].map) {
            mats["rims"].map = orig.map;
            if (orig.normalMap) mats["rims"].normalMap = orig.normalMap;
            mats["rims"].needsUpdate = true;
          }
          obj.material = mats["rims"];
          obj.castShadow = true;
          obj.receiveShadow = true;
          if (!mats["rims"].map) {
            obj.geometry = toCreasedNormals(obj.geometry, CREASE_ANGLE);
          }
        }
      });
    });

    return { bodyScene: scene, wheelMeshes: meshes, wheelPositions: positions };
  }, [carGltf.scene]);

  // Geometry params (reactive)
  const carScale = useTuningStore((s) => s.carScale);
  const bodyYOffset = useTuningStore((s) => s.bodyYOffset);
  const rakeRad = useTuningStore((s) => s.rakeRad);
  const shieldX = useTuningStore((s) => s.shieldX);
  const shieldY = useTuningStore((s) => s.shieldY);
  const shieldZ = useTuningStore((s) => s.shieldZ);
  const shieldScale = useTuningStore((s) => s.shieldScale);
  const numberX = useTuningStore((s) => s.numberX);
  const numberY = useTuningStore((s) => s.numberY);
  const numberZ = useTuningStore((s) => s.numberZ);
  const numberScale = useTuningStore((s) => s.numberScale);
  const plateX = useTuningStore((s) => s.plateX);
  const plateY = useTuningStore((s) => s.plateY);
  const plateZ = useTuningStore((s) => s.plateZ);
  const plateW = useTuningStore((s) => s.plateW);
  const plateH = useTuningStore((s) => s.plateH);
  const tireWrapOuter = useTuningStore((s) => s.tireWrapOuter);
  const tireWrapInner = useTuningStore((s) => s.tireWrapInner);
  const tireWrapWidth = useTuningStore((s) => s.tireWrapWidth);

  // Hollow band geometry: rectangular cross-section swept around Z (wheel axle).
  // Outer cylinder + inner cylinder + two annular caps. Pre-rotated so axis = Z.
  const tireWrapGeom = useMemo(() => {
    const halfW = tireWrapWidth / 2;
    const points = [
      new Vector2(tireWrapOuter, -halfW),
      new Vector2(tireWrapOuter, halfW),
      new Vector2(tireWrapInner, halfW),
      new Vector2(tireWrapInner, -halfW),
      new Vector2(tireWrapOuter, -halfW),
    ];
    const g = new LatheGeometry(points, 40);
    // LatheGeometry default sweeps around Y axis. Rotate so axis = Z (wheel axle).
    g.rotateX(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [tireWrapOuter, tireWrapInner, tireWrapWidth]);
  const shieldText = useTuningStore((s) => s.shieldText);
  const raceNumber = useTuningStore((s) => s.raceNumber);
  const plateText = useTuningStore((s) => s.plateText);

  const shieldTex = useMemo(() => makeMgpShieldTexture(shieldText), [shieldText]);
  const numberTex = useMemo(() => makeNumberTexture(raceNumber), [raceNumber]);
  const plateTex = useMemo(() => makeLicensePlateTexture(plateText), [plateText]);

  const flSteer = useRef<Group>(null);
  const frSteer = useRef<Group>(null);
  const flSpin = useRef<Group>(null);
  const frSpin = useRef<Group>(null);
  const rlSpin = useRef<Group>(null);
  const rrSpin = useRef<Group>(null);

  const steerSmoothed = useRef(0);
  const spinAngle = useRef(0);
  const rearSpinAngle = useRef(0);
  const rollGroup = useRef<Group>(null);
  const rollSmoothed = useRef(0);

  // Sync materials with the tuning store ON CHANGE only — not every
  // frame. Avoids hundreds of redundant uniform writes / NodeMaterial
  // graph dirties per second on the player + every bot.
  useEffect(() => {
    const apply = () => {
      const mats = materialsRef.current;
      if (!mats) return;
      const parts = useTuningStore.getState().parts;
      PART_KEYS.forEach((k) => {
        const p = parts[k];
        const m = mats[k];
        if (!m) return;
        if (k === "main-body-car" && bodyColor) {
          m.color.set(bodyColor);
        } else {
          m.color.set(p.color);
        }
        m.metalness = p.metalness;
        m.roughness = p.roughness;
        m.emissive.set(p.emissive);
        m.emissiveIntensity = p.emissiveIntensity;
        m.clearcoat = p.clearcoat;
        m.clearcoatRoughness = p.clearcoatRoughness;
      });
    };
    apply();
    return useTuningStore.subscribe((s, prev) => {
      if (s.parts !== prev.parts) apply();
    });
  }, [bodyColor]);

  useFrame((_, delta) => {
    if (staticDecor) return; // parked cars skip all per-frame work
    const dt = Math.min(delta, 0.05);
    const inp = inputRef?.current;
    const spd = speedRef?.current ?? 0;
    const state = useTuningStore.getState();
    const { tireRadius, maxSteer, parts } = state;

    // The 14 material properties are no longer rewritten every frame —
    // they're synced from a tuning-store subscription (see useEffect below)
    // and only when something actually changes. The only per-frame mat
    // work is brake / drift modulation on the tail-light emissive.
    const mats = materialsRef.current;
    if (mats) {
      const brake = brakeRef?.current ?? 0;
      const drift = driftRef?.current ?? 0;
      const tail = mats["back-lights"];
      if (tail) {
        const base = parts["back-lights"].emissiveIntensity;
        let mult = 1;
        if (brake > 0) mult += brake * 2.5;
        if (drift > 0.25) {
          const blink = (Math.sin(performance.now() * 0.018) + 1) * 0.5;
          mult += drift * blink * 1.8;
        }
        tail.emissiveIntensity = base * mult;
      }
    }

    let target = 0;
    if (steerSignalRef?.current !== undefined) {
      target = Math.max(-1, Math.min(1, steerSignalRef.current));
    } else if (inp) {
      target = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
    }
    steerSmoothed.current += (target * maxSteer - steerSmoothed.current) * Math.min(1, dt * 12);
    if (flSteer.current) flSteer.current.rotation.y = steerSmoothed.current;
    if (frSteer.current) frSteer.current.rotation.y = steerSmoothed.current;

    spinAngle.current -= (spd / Math.max(0.01, tireRadius)) * dt;
    // Rear wheels lock under handbrake (skid mark, not rolling). When the
    // brake releases they catch back up to the front-wheel spin angle.
    const handbrakeHeld = !!inp?.handbrake;
    if (!handbrakeHeld) rearSpinAngle.current = spinAngle.current;
    const aF = spinAngle.current;
    const aR = rearSpinAngle.current;
    if (flSpin.current) flSpin.current.rotation.z = aF;
    if (frSpin.current) frSpin.current.rotation.z = aF;
    if (rlSpin.current) rlSpin.current.rotation.z = aR;
    if (rrSpin.current) rrSpin.current.rotation.z = aR;

    // Subtle body roll — chassis leans away from the corner.
    const drift = driftRef?.current ?? 0;
    const speedFrac = Math.min(1, Math.abs(spd) / 30);
    const MAX_ROLL = 0.05; // ~3°
    const driftRoll = drift * 0.04;
    const rollTarget = -steerSmoothed.current * speedFrac * (MAX_ROLL + driftRoll);
    rollSmoothed.current += (rollTarget - rollSmoothed.current) * Math.min(1, dt * 5);
    if (rollGroup.current) rollGroup.current.rotation.z = rollSmoothed.current;
  });

  return (
    <group>
      <group ref={rollGroup}>
      <group rotation={[rakeRad, 0, 0]}>
        <group rotation={[0, Math.PI / 2, 0]} scale={carScale} position={[0, bodyYOffset, 0]}>
          <primitive object={bodyScene} />

          <mesh position={[shieldX, shieldY, shieldZ]} scale={[shieldScale, shieldScale, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial map={shieldTex} transparent roughness={0.4} metalness={0.1} />
          </mesh>
          <mesh position={[shieldX, shieldY, -shieldZ]} rotation={[0, Math.PI, 0]} scale={[shieldScale, shieldScale, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial map={shieldTex} transparent roughness={0.4} metalness={0.1} />
          </mesh>

          <mesh position={[numberX, numberY, numberZ]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} scale={[numberScale, numberScale, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial map={numberTex} transparent roughness={0.5} metalness={0.05} />
          </mesh>

          <mesh position={[plateX, plateY, plateZ]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[plateW, plateH]} />
            <meshStandardMaterial map={plateTex} roughness={0.45} metalness={0.05} />
          </mesh>

          {wheelMeshes.fl && wheelPositions.fl && (
            <group ref={flSteer} position={wheelPositions.fl}>
              <group ref={flSpin}>
                <primitive object={wheelMeshes.fl} />
                {materialsRef.current && (
                  <mesh geometry={tireWrapGeom} material={materialsRef.current.tires} castShadow receiveShadow />
                )}
              </group>
            </group>
          )}
          {wheelMeshes.fr && wheelPositions.fr && (
            <group ref={frSteer} position={wheelPositions.fr}>
              <group ref={frSpin}>
                <primitive object={wheelMeshes.fr} />
                {materialsRef.current && (
                  <mesh geometry={tireWrapGeom} material={materialsRef.current.tires} castShadow receiveShadow />
                )}
              </group>
            </group>
          )}
          {wheelMeshes.rl && wheelPositions.rl && (
            <group position={wheelPositions.rl}>
              <group ref={rlSpin}>
                <primitive object={wheelMeshes.rl} />
                {materialsRef.current && (
                  <mesh geometry={tireWrapGeom} material={materialsRef.current.tires} castShadow receiveShadow />
                )}
              </group>
            </group>
          )}
          {wheelMeshes.rr && wheelPositions.rr && (
            <group position={wheelPositions.rr}>
              <group ref={rrSpin}>
                <primitive object={wheelMeshes.rr} />
                {materialsRef.current && (
                  <mesh geometry={tireWrapGeom} material={materialsRef.current.tires} castShadow receiveShadow />
                )}
              </group>
            </group>
          )}
        </group>
      </group>
      </group>
    </group>
  );
}
