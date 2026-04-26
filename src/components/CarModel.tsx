import { useMemo, useRef, type RefObject } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Color, Mesh, MeshStandardMaterial, Group, type Object3D } from "three";
import { useDebugStore } from "../lib/debug-store";

// Angle (radians) above which adjacent faces stay hard-edged.
// Lower = more flat-shaded look, higher = more smooth. ~50° is a good middle.
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
const TIRE_URL = "/models/tire.glb";

const CAR_SCALE = 4.0;
const TIRE_SCALE = 0.72;
const TIRE_RADIUS = 0.36;

// Tweak these four numbers to align tires with the model's axle stubs.
// Y: car body sits at y=-0.3, so wheel-centre at y=-0.3+TIRE_RADIUS=0.06 puts the tire on the ground.
// Verified via /tmp/verify3.mjs against car.glb vertex centroids
// (body translate Y=-0.20, rake 0.05rad, scale 4.0).
const WHEEL_FX = 0.82;
const WHEEL_RX = 0.91;
const WHEEL_FZ = -1.21;
const WHEEL_RZ = 1.37;
const WHEEL_FY = 0.083;
const WHEEL_RY = 0.091;

const MAX_VISUAL_STEER = 0.42;

function tintScene(root: Object3D, color: string) {
  const mat = new MeshStandardMaterial({
    color: new Color(color),
    metalness: 0.5,
    roughness: 0.4,
    flatShading: false,
  });
  root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.material = mat;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.geometry = toCreasedNormals(obj.geometry, CREASE_ANGLE);
    }
  });
  return mat;
}

export default function CarModel({
  bodyColor = "#cc0000",
  accentColor = "#1a1a1a",
  brakeIntensity = 0,
  headlights = false,
  inputRef,
  speedRef,
}: CarModelProps) {
  const carGltf = useLoader(GLTFLoader, CAR_URL);
  const tireGltf = useLoader(GLTFLoader, TIRE_URL);

  const carScene = useMemo(() => {
    const cloned = carGltf.scene.clone(true);
    tintScene(cloned, bodyColor);
    return cloned;
  }, [carGltf.scene, bodyColor]);

  // 4 independent tire clones (each needs its own transform).
  const tireScenes = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: new Color("#0a0a0a"),
      roughness: 0.95,
      metalness: 0.0,
      flatShading: false,
    });
    return [0, 1, 2, 3].map(() => {
      const c = tireGltf.scene.clone(true);
      c.traverse((obj) => {
        if (obj instanceof Mesh) {
          obj.material = mat;
          obj.castShadow = true;
          obj.geometry = toCreasedNormals(obj.geometry, CREASE_ANGLE);
        }
      });
      return c;
    });
  }, [tireGltf.scene]);

  // Steer pivot (front wheels only) and spin pivot (all wheels).
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

    // Steering — smooth toward target
    let target = 0;
    if (inp) target = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
    steerSmoothed.current += (target * MAX_VISUAL_STEER - steerSmoothed.current) * Math.min(1, dt * 12);
    if (flSteer.current) flSteer.current.rotation.y = steerSmoothed.current;
    if (frSteer.current) frSteer.current.rotation.y = steerSmoothed.current;

    // Roll — convert linear speed to angular velocity (ω = v / r), preserve sign
    spinAngle.current -= (spd / TIRE_RADIUS) * dt;
    const a = spinAngle.current;
    if (flSpin.current) flSpin.current.rotation.x = a;
    if (frSpin.current) frSpin.current.rotation.x = a;
    if (rlSpin.current) rlSpin.current.rotation.x = a;
    if (rrSpin.current) rrSpin.current.rotation.x = a;
  });

  void accentColor;
  void brakeIntensity;
  void headlights;

  const debug = useDebugStore((s) => s.debug);

  return (
    <group>
      {/* Outer tilt: gentle nose-up rake (~3°) so the rear stays off the ground */}
      <group rotation={[0.05, 0, 0]}>
        <primitive
          object={carScene}
          rotation={[0, Math.PI / 2, 0]}
          scale={CAR_SCALE}
          position={[0, -0.20, 0]}
        />
      </group>

      {/* Front-left — keep current orientation */}
      <group ref={flSteer} position={[-WHEEL_FX, WHEEL_FY, WHEEL_FZ]}>
        <group ref={flSpin}>
          <primitive object={tireScenes[0]!} rotation={[0, Math.PI, 0]} scale={TIRE_SCALE} />
        </group>
      </group>
      {/* Front-right — flipped 180° around Y so the rim faces outward */}
      <group ref={frSteer} position={[WHEEL_FX, WHEEL_FY, WHEEL_FZ]}>
        <group ref={frSpin}>
          <primitive object={tireScenes[1]!} rotation={[0, 0, 0]} scale={TIRE_SCALE} />
        </group>
      </group>
      {/* Rear-left */}
      <group position={[-WHEEL_RX, WHEEL_RY, WHEEL_RZ]}>
        <group ref={rlSpin}>
          <primitive object={tireScenes[2]!} rotation={[0, Math.PI, 0]} scale={TIRE_SCALE} />
        </group>
      </group>
      {/* Rear-right — flipped 180° around Y */}
      <group position={[WHEEL_RX, WHEEL_RY, WHEEL_RZ]}>
        <group ref={rrSpin}>
          <primitive object={tireScenes[3]!} rotation={[0, 0, 0]} scale={TIRE_SCALE} />
        </group>
      </group>

      {/* Debug markers — bright spheres at each wheel centre, only when Shift+D is on */}
      {debug && (
        <>
          {/* FL = red */}
          <mesh position={[-WHEEL_FX, WHEEL_FY + 0.5, WHEEL_FZ]}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshBasicMaterial color="#ff2020" />
          </mesh>
          {/* FR = green */}
          <mesh position={[WHEEL_FX, WHEEL_FY + 0.5, WHEEL_FZ]}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshBasicMaterial color="#20ff20" />
          </mesh>
          {/* RL = blue */}
          <mesh position={[-WHEEL_RX, WHEEL_RY + 0.5, WHEEL_RZ]}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshBasicMaterial color="#2080ff" />
          </mesh>
          {/* RR = yellow */}
          <mesh position={[WHEEL_RX, WHEEL_RY + 0.5, WHEEL_RZ]}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshBasicMaterial color="#ffff20" />
          </mesh>
        </>
      )}
    </group>
  );
}

