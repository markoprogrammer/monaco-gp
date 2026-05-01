import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator, WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Bakes a simple procedural environment into `scene.environment` so PBR
 *  materials have something to reflect. PMREMGenerator currently only
 *  works on WebGLRenderer (it touches WebGL-specific buffers); on WebGPU
 *  we no-op and rely on direct lights — env-map support there will need
 *  a different approach (e.g. a pre-baked CubeTexture).
 */
export default function EnvLight() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    if (!(gl instanceof WebGLRenderer)) return;
    const pmrem = new PMREMGenerator(gl);
    pmrem.compileEquirectangularShader?.();
    const envScene = new RoomEnvironment();
    const target = pmrem.fromScene(envScene, 0.04);
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}
