import { useMemo, useRef, type RefObject } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Color, Mesh, MeshStandardMaterial, Group, type Object3D } from "three";
import { useDebugStore } from "../lib/debug-store";

const CREASE_ANGLE = (50 * Math.PI) / 180;

interface VehicleInputLike {
  left: boolean;
  right: boolean;
}

interface CarModelProps {
  bodyColor?: string;
  accentColor?: string;
  brakeIntensity?: number;
  headlights?: boolean;
  inputRef?: RefObject<VehicleInputLike>;
  speedRef?: RefObject<number>;
}

const CAR_URL = "/models/car.glb";

const CAR_SCALE = 4.0;
const BODY_Y_OFFSET = -0.32;
// Wheel rolling radius in world units after CAR_SCALE.
// Wheel bbox Y half-extent ≈ 0.075 model units → 0.30 world units.
const TIRE_RADIUS = 0.30;
const MAX_VISUAL_STEER = 0.42;

const WHEEL_NAMES = {
  fl: "front-lef-wheel",
  fr: "right-front-wheel",
  rl: "rear-left-wheel",
  rr: "right-rear-wheel",
} as const;

type WheelKey = keyof typeof WHEEL_NAMES;

export default function CarModel({
  bodyColor = "#cc0000",
  accentColor = "#1a1a1a",
  brakeIntensity = 0,
  headlights = false,
  inputRef,
  speedRef,
}: CarModelProps) {
  const carGltf = useLoader(GLTFLoader, CAR_URL);

  const { bodyScene, wheelMeshes, wheelPositions } = useMemo(() => {
    const scene = carGltf.scene.clone(true);

    const meshes: Partial<Record<WheelKey, Object3D>> = {};
    const positions: Partial<Record<WheelKey, [number, number, number]>> = {};

    (Object.entries(WHEEL_NAMES) as [WheelKey, string][]).forEach(([key, name]) => {
      const w = scene.getObjectByName(name);
      if (!w) {
        console.warn(`[CarModel] wheel node '${name}' not found in GLB`);
        return;
      }
      // Capture model-space position then zero it — the wrapper group will carry it,
      // so the wheel mesh rotates around its own pivot.
      positions[key] = [w.position.x, w.position.y, w.position.z];
      w.position.set(0, 0, 0);
      w.parent?.remove(w);
      meshes[key] = w;
    });

    const bodyMat = new MeshStandardMaterial({
      color: new Color(bodyColor),
      metalness: 0.5,
      roughness: 0.4,
      flatShading: false,
    });
    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.material = bodyMat;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.geometry = toCreasedNormals(obj.geometry, CREASE_ANGLE);
      }
    });

    const tireMat = new MeshStandardMaterial({
      color: new Color("#0a0a0a"),
      roughness: 0.95,
      metalness: 0.0,
      flatShading: false,
    });
    Object.values(meshes).forEach((m) => {
      m?.traverse((obj) => {
        if (obj instanceof Mesh) {
          obj.material = tireMat;
          obj.castShadow = true;
          obj.geometry = toCreasedNormals(obj.geometry, CREASE_ANGLE);
        }
      });
    });

    return { bodyScene: scene, wheelMeshes: meshes, wheelPositions: positions };
  }, [carGltf.scene, bodyColor]);

  const flSteer = useRef<Group>(null);
  const frSteer = useRef<Group>(null);
  const flSpin = useRef<Group>(null);
  const frSpin = useRef<Group>(null);
  const rlSpin = useRef<Group>(null);
  const rrSpin = useRef<Group>(null);

  const steerSmoothed = useRef(0);
  const spinAngle = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const inp = inputRef?.current;
    const spd = speedRef?.current ?? 0;

    let target = 0;
    if (inp) target = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
    steerSmoothed.current += (target * MAX_VISUAL_STEER - steerSmoothed.current) * Math.min(1, dt * 12);
    if (flSteer.current) flSteer.current.rotation.y = steerSmoothed.current;
    if (frSteer.current) frSteer.current.rotation.y = steerSmoothed.current;

    // Wheel disc lies in model XY plane → axle is local Z → spin = rotation.z
    spinAngle.current -= (spd / TIRE_RADIUS) * dt;
    const a = spinAngle.current;
    if (flSpin.current) flSpin.current.rotation.z = a;
    if (frSpin.current) frSpin.current.rotation.z = a;
    if (rlSpin.current) rlSpin.current.rotation.z = a;
    if (rrSpin.current) rrSpin.current.rotation.z = a;
  });

  void accentColor;
  void brakeIntensity;
  void headlights;

  const debug = useDebugStore((s) => s.debug);

  return (
    <group>
      {/* Outer rake (~3°) */}
      <group rotation={[0.05, 0, 0]}>
        {/* Model forward = +X → game forward = -Z (rotate +π/2 around Y). */}
        <group rotation={[0, Math.PI / 2, 0]} scale={CAR_SCALE} position={[0, BODY_Y_OFFSET, 0]}>
          <primitive object={bodyScene} />

          {wheelMeshes.fl && wheelPositions.fl && (
            <group ref={flSteer} position={wheelPositions.fl}>
              <group ref={flSpin}>
                <primitive object={wheelMeshes.fl} />
              </group>
            </group>
          )}
          {wheelMeshes.fr && wheelPositions.fr && (
            <group ref={frSteer} position={wheelPositions.fr}>
              <group ref={frSpin}>
                <primitive object={wheelMeshes.fr} />
              </group>
            </group>
          )}
          {wheelMeshes.rl && wheelPositions.rl && (
            <group position={wheelPositions.rl}>
              <group ref={rlSpin}>
                <primitive object={wheelMeshes.rl} />
              </group>
            </group>
          )}
          {wheelMeshes.rr && wheelPositions.rr && (
            <group position={wheelPositions.rr}>
              <group ref={rrSpin}>
                <primitive object={wheelMeshes.rr} />
              </group>
            </group>
          )}
        </group>
      </group>

      {debug && (Object.keys(WHEEL_NAMES) as WheelKey[]).map((k) => {
        const p = wheelPositions[k];
        if (!p) return null;
        const wp: [number, number, number] = [p[0] * CAR_SCALE, p[1] * CAR_SCALE + BODY_Y_OFFSET + 0.5, p[2] * CAR_SCALE];
        // After parent rot Y=π/2: model (x,y,z) → world (z, y, -x)
        const worldP: [number, number, number] = [wp[2], wp[1], -wp[0]];
        const color = k === "fl" ? "#ff2020" : k === "fr" ? "#20ff20" : k === "rl" ? "#2080ff" : "#ffff20";
        return (
          <mesh key={k} position={worldP}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}
