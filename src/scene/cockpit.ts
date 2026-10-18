import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { createInstruments } from "./cockpit-instruments";
import { finishCockpitMaterials } from "./cockpit-materials";
import type { Vehicle } from "../domain/vehicle";

export const DRIVER_EYE = new THREE.Vector3(-0.38, 1.46, 0.42);
export const DRIVER_FOV = 68;
export const DRIVER_PITCH = -0.14;

export async function createCockpit() {
  const asset = await new GLTFLoader().loadAsync(
    new URL("./assets/cockpit/interior.glb", import.meta.url).href,
  );
  const root = asset.scene;
  root.name = "driver-cockpit";
  // These anchors are exported by scripts/build-cockpit.py. Never silently
  // animate the wrong mesh if the authored model's structure changes.
  function anchor(name: string) {
    const node = root.getObjectByName(name);
    if (!node) throw new Error(`Cockpit asset is missing ${name}`);
    return node;
  }
  const wheel = anchor("steering-wheel");
  const mirrorMount = anchor("mirror-mount");
  const instruments = createInstruments();
  anchor("instrument-mount").add(instruments.root);
  const finish = finishCockpitMaterials(root);

  // One actual planar reflection, updated only while the driver view renders.
  const mirror = new Reflector(new THREE.PlaneGeometry(0.273, 0.09), {
    textureWidth: 512,
    textureHeight: 256,
    color: 0xd4ded9,
    clipBias: 0.003,
    multisample: 0,
  });
  mirror.name = "rear-view-mirror";
  mirror.position.z = 0.023;
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
      freeRoam?: { direction: 1 | -1 },
    ) {
      root.position.set(vehicle.x, 0.04, vehicle.z);
      root.rotation.y = -vehicle.yaw;
      wheel.rotation.z = -vehicle.steering * 5;
      instruments.update(
        vehicle.speed,
        indicator,
        time,
        driving,
        turning,
        freeRoam,
      );
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
      finish.dispose();
      mirror.geometry.dispose();
      mirror.dispose();
    },
  };
}
