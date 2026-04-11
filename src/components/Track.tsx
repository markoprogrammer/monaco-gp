import { useMemo } from "react";
import { CatmullRomCurve3, BufferGeometry, Float32BufferAttribute, Vector3, DoubleSide } from "three";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import { TRACK_POINTS, TRACK_WIDTH, GUARDRAIL_HEIGHT } from "../lib/track-data";

const ROAD_SEGMENTS = 400;

interface EdgePoint {
  left: Vector3;
  right: Vector3;
  tangent: Vector3;
}

function computeEdges(curve: CatmullRomCurve3, segments: number, width: number): EdgePoint[] {
  const halfWidth = width / 2;
  const edges: EdgePoint[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const right = new Vector3(-tangent.z, 0, tangent.x).normalize();

    edges.push({
      left: point.clone().addScaledVector(right, -halfWidth),
      right: point.clone().addScaledVector(right, halfWidth),
      tangent: tangent.clone(),
    });
  }

  return edges;
}

function buildRoadGeometry(edges: EdgePoint[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    const t = i / (edges.length - 1);

    positions.push(e.left.x, e.left.y + 0.01, e.left.z);
    positions.push(e.right.x, e.right.y + 0.01, e.right.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t * 20, 1, t * 20);

    if (i < edges.length - 1) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geom.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  return geom;
}

function buildWallGeometry(edgePoints: Vector3[], height: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < edgePoints.length; i++) {
    const p = edgePoints[i]!;

    // Bottom vertex
    positions.push(p.x, p.y, p.z);
    normals.push(0, 0, 1); // will be overridden by DoubleSide
    // Top vertex
    positions.push(p.x, p.y + height, p.z);
    normals.push(0, 0, 1);

    if (i < edgePoints.length - 1) {
      const base = i * 2;
      // Both winding orders for double-sided collision
      indices.push(base, base + 2, base + 1);
      indices.push(base + 1, base + 2, base + 3);
      // Reverse winding for trimesh collision from other side
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildCenterLineGeometry(curve: CatmullRomCurve3, segments: number) {
  // Dashed center line — short white segments along the middle
  const dashLength = 0.4; // fraction of segment that is a dash
  const dashWidth = 0.15;
  const positions: number[] = [];
  const indices: number[] = [];
  const dashCount = Math.floor(segments / 4); // one dash every 4 segments

  for (let i = 0; i < dashCount; i++) {
    const t0 = i / dashCount;
    const t1 = t0 + dashLength / dashCount;
    const p0 = curve.getPointAt(t0);
    const p1 = curve.getPointAt(Math.min(t1, 1));
    const tangent = curve.getTangentAt(t0);
    const right = new Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(dashWidth);

    const base = i * 4;
    // 4 vertices per dash (quad)
    positions.push(
      p0.x - right.x, p0.y + 0.02, p0.z - right.z,
      p0.x + right.x, p0.y + 0.02, p0.z + right.z,
      p1.x - right.x, p1.y + 0.02, p1.z - right.z,
      p1.x + right.x, p1.y + 0.02, p1.z + right.z,
    );
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  return geom;
}

export default function Track() {
  const { roadGeometry, leftWallGeom, rightWallGeom, centerLineGeom, startPosition, startRotation } = useMemo(() => {
    const curve = new CatmullRomCurve3(TRACK_POINTS, true, "catmullrom", 0.5);
    const edges = computeEdges(curve, ROAD_SEGMENTS, TRACK_WIDTH);
    const roadGeom = buildRoadGeometry(edges);

    const leftPoints = edges.map((e) => e.left);
    const rightPoints = edges.map((e) => e.right);

    const leftWall = buildWallGeometry(leftPoints, GUARDRAIL_HEIGHT);
    const rightWall = buildWallGeometry(rightPoints, GUARDRAIL_HEIGHT);

    const centerLine = buildCenterLineGeometry(curve, ROAD_SEGMENTS);

    const startPos = curve.getPointAt(0);
    const startTangent = curve.getTangentAt(0);
    const startAngle = Math.atan2(startTangent.x, startTangent.z);

    return {
      roadGeometry: roadGeom,
      leftWallGeom: leftWall,
      rightWallGeom: rightWall,
      centerLineGeom: centerLine,
      startPosition: startPos,
      startRotation: startAngle,
    };
  }, []);

  return (
    <group>
      {/* Road surface with physics */}
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider
          args={[
            roadGeometry.attributes.position!.array as Float32Array,
            roadGeometry.index!.array as Uint32Array,
          ]}
        />
        <mesh geometry={roadGeometry} receiveShadow>
          <meshStandardMaterial color="#333333" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Left guardrail — visual + physics */}
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider
          args={[
            leftWallGeom.attributes.position!.array as Float32Array,
            leftWallGeom.index!.array as Uint32Array,
          ]}
        />
        <mesh geometry={leftWallGeom}>
          <meshBasicMaterial color="#a0a0a0" side={DoubleSide} />
        </mesh>
      </RigidBody>

      {/* Right guardrail — visual + physics */}
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider
          args={[
            rightWallGeom.attributes.position!.array as Float32Array,
            rightWallGeom.index!.array as Uint32Array,
          ]}
        />
        <mesh geometry={rightWallGeom}>
          <meshBasicMaterial color="#a0a0a0" side={DoubleSide} />
        </mesh>
      </RigidBody>

      {/* Center line — dashed white */}
      <mesh geometry={centerLineGeom}>
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Start/finish line — checkered pattern */}
      <group position={[startPosition.x, startPosition.y + 0.006, startPosition.z]} rotation={[0, startRotation, 0]}>
        {Array.from({ length: 12 }).map((_, col) =>
          Array.from({ length: 2 }).map((_, row) => (
            <mesh
              key={`${col}-${row}`}
              position={[(col - 5.5) * 1, 0, (row - 0.5) * 1]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color={(col + row) % 2 === 0 ? "#ffffff" : "#111111"} />
            </mesh>
          ))
        )}
      </group>
    </group>
  );
}
