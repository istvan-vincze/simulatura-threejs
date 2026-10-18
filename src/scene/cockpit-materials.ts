import * as THREE from "three";

/** Small local maps keep the authored model self-contained, with no asset CDN. */
export function finishCockpitMaterials(root: THREE.Object3D) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 1729;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const height = 90 + ((seed >>> 24) % 80);
    data.set([height, height, height, 255], i * 4);
  }
  const grain = new THREE.DataTexture(data, size, size);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(9, 9);
  grain.magFilter = THREE.LinearFilter;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.needsUpdate = true;

  // Soft daylight reflections for the cabin's metal/glass. Applying this only
  // to its materials leaves the town's established lighting unchanged.
  const width = 128,
    height = 64;
  const radiance = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sky = Math.max(0, -Math.cos((y / (height - 1)) * Math.PI));
    for (let x = 0; x < width; x++) {
      const window =
        Math.exp(-(((y / height - 0.62) / 0.13) ** 2)) *
        (0.35 + 0.65 * Math.cos((x / width) * Math.PI * 4) ** 12);
      radiance.set(
        [
          0.07 + sky * 0.46 + window * 0.6,
          0.08 + sky * 0.53 + window * 0.64,
          0.09 + sky * 0.6 + window * 0.68,
          1,
        ],
        (y * width + x) * 4,
      );
    }
  }
  const environment = new THREE.DataTexture(
    radiance,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.needsUpdate = true;
  const materials = new Set<THREE.MeshStandardMaterial>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    for (const mat of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (!(mat instanceof THREE.MeshStandardMaterial) || materials.has(mat))
        continue;
      materials.add(mat);
      mat.envMap = environment;
      mat.envMapIntensity = 0.5;
      if (/Grained plastic|Leather|Woven fabric|Headliner/.test(mat.name)) {
        mat.bumpMap = grain;
        mat.bumpScale = mat.name === "Leather" ? 0.00045 : 0.0003;
      }
    }
  });
  return {
    dispose() {
      grain.dispose();
      environment.dispose();
    },
  };
}
