import * as THREE from "three";
import { box, material, mesh } from "./primitives";

// Roof is built along its longer axis, then oriented as one complete assembly.
// Its rectangular eaves always match the building footprint plus a 35 cm overhang.
export function createRoof(width: number, depth: number): THREE.Group {
  const roof = new THREE.Group();
  roof.name = "hipped-roof";
  const length = Math.max(width, depth) + 0.7;
  const span = Math.min(width, depth) + 0.7;
  const halfLength = length / 2,
    halfSpan = span / 2;
  const hipRun = Math.min(span * 0.38, length * 0.3);
  const ridgeHalf = halfLength - hipRun;
  const eave = 0.14;
  const rise = Math.min(3.4, halfSpan * Math.tan((28 * Math.PI) / 180));
  roof.rotation.y = width >= depth ? 0 : Math.PI / 2;

  const points = [
    [-halfLength, eave, halfSpan],
    [halfLength, eave, halfSpan],
    [halfLength, eave, -halfSpan],
    [-halfLength, eave, -halfSpan],
    [-ridgeHalf, eave + rise, 0],
    [ridgeHalf, eave + rise, 0],
  ].map((p) => new THREE.Vector3(...p));
  const triangles = [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 3, 0, 4, 1, 2, 5];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      triangles.flatMap((i) => points[i].toArray()),
      3,
    ),
  );
  geometry.computeVertexNormals();
  mesh(roof, geometry, material("#68716c", 0.92)).name = "roof-slopes";
  box(roof, [length, eave, span], [0, eave / 2, 0], "#c2bfac");

  // Fine horizontal courses follow all four slopes, including the clipped hip ends.
  const courses: number[] = [];
  for (let y = 0.32; y < rise - 0.15; y += 0.32) {
    const t = y / rise;
    const x = halfLength - hipRun * t,
      z = halfSpan * (1 - t);
    const level = eave + y + 0.006;
    courses.push(-x, level, z, x, level, z, -x, level, -z, x, level, -z);
    courses.push(-x, level, -z, -x, level, z, x, level, -z, x, level, z);
  }
  const courseGeometry = new THREE.BufferGeometry();
  courseGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(courses, 3),
  );
  roof.add(
    new THREE.LineSegments(
      courseGeometry,
      new THREE.LineBasicMaterial({
        color: "#58615c",
        transparent: true,
        opacity: 0.45,
      }),
    ),
  );

  function cap(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    const offset = new THREE.Vector3().subVectors(b, a);
    const strip = mesh(
      roof,
      new THREE.CylinderGeometry(radius, radius, offset.length(), 8),
      material("#727b73", 0.88),
    );
    strip.position.copy(a).add(b).multiplyScalar(0.5);
    strip.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      offset.normalize(),
    );
  }
  cap(points[4], points[5], 0.075);
  for (const [corner, peak] of [
    [0, 4],
    [3, 4],
    [1, 5],
    [2, 5],
  ])
    cap(points[corner], points[peak], 0.045);
  for (const side of [-1, 1]) {
    box(
      roof,
      [length + 0.08, 0.12, 0.11],
      [0, eave - 0.03, side * halfSpan],
      "#727d76",
    );
    box(
      roof,
      [0.11, 0.12, span],
      [side * halfLength, eave - 0.03, 0],
      "#727d76",
    );
  }

  const chimneyX = -ridgeHalf * 0.5,
    chimneyZ = halfSpan * 0.35;
  const surfaceY = eave + rise * 0.65;
  const chimneyBase = surfaceY - 0.25;
  box(
    roof,
    [0.62, 1.4, 0.62],
    [chimneyX, chimneyBase + 0.7, chimneyZ],
    "#b5a28a",
  );
  box(
    roof,
    [0.78, 0.12, 0.78],
    [chimneyX, chimneyBase + 1.43, chimneyZ],
    "#7c7f72",
  );
  box(
    roof,
    [0.43, 0.015, 0.43],
    [chimneyX, chimneyBase + 1.5, chimneyZ],
    "#37423e",
  );
  return roof;
}
