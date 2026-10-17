import * as THREE from "three";
import { box, cylinder, material, mesh, plaque } from "./primitives";
import { createCar } from "./car";
import { createRoof } from "./roof";
import { createPavement } from "./pavement";
import { prioritySign, stopSign, trafficLight } from "./signage";
import type { ScenarioId } from "../domain/scenarios";
import type { Signal } from "../domain/signals";
import { STOP_LINE, STOP_LINE_THICKNESS } from "../domain/junction";

function tree(parent: THREE.Object3D, x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  parent.add(g);
  cylinder(g, 0.16, 2.6, [0, 1.3, 0], "#786950");
  for (const [px, py, pz, radius, color] of [
    [0, 3.7, 0, 1.75, "#81966c"],
    [-0.8, 3.1, 0.3, 1.1, "#749163"],
    [0.7, 3.5, 0.2, 1.3, "#96a77c"],
  ] as const)
    mesh(
      g,
      new THREE.IcosahedronGeometry(radius, 1),
      material(color),
      px,
      py,
      pz,
    );
  cylinder(g, 1, 0.12, [0, 0.17, 0], "#b9b3a0");
}
function building(
  parent: THREE.Object3D,
  x: number,
  z: number,
  w: number,
  depth: number,
  h: number,
  color: string,
  name?: string,
) {
  const g = new THREE.Group();
  parent.add(g);
  g.position.set(x, 0, z);
  box(g, [w, h, depth], [0, h / 2 + 0.15, 0], color);
  box(g, [w + 0.15, 0.55, depth + 0.15], [0, 0.4, 0], "#c2b9a4");
  for (const y of [3.1, h + 0.1])
    box(g, [w + 0.3, 0.2, depth + 0.3], [0, y, 0], "#f0e5ce");
  const roof = createRoof(w, depth);
  roof.position.y = h + 0.2;
  g.add(roof);
  for (const side of [-1, 1]) {
    for (let y = 1.65; y < h - 0.3; y += 2.5)
      for (let wx = -w / 2 + 1.5; wx < w / 2 - 0.5; wx += 2.25) {
        box(
          g,
          [1.12, 1.65, 0.13],
          [wx, y, side * (depth / 2 + 0.04)],
          "#f0e8d9",
        );
        box(g, [0.87, 1.4, 0.14], [wx, y, side * (depth / 2 + 0.1)], "#637c7a");
        box(
          g,
          [0.045, 1.42, 0.16],
          [wx, y, side * (depth / 2 + 0.12)],
          "#e0d5bc",
        );
        box(
          g,
          [1.25, 0.12, 0.32],
          [wx, y - 0.84, side * (depth / 2 + 0.11)],
          "#eee4cf",
        );
      }
    for (let y = 1.7; y < h - 0.3; y += 2.5)
      for (let wz = -depth / 2 + 1.5; wz < depth / 2 - 0.5; wz += 2.4) {
        box(g, [0.13, 1.65, 1.12], [side * (w / 2 + 0.04), y, wz], "#eee4cf");
        box(g, [0.15, 1.4, 0.87], [side * (w / 2 + 0.1), y, wz], "#6b8380");
      }
  }
  if (name) {
    box(g, [2, 2.4, 0.2], [0, 1.35, depth / 2 + 0.13], "#42675e");
    plaque(g, name, w * 0.65, 0.65, [0, 3.6, depth / 2 + 0.13]);
    const awning = box(
      g,
      [w * 0.7, 0.12, 1.1],
      [0, 2.9, depth / 2 + 0.6],
      "#648578",
    );
    awning.rotation.x = 0.13;
  }
}
function bench(parent: THREE.Object3D, x: number, z: number, rotation = 0) {
  const g = new THREE.Group();
  parent.add(g);
  g.position.set(x, 0, z);
  g.rotation.y = rotation;
  for (const offset of [-0.22, 0, 0.22])
    box(g, [2, 0.09, 0.17], [0, 0.6, offset], "#9f8258");
  for (const y of [0.95, 1.18])
    box(g, [2, 0.17, 0.08], [0, y, 0.32], "#9f8258");
  for (const xx of [-0.7, 0.7])
    box(g, [0.08, 1.1, 0.1], [xx, 0.64, 0.31], "#40584e");
}
function streetLamp(parent: THREE.Object3D, x: number, z: number) {
  cylinder(parent, 0.07, 5.4, [x, 2.7, z], "#56665b");
  box(parent, [1, 0.08, 0.1], [x - 0.4, 5.4, z], "#56665b");
  box(parent, [0.55, 0.13, 0.32], [x - 0.7, 5.35, z], "#e6ddbe");
}
export interface Town {
  root: THREE.Group;
  setScenario: (id: ScenarioId) => void;
  setSignals: (signals: { ns: Signal; ew: Signal }) => void;
  route: THREE.Group;
}
export function createTown(): Town {
  const root = new THREE.Group();
  box(root, [100, 1, 100], [0, -0.65, 0], "#b5baa0");
  root.add(createPavement());
  for (let t = -46; t < 48; t += 5)
    if (Math.abs(t) > 11) {
      box(root, [0.12, 0.016, 2.5], [0, 0.049, t], "#f4edd8");
      box(root, [2.5, 0.016, 0.12], [t, 0.052, 0], "#f4edd8");
    }
  // Zebra crossings on the north and south arms; no pedestrians in these initial lessons.
  for (const z of [-7, 7])
    for (let x = -3.35; x < 4; x += 1.1)
      box(root, [0.58, 0.017, 2.4], [x, 0.06, z], "#e6e5d8");
  const stopLines = new THREE.Group();
  root.add(stopLines);
  box(
    stopLines,
    [3.7, 0.018, STOP_LINE_THICKNESS],
    [1.95, 0.07, STOP_LINE],
    "#fff6df",
  );
  box(
    stopLines,
    [3.7, 0.018, STOP_LINE_THICKNESS],
    [-1.95, 0.07, -STOP_LINE],
    "#fff6df",
  );
  const ewLines = new THREE.Group();
  root.add(ewLines);
  box(ewLines, [0.35, 0.018, 3.7], [10, 0.07, -1.95], "#fff6df");
  box(ewLines, [0.35, 0.018, 3.7], [-10, 0.07, 1.95], "#fff6df");
  building(root, -16, -18, 13, 12, 8, "#dbcaa7", "KIS TÉR · KÁVÉ");
  building(root, 19, -21, 16, 12, 10.5, "#c7cfba", "KÖNYVESBOLT");
  building(root, -29, -17, 9, 14, 10.5, "#cda68c");
  building(root, -20, 26, 18, 12, 7.8, "#e5d6bb");
  building(root, 28, 28, 12, 15, 8, "#d9bc98");
  building(root, 38, -29, 10, 16, 13, "#c6c8bc");
  for (const [x, z, s] of [
    [11, 12, 1.1],
    [18, 12, 1],
    [12, 23, 1.3],
    [17, 34, 1.2],
    [-10, -10, 0.9],
    [-10, -30, 1.2],
    [-11, 15, 0.9],
    [-33, 11, 1.4],
    [32, -11, 1.2],
    [10, -35, 1],
    [-36, -36, 1.4],
    [39, 13, 1.5],
  ])
    tree(root, x, z, s);
  box(root, [12, 0.07, 1.1], [17, 0.2, 17], "#ddd4ba");
  box(root, [1.1, 0.07, 16], [17, 0.2, 22], "#ddd4ba");
  bench(root, 13, 17);
  bench(root, 20, 17);
  bench(root, -7, -23, Math.PI / 2);
  for (const [x, z] of [
    [5.3, 17],
    [-5.3, -17],
    [17, -5.3],
    [-17, 5.3],
    [5.3, -33],
    [-5.3, 33],
  ])
    streetLamp(root, x, z);
  const street = new THREE.Group();
  street.position.set(-5.5, 0, 9);
  root.add(street);
  cylinder(street, 0.04, 2.7, [0, 1.35, 0], "#68776b");
  plaque(street, "HÁRSFA UTCA", 1.7, 0.3, [0, 2.6, 0.06], "#34594d", "#fff6dd");
  for (const [x, z, color] of [
    [-8, 36, "#738b87"],
    [38, 8, "#c1b69b"],
  ] as const) {
    const car = createCar(color);
    car.root.position.set(x, 0.2, z);
    if (x > 0) car.root.rotation.y = Math.PI / 2;
    root.add(car.root);
  }
  const stopSigns = new THREE.Group();
  root.add(stopSigns);
  const ss = stopSign();
  ss.position.set(4.8, 0.1, STOP_LINE);
  ss.rotation.y = Math.PI;
  stopSigns.add(ss);
  const ns = stopSign();
  ns.position.set(-4.8, 0.1, -STOP_LINE);
  ns.rotation.y = 0;
  stopSigns.add(ns);
  for (const side of [-1, 1]) {
    const p = prioritySign();
    p.position.set(side * 11, 0.1, -side * 4.8);
    p.rotation.y = (side * Math.PI) / 2;
    stopSigns.add(p);
  }
  const lightGroup = new THREE.Group();
  root.add(lightGroup);
  const lights = [
    [4.8, 9.8, 0],
    [-4.8, -9.8, Math.PI],
    [9.8, -4.8, Math.PI / 2],
    [-9.8, 4.8, -Math.PI / 2],
  ].map(([x, z, yaw]) => {
    const l = trafficLight();
    l.root.position.set(x, 0, z);
    l.root.rotation.y = yaw;
    lightGroup.add(l.root);
    return l;
  });
  const route = new THREE.Group();
  root.add(route);
  const routeMat = new THREE.MeshBasicMaterial({
    color: "#dcf0aa",
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  for (let z = 22; z > -20; z -= 3) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.35, -0.2);
    shape.lineTo(0, 0.25);
    shape.lineTo(0.35, -0.2);
    shape.lineTo(0.35, -0.4);
    shape.lineTo(0, 0);
    shape.lineTo(-0.35, -0.4);
    shape.closePath();
    const m = mesh(
      route,
      new THREE.ShapeGeometry(shape),
      routeMat,
      1.85,
      0.075,
      z,
    );
    m.rotation.x = -Math.PI / 2;
  }
  const goal = new THREE.MeshBasicMaterial({
    color: "#c8e79f",
    transparent: true,
    opacity: 0.5,
  });
  for (const x of [0.25, 3.65])
    cylinder(root, 0.05, 3, [x, 1.5, -22], "#adc689");
  box(root, [3.4, 0.05, 1], [1.95, 0.08, -22], goal);
  plaque(root, "CÉL", 1.3, 0.45, [1.95, 3, -22], "#34594d", "#f1f4de");
  return {
    root,
    route,
    setScenario(id) {
      stopSigns.visible = id === "stop";
      lightGroup.visible = id === "signals";
      stopLines.visible = id !== "priority";
      ewLines.visible = id === "signals";
    },
    setSignals(s) {
      lights.forEach((l, i) => l.set(i < 2 ? s.ns : s.ew));
    },
  };
}
