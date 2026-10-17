import * as THREE from "three";
import { box, cylinder, material, mesh } from "./primitives";
import type { Signal } from "../domain/signals";
export function trafficLight(): {
  root: THREE.Group;
  set: (signal: Signal) => void;
} {
  const root = new THREE.Group();
  cylinder(root, 0.065, 3.5, [0, 1.75, 0], "#5c6760");
  box(root, [0.48, 1.34, 0.26], [0, 3.12, 0.05], "#24302e");
  const lamps = ["#f75c45", "#ffbe43", "#65d0a0"].map((color, i) => {
    const y = 3.53 - i * 0.4;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0,
    });
    const lamp = mesh(
      root,
      new THREE.CircleGeometry(0.145, 24),
      mat,
      0,
      y,
      0.19,
    );
    lamp.castShadow = false;
    const hood = mesh(
      root,
      new THREE.CylinderGeometry(
        0.18,
        0.18,
        0.24,
        16,
        1,
        true,
        Math.PI / 2,
        Math.PI,
      ),
      material("#24302e"),
      0,
      y,
      0.27,
    );
    hood.rotation.x = Math.PI / 2;
    return mat;
  });
  return {
    root,
    set(signal) {
      lamps.forEach((m, i) => {
        const on =
          i === 0
            ? signal === "red" || signal === "red-amber"
            : i === 1
              ? signal === "amber" || signal === "red-amber"
              : signal === "green";
        m.emissiveIntensity = on ? 1.8 : 0;
        m.color.set(on ? ["#f75c45", "#ffbe43", "#65d0a0"][i] : "#25332c");
      });
    },
  };
}
export { stopSign } from "./stop-sign";
export function prioritySign(): THREE.Group {
  const root = new THREE.Group();
  cylinder(root, 0.045, 2.5, [0, 1.25, 0], "#7c8278");
  const outer = box(root, [0.7, 0.7, 0.05], [0, 2.4, 0], "#fff9eb");
  outer.rotation.z = Math.PI / 4;
  const inner = box(root, [0.53, 0.53, 0.055], [0, 2.4, 0.025], "#e9bd53");
  inner.rotation.z = Math.PI / 4;
  return root;
}
