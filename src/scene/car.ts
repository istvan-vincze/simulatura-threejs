import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { box, material, mesh, plaque } from "./primitives";
import type { Vehicle } from "../domain/vehicle";

export interface CarModel {
  root: THREE.Group;
  update: (
    vehicle: Vehicle,
    brake: boolean,
    indicator: number,
    time: number,
    dt: number,
    direction?: 1 | -1,
  ) => void;
}
// Original metric hatchback. Sculpted body and glazing, articulated wheels, real light clusters.
export function createCar(color: string, learner = false): CarModel {
  const root = new THREE.Group();
  const paint = material(color, 0.28, 0.3),
    dark = material("#202b2d", 0.6),
    glass = material("#344d55", 0.14, 0.5);
  const body = mesh(
    root,
    new RoundedBoxGeometry(1.76, 0.7, 4.25, 4, 0.19),
    paint,
    0,
    0.72,
    0,
  );
  body.name = "sculpted-body";
  box(root, [1.65, 0.15, 3.95], [0, 0.41, 0], dark);
  const profile = new THREE.Shape();
  profile.moveTo(-1.42, 0);
  profile.lineTo(-0.83, 0.67);
  profile.quadraticCurveTo(-0.73, 0.77, -0.48, 0.78);
  profile.lineTo(0.78, 0.78);
  profile.quadraticCurveTo(0.96, 0.77, 1.07, 0.59);
  profile.lineTo(1.44, 0);
  profile.closePath();
  const cabinGeometry = new THREE.ExtrudeGeometry(profile, {
    depth: 1.48,
    bevelEnabled: true,
    bevelSize: 0.045,
    bevelThickness: 0.045,
    bevelSegments: 2,
    steps: 1,
  });
  cabinGeometry.rotateY(-Math.PI / 2);
  cabinGeometry.translate(0.74, 0, 0);
  mesh(root, cabinGeometry, glass, 0, 1, 0.05);
  mesh(
    root,
    new RoundedBoxGeometry(1.5, 0.09, 1.65, 3, 0.04),
    paint,
    0,
    1.81,
    0.15,
  );
  // B-pillars and door detailing.
  for (const side of [-1, 1]) {
    box(root, [0.06, 0.69, 0.09], [side * 0.79, 1.38, 0.15], paint);
    box(root, [0.025, 0.04, 2.7], [side * 0.89, 1.03, 0.05], paint);
    box(root, [0.026, 0.02, 2.35], [side * 0.895, 0.58, 0.15], dark);
    for (const z of [-0.5, 0.85])
      box(
        root,
        [0.035, 0.045, 0.23],
        [side * 0.895, 0.95, z],
        material("#bbc8c5", 0.3, 0.7),
      );
    box(root, [0.12, 0.07, 0.12], [side * 0.92, 1.16, -0.75], dark);
    mesh(
      root,
      new RoundedBoxGeometry(0.21, 0.16, 0.3, 2, 0.05),
      paint,
      side * 1.02,
      1.19,
      -0.75,
    );
    box(root, [0.016, 0.1, 0.2], [side * 1.13, 1.19, -0.73], glass);
  }
  box(root, [1.15, 0.2, 0.035], [0, 0.61, -2.13], dark);
  for (let n = 0; n < 4; n++)
    box(root, [1.08, 0.012, 0.045], [0, 0.54 + n * 0.047, -2.155], "#637071");
  box(root, [1.55, 0.1, 0.08], [0, 0.46, 2.09], dark);
  const headlights = new THREE.MeshStandardMaterial({
    color: "#fff6d8",
    emissive: "#fff2cb",
    emissiveIntensity: 0.6,
  });
  const brakeLights = new THREE.MeshStandardMaterial({
    color: "#8f2223",
    emissive: "#ff3028",
    emissiveIntensity: 0.2,
  });
  const turns = [-1, 1].map(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9e6926",
        emissive: "#ffae32",
        emissiveIntensity: 0,
      }),
  );
  for (const [i, side] of [-1, 1].entries()) {
    mesh(
      root,
      new RoundedBoxGeometry(0.5, 0.17, 0.1, 2, 0.035),
      headlights,
      side * 0.57,
      0.89,
      -2.04,
    );
    box(root, [0.47, 0.15, 0.09], [side * 0.59, 0.9, 2.09], brakeLights);
    for (const z of [-2.07, 2.1])
      box(root, [0.12, 0.1, 0.095], [side * 0.8, 0.9, z], turns[i]);
  }
  plaque(root, "SIM · 001", 0.55, 0.12, [0, 0.68, 2.145]);
  const frontPlate = plaque(root, "SIM · 001", 0.55, 0.12, [0, 0.71, -2.16]);
  frontPlate.rotation.y = Math.PI;
  const wheels: { pivot: THREE.Group; tire: THREE.Group; front: boolean }[] =
    [];
  for (const side of [-1, 1])
    for (const z of [-1.32, 1.32]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.88, 0.38, z);
      root.add(pivot);
      const tire = new THREE.Group();
      pivot.add(tire);
      const rubber = mesh(
        tire,
        new THREE.CylinderGeometry(0.36, 0.36, 0.24, 24),
        material("#222629", 0.98),
      );
      rubber.rotation.z = Math.PI / 2;
      for (const face of [-1, 1]) {
        const hub = mesh(
          tire,
          new THREE.CylinderGeometry(0.245, 0.245, 0.012, 20),
          material("#a6b4b4", 0.35, 0.75),
          face * 0.125,
        );
        hub.rotation.z = Math.PI / 2;
        for (let n = 0; n < 5; n++) {
          const spoke = box(
            tire,
            [0.018, 0.38, 0.055],
            [face * 0.14, 0, 0],
            "#354147",
          );
          spoke.rotation.x = (n * Math.PI) / 5;
        }
      }
      wheels.push({ pivot, tire, front: z < 0 });
    }
  if (learner) {
    box(root, [0.46, 0.28, 0.16], [0, 2, 0.1], "#f4f0e3");
    plaque(root, "T", 0.33, 0.23, [0, 2, 0.19], "#f4f0e3", "#2773a2");
    const t = plaque(root, "T", 0.33, 0.23, [0, 2, 0.01], "#f4f0e3", "#2773a2");
    t.rotation.y = Math.PI;
  }
  return {
    root,
    update(v, braking, indicator, time, dt, direction = 1) {
      root.position.set(v.x, 0.04, v.z);
      root.rotation.y = -v.yaw;
      brakeLights.emissiveIntensity = braking ? 2.3 : 0.15;
      turns.forEach(
        (m, i) =>
          (m.emissiveIntensity =
            indicator === (i === 0 ? -1 : 1) && Math.floor(time * 2.4) % 2 === 0
              ? 2.5
              : 0),
      );
      wheels.forEach((w) => {
        if (w.front) w.pivot.rotation.y = -v.steering;
        w.tire.rotation.x -= (direction * (v.speed * dt)) / 0.36;
      });
    },
  };
}
