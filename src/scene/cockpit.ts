import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { createInstruments } from "./cockpit-instruments";
import type { Vehicle } from "../domain/vehicle";

export const DRIVER_EYE = new THREE.Vector3(-0.38, 1.46, 0.42);
export const DRIVER_FOV = 68;
export const DRIVER_PITCH = -0.14;
type Point = [number, number, number];

export function createCockpit() {
  const root = new THREE.Group();
  root.name = "driver-cockpit";
  const palette = {
    upper: new THREE.MeshStandardMaterial({
      color: "#252d33",
      roughness: 0.95,
    }),
    lower: new THREE.MeshStandardMaterial({ color: "#414b50", roughness: 0.9 }),
    cloth: new THREE.MeshStandardMaterial({ color: "#687477", roughness: 1 }),
    headliner: new THREE.MeshStandardMaterial({
      color: "#b8bbb0",
      roughness: 1,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: "#aeb9b6",
      metalness: 0.65,
      roughness: 0.35,
    }),
    black: new THREE.MeshStandardMaterial({
      color: "#10191e",
      roughness: 0.72,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: "#9a8070",
      roughness: 0.8,
    }),
    paint: new THREE.MeshStandardMaterial({
      color: "#c66a43",
      roughness: 0.35,
      metalness: 0.25,
    }),
  };
  function rounded(
    parent: THREE.Object3D,
    size: Point,
    position: Point,
    mat: THREE.Material,
    radius = 0.025,
  ) {
    const object = new THREE.Mesh(
      new RoundedBoxGeometry(...size, 3, radius),
      mat,
    );
    object.position.set(...position);
    parent.add(object);
    return object;
  }
  function beam(
    a: Point,
    b: Point,
    radius: number,
    mat: THREE.Material,
    parent: THREE.Object3D = root,
  ) {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b);
    const object = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 10),
      mat,
    );
    object.position.copy(from).add(to).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.sub(from).normalize(),
    );
    parent.add(object);
    return object;
  }
  // Dash and passenger fascia sit below an open windscreen, not behind the
  // exterior model's opaque glazing. All coordinates are local to the vehicle.
  rounded(root, [1.51, 0.18, 0.67], [0, 0.99, -0.86], palette.upper, 0.07);
  rounded(root, [1.47, 0.28, 0.32], [0, 0.8, -0.73], palette.lower, 0.055);
  rounded(root, [1.46, 0.026, 0.035], [0, 0.96, -0.51], palette.trim, 0.01);
  rounded(root, [0.55, 0.2, 0.045], [0.46, 0.79, -0.55], palette.upper);
  rounded(root, [0.12, 0.015, 0.026], [0.46, 0.87, -0.52], palette.trim, 0.005);
  rounded(root, [1.46, 0.065, 0.84], [0, 1, -1.61], palette.paint, 0.03);
  // Windscreen surround, side windows and roof. No opaque plane covers glass.
  for (const side of [-1, 1]) {
    beam(
      [side * 0.76, 1.06, -1.2],
      [side * 0.68, 1.83, -0.59],
      0.045,
      palette.headliner,
    );
    beam(
      [side * 0.68, 1.83, -0.59],
      [side * 0.74, 1.83, 1.1],
      0.035,
      palette.headliner,
    );
    rounded(
      root,
      [0.1, 0.81, 0.095],
      [side * 0.75, 1.43, 0.95],
      palette.headliner,
    );
    rounded(
      root,
      [0.11, 0.63, 1.9],
      [side * 0.77, 0.69, -0.03],
      palette.lower,
      0.045,
    );
    rounded(
      root,
      [0.025, 0.19, 0.91],
      [side * 0.705, 0.86, -0.05],
      palette.accent,
    );
    rounded(
      root,
      [0.14, 0.085, 0.64],
      [side * 0.68, 0.72, 0.04],
      palette.upper,
    );
    rounded(
      root,
      [0.035, 0.035, 0.18],
      [side * 0.69, 0.95, -0.23],
      palette.trim,
      0.009,
    );
    rounded(
      root,
      [0.1, 0.04, 1.9],
      [side * 0.74, 1.015, -0.03],
      palette.upper,
      0.01,
    );
    // Low seats and rear head restraints give the mirror a real cabin to show.
    rounded(
      root,
      [0.49, 0.14, 0.58],
      [side * 0.37, 0.48, 0.47],
      palette.cloth,
      0.055,
    );
    rounded(
      root,
      [0.49, 0.56, 0.14],
      [side * 0.37, 0.8, 0.8],
      palette.cloth,
      0.05,
    );
    rounded(
      root,
      [0.24, 0.19, 0.1],
      [side * 0.37, 1.18, 0.86],
      palette.cloth,
      0.04,
    );
    beam(
      [side * 0.7, 1.07, 1.65],
      [side * 0.66, 1.82, 1.03],
      0.055,
      palette.headliner,
    );
  }
  rounded(root, [1.45, 0.08, 1.69], [0, 1.87, 0.25], palette.headliner);
  beam([-0.68, 1.83, -0.59], [0.68, 1.83, -0.59], 0.045, palette.headliner);
  rounded(root, [1.4, 0.18, 0.5], [0, 0.64, 1.33], palette.cloth, 0.055);
  rounded(root, [1.4, 0.45, 0.14], [0, 0.94, 1.59], palette.cloth, 0.045);
  rounded(root, [1.4, 0.06, 0.37], [0, 1.14, 1.75], palette.upper);
  rounded(root, [1.4, 0.05, 2.6], [0, 0.32, 0.1], palette.black);

  function vent(x: number, width: number) {
    rounded(
      root,
      [width, 0.105, 0.045],
      [x, 1.035, -0.515],
      palette.black,
      0.018,
    );
    for (let i = -2; i <= 2; i++)
      rounded(
        root,
        [width - 0.025, 0.006, 0.018],
        [x, 1.035 + i * 0.016, -0.487],
        palette.lower,
        0.002,
      );
    rounded(
      root,
      [0.025, 0.015, 0.024],
      [x, 1.035, -0.477],
      palette.trim,
      0.004,
    );
  }
  vent(-0.64, 0.14);
  vent(0.15, 0.22);
  vent(0.57, 0.22);

  // Center stack: recessed screen, hazard key, physical climate knobs and gear selector.
  rounded(root, [0.28, 0.37, 0.14], [0.13, 0.77, -0.54], palette.upper, 0.035);
  const centerScreen = rounded(
    root,
    [0.235, 0.12, 0.012],
    [0.13, 0.86, -0.461],
    palette.black,
    0.01,
  );
  centerScreen.name = "center-display";
  for (let i = 0; i < 3; i++)
    rounded(
      root,
      [0.115 - i * 0.018, 0.008, 0.003],
      [0.12, 0.89 - i * 0.025, -0.453],
      palette.trim,
      0.002,
    );
  const hazard = new THREE.Mesh(
    new THREE.ConeGeometry(0.017, 0.027, 3),
    new THREE.MeshStandardMaterial({ color: "#b86150" }),
  );
  hazard.position.set(0.13, 0.985, -0.48);
  root.add(hazard);
  for (const x of [0.05, 0.21]) {
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.031, 0.031, 0.035, 20),
      palette.trim,
    );
    knob.rotation.x = Math.PI / 2;
    knob.position.set(x, 0.72, -0.445);
    root.add(knob);
    rounded(
      root,
      [0.006, 0.018, 0.008],
      [x, 0.735, -0.424],
      palette.black,
      0.002,
    );
  }
  rounded(root, [0.27, 0.23, 0.9], [0.12, 0.45, 0.05], palette.upper, 0.04);
  rounded(root, [0.14, 0.025, 0.23], [0.12, 0.58, -0.19], palette.trim, 0.025);
  beam([0.12, 0.59, -0.19], [0.12, 0.75, -0.22], 0.015, palette.black);
  rounded(root, [0.065, 0.08, 0.085], [0.12, 0.75, -0.22], palette.upper);

  // Wheel tilt and wheel rotation are separate so steering turns in its own plane.
  const wheelMount = new THREE.Group();
  wheelMount.position.set(-0.38, 1.02, -0.42);
  wheelMount.rotation.x = -0.3;
  root.add(wheelMount);
  beam([-0.38, 0.95, -0.74], [-0.38, 1.02, -0.42], 0.045, palette.black);
  const wheel = new THREE.Group();
  wheel.name = "steering-wheel";
  wheelMount.add(wheel);
  wheel.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.022, 12, 64),
      palette.black,
    ),
  );
  for (const side of [-1, 1]) {
    const spoke = rounded(
      wheel,
      [0.17, 0.047, 0.025],
      [side * 0.11, -0.018, 0],
      palette.lower,
      0.012,
    );
    spoke.rotation.z = side * 0.17;
    rounded(
      wheel,
      [0.042, 0.015, 0.007],
      [side * 0.122, -0.01, 0.018],
      palette.trim,
      0.003,
    );
  }
  rounded(wheel, [0.065, 0.15, 0.025], [0, -0.1, 0], palette.lower, 0.018);
  rounded(wheel, [0.16, 0.11, 0.055], [0, 0, 0.018], palette.upper, 0.035);
  const emblem = new THREE.Mesh(
    new THREE.RingGeometry(0.019, 0.023, 24),
    palette.trim,
  );
  emblem.position.z = 0.048;
  wheel.add(emblem);
  for (const side of [-1, 1]) {
    beam(
      [-0.38 + side * 0.065, 1.035, -0.52],
      [-0.38 + side * 0.25, 1.06, -0.52],
      0.011,
      palette.black,
    );
    rounded(
      root,
      [0.055, 0.026, 0.033],
      [-0.38 + side * 0.25, 1.06, -0.52],
      palette.upper,
      0.01,
    );
  }
  const instruments = createInstruments();
  root.add(instruments.root);

  // One actual planar reflection, updated by Three only while this view renders.
  const mirrorMount = new THREE.Group();
  mirrorMount.position.set(0.1, 1.64, -0.7);
  mirrorMount.rotation.set(0.08, -0.2, 0);
  root.add(mirrorMount);
  beam([0.1, 1.82, -0.6], [0.1, 1.65, -0.71], 0.014, palette.black);
  rounded(mirrorMount, [0.31, 0.125, 0.035], [0, 0, 0], palette.black, 0.025);
  const mirror = new Reflector(new THREE.PlaneGeometry(0.273, 0.09), {
    textureWidth: 512,
    textureHeight: 256,
    color: 0xd4ded9,
    clipBias: 0.003,
    multisample: 0,
  });
  mirror.name = "rear-view-mirror";
  mirror.position.z = 0.02;
  mirrorMount.add(mirror);
  const eye = new THREE.Object3D();
  eye.name = "driver-eye";
  eye.position.copy(DRIVER_EYE);
  root.add(eye);

  return {
    root,
    eye,
    wheel,
    mirror,
    update(
      vehicle: Vehicle,
      indicator: number,
      time: number,
      driving: boolean,
      turning: boolean,
    ) {
      root.position.set(vehicle.x, 0.04, vehicle.z);
      root.rotation.y = -vehicle.yaw;
      wheel.rotation.z = -vehicle.steering * 5;
      instruments.update(vehicle.speed, indicator, time, driving, turning);
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh && object !== mirror) {
          geometries.add(object.geometry);
          for (const mat of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(mat);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      instruments.texture.dispose();
      mirror.geometry.dispose();
      mirror.dispose();
    },
  };
}
