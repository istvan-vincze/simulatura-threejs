import * as THREE from "three";
import { CORNER_RADIUS, ROAD_HALF_WIDTH } from "../domain/junction";
import { box, material } from "./primitives";

const ROAD_Y = 0.04;
const WALK_Y = 0.2;
const CURB_WIDTH = 0.18;
const EDGE = ROAD_HALF_WIDTH;
const CENTER = EDGE + CORNER_RADIUS;
type Point = [number, number, number];

// The entire crossing approach slopes down, including its flared sides.
function walkHeight(x: number, z: number): number {
  const across = THREE.MathUtils.clamp((6.4 - x) / (6.4 - EDGE), 0, 1);
  const along = THREE.MathUtils.clamp(Math.min(z - 5.3, 8.7 - z) / 0.5, 0, 1);
  return WALK_Y - (WALK_Y - ROAD_Y) * across * along;
}

class Surface {
  private vertices: number[] = [];

  triangle(a: Point, b: Point, c: Point) {
    this.vertices.push(...a, ...b, ...c);
  }

  quad(a: Point, b: Point, c: Point, d: Point) {
    this.triangle(a, b, d);
    this.triangle(b, c, d);
  }

  addTo(parent: THREE.Object3D, color: string) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.vertices, 3),
    );
    geometry.computeVertexNormals();
    const surface = new THREE.Mesh(geometry, material(color));
    surface.receiveShadow = true;
    parent.add(surface);
  }
}

function corner(): THREE.Group {
  const root = new THREE.Group();
  const pavement = new Surface();
  const curbs = new Surface();
  const edging = new Surface();
  const tactile = new Surface();
  const point = (x: number, z: number, lift = 0): Point => [
    x,
    walkHeight(x, z) + lift,
    z,
  ];

  const xs = [EDGE + CURB_WIDTH, CENTER, 6.4, 9, 50];
  const zs = [EDGE + CURB_WIDTH, CENTER, 5.3, 5.8, 8.2, 8.7, 9, 50];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const [x0, x1] = [xs[i], xs[i + 1]];
      const [z0, z1] = [zs[j], zs[j + 1]];
      if ((i === 0 && j === 0) || (x0 >= 9 && z0 >= 9)) continue;
      pavement.quad(point(x0, z0), point(x0, z1), point(x1, z1), point(x1, z0));
    }
  }

  // A filled quarter circle joins both sidewalks behind the curved kerb.
  const arc = (angle: number, radius: number): Point => [
    CENTER + Math.cos(angle) * radius,
    WALK_Y,
    CENTER + Math.sin(angle) * radius,
  ];
  for (let i = 0; i < 24; i++) {
    const a = Math.PI + ((i / 24) * Math.PI) / 2;
    const b = Math.PI + (((i + 1) / 24) * Math.PI) / 2;
    const innerA = arc(a, CORNER_RADIUS - CURB_WIDTH);
    const innerB = arc(b, CORNER_RADIUS - CURB_WIDTH);
    const outerA = arc(a, CORNER_RADIUS);
    const outerB = arc(b, CORNER_RADIUS);
    pavement.triangle([CENTER, WALK_Y, CENTER], innerB, innerA);
    curbs.quad(outerA, innerA, innerB, outerB);
    curbs.quad([outerA[0], ROAD_Y, outerA[2]], outerA, outerB, [
      outerB[0],
      ROAD_Y,
      outerB[2],
    ]);
  }

  // Narrow concrete kerbstones sit directly on the asphalt edge. Tiny joints
  // divide a continuous edge, rather than leaving gaps between floating blocks.
  const breaks = [
    ...new Set([
      CENTER,
      5.3,
      5.8,
      8.2,
      8.7,
      50,
      ...Array.from({ length: 44 }, (_, i) => i + 6),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i] + 0.004;
    const b = breaks[i + 1] - 0.004;
    curbs.quad(
      point(EDGE, a),
      point(EDGE, b),
      point(EDGE + CURB_WIDTH, b),
      point(EDGE + CURB_WIDTH, a),
    );
    curbs.quad([EDGE, ROAD_Y, b], point(EDGE, b), point(EDGE, a), [
      EDGE,
      ROAD_Y,
      a,
    ]);
    // The east/west arm has no crossing, so its kerb stays at full height.
    curbs.quad(
      [a, WALK_Y, EDGE],
      [a, WALK_Y, EDGE + CURB_WIDTH],
      [b, WALK_Y, EDGE + CURB_WIDTH],
      [b, WALK_Y, EDGE],
    );
    curbs.quad(
      [a, ROAD_Y, EDGE],
      [a, WALK_Y, EDGE],
      [b, WALK_Y, EDGE],
      [b, ROAD_Y, EDGE],
    );
  }

  // Low garden edging, separate from the raised road kerb.
  edging.quad(
    [8.9, WALK_Y, 9],
    [8.9, WALK_Y, 50],
    [9, WALK_Y, 50],
    [9, WALK_Y, 9],
  );
  edging.quad(
    [9, WALK_Y, 8.9],
    [9, WALK_Y, 9],
    [50, WALK_Y, 9],
    [50, WALK_Y, 8.9],
  );
  box(root, [41, 0.05, 41], [29.5, 0.16, 29.5], "#b7bea0");

  // Ochre warning tiles follow the ramp surface at the two zebra landings.
  for (let z = 5.8; z < 8.19; z += 0.3) {
    for (const x of [4.4, 4.7]) {
      tactile.quad(
        point(x + 0.008, z + 0.008, 0.008),
        point(x + 0.008, z + 0.292, 0.008),
        point(x + 0.292, z + 0.292, 0.008),
        point(x + 0.292, z + 0.008, 0.008),
      );
    }
  }
  const studs = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.018, 0.025, 0.009, 6),
    material("#b6a274"),
    144,
  );
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let ix = 0; ix < 6; ix++)
    for (let iz = 0; iz < 24; iz++) {
      const x = 4.45 + ix * 0.1;
      const z = 5.85 + iz * 0.1;
      matrix.makeTranslation(x, walkHeight(x, z) + 0.017, z);
      studs.setMatrixAt(index++, matrix);
    }
  root.add(studs);
  pavement.addTo(root, "#a6a7a1");
  curbs.addTo(root, "#c5c5bd");
  edging.addTo(root, "#b8b9af");
  tactile.addTo(root, "#b8a57d");
  return root;
}

export function createPavement(): THREE.Group {
  const root = new THREE.Group();
  // One asphalt surface avoids seams and height changes inside the junction.
  box(root, [100, 0.08, 100], [0, 0, 0], "#626762");
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const quadrant = corner();
      quadrant.scale.set(sx, 1, sz);
      root.add(quadrant);
    }
  return root;
}
