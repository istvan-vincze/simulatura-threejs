import * as THREE from "three";

const materials = new Map<string, THREE.MeshStandardMaterial>();
export function material(
  color: string,
  roughness = 0.8,
  metalness = 0,
): THREE.MeshStandardMaterial {
  const key = `${color}/${roughness}/${metalness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return materials.get(key)!;
}
export function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  pos: [number, number, number],
  color: string | THREE.Material,
): THREE.Mesh {
  return mesh(
    parent,
    new THREE.BoxGeometry(...size),
    typeof color === "string" ? material(color) : color,
    ...pos,
  );
}
export function cylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  pos: [number, number, number],
  color: string,
): THREE.Mesh {
  return mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, height, 12),
    material(color),
    ...pos,
  );
}
export function label(
  text: string,
  bg = "#f4f0e3",
  fg = "#293b36",
  width = 256,
  height = 96,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d")!;
  c.fillStyle = bg;
  c.fillRect(0, 0, width, height);
  c.fillStyle = fg;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `600 ${height * 0.43}px Arial`;
  c.fillText(text, width / 2, height / 2, width * 0.9);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function plaque(
  parent: THREE.Object3D,
  text: string,
  w: number,
  h: number,
  pos: [number, number, number],
  bg?: string,
  fg?: string,
): THREE.Mesh {
  return mesh(
    parent,
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: label(text, bg, fg),
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    ...pos,
  );
}
