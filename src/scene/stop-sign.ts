import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import artwork from "./assets/stop-face.svg?raw";
import { box, cylinder, material, mesh } from "./primitives";

const SIZE = 0.9;
const HEIGHT = 2.45;
const THICKNESS = 0.025;

// Local front is -Z, matching our vehicle convention. The town rotates each sign
// to face its own approach. Front artwork is single-sided; the back is bare metal.
export function stopSign(): THREE.Group {
  const root = new THREE.Group();
  root.name = "stop-sign";
  const galvanized = material("#a5afaf", 0.48, 0.65);
  const post = mesh(
    root,
    new THREE.CylinderGeometry(0.03, 0.03, 2.58, 16),
    galvanized,
    0,
    1.29,
    0.065,
  );
  post.name = "galvanized-post";
  cylinder(root, 0.055, 0.08, [0, 0.04, 0.065], "#737d79");
  const cap = mesh(
    root,
    new THREE.SphereGeometry(0.031, 12, 6),
    galvanized,
    0,
    2.58,
    0.065,
  );
  cap.scale.y = 0.25;

  const octagon = new THREE.Shape();
  const radius = SIZE / (2 * Math.cos(Math.PI / 8));
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 8 + (i * Math.PI) / 4;
    const x = Math.cos(angle) * radius,
      y = Math.sin(angle) * radius;
    if (i === 0) octagon.moveTo(x, y);
    else octagon.lineTo(x, y);
  }
  octagon.closePath();
  const plateGeometry = new THREE.ExtrudeGeometry(octagon, {
    depth: THICKNESS,
    steps: 1,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 1,
  });
  plateGeometry.translate(0, 0, -THICKNESS / 2);
  const plate = mesh(root, plateGeometry, galvanized, 0, HEIGHT, 0);
  plate.name = "solid-octagonal-plate";

  const face = new THREE.Group();
  face.name = "stop-sign-face";
  face.position.set(0, HEIGHT, -THICKNESS / 2 - 0.004);
  face.rotation.y = Math.PI;
  root.add(face);
  const svg = new SVGLoader().parse(artwork);
  svg.paths.forEach((path, layer) => {
    const geometry = new THREE.ShapeGeometry(SVGLoader.createShapes(path));
    // SVG coordinates have Y down. Normalize to a metric plane centred on the plate.
    geometry.translate(-500, -500, 0);
    geometry.scale(SIZE / 1000, -SIZE / 1000, 1);
    // Reflection flips triangle winding: restore front-facing triangles explicitly.
    const index = geometry.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
    geometry.computeVertexNormals();
    const ink = new THREE.MeshStandardMaterial({
      color: path.color,
      roughness: 0.57,
      metalness: 0,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const print = mesh(face, geometry, ink, 0, 0, layer * 0.0003);
    print.name = layer < 3 ? "sign-face-layer" : "stop-letter";
    print.castShadow = false;
    print.renderOrder = 10 + layer;
  });

  // Two straps bolt the plate to the post on its unprinted rear.
  for (const y of [HEIGHT - 0.23, HEIGHT + 0.23]) {
    box(root, [0.38, 0.045, 0.035], [0, y, 0.035], galvanized);
    for (const x of [-0.145, 0.145]) {
      const bolt = mesh(
        root,
        new THREE.CylinderGeometry(0.012, 0.012, 0.013, 6),
        galvanized,
        x,
        y,
        0.06,
      );
      bolt.rotation.x = Math.PI / 2;
    }
  }
  return root;
}
