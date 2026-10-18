import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { DrivingMap, MapPolygon } from "../domain/driving-map";
import {
  connectedRoads,
  inRing,
  mapContains,
  pointAlong,
  roadLength,
} from "../domain/driving-map";
import type { MapPoint } from "../domain/road-network";
import { createRoof } from "./roof";

function shapeOf(polygon: MapPolygon) {
  const shape = new THREE.Shape(
    polygon.outer.map((p) => new THREE.Vector2(p.x, -p.z)),
  );
  for (const hole of polygon.holes)
    shape.holes.push(
      new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, -p.z))),
    );
  return shape;
}
/** One road surface with holes, shared with physics. No overlapping town tiles. */
export function createMapScene(map: DrivingMap) {
  const root = new THREE.Group();
  root.name = map.id;
  const ownedMaterials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  const palette = new Map<string, THREE.MeshStandardMaterial>();
  function mat(color: string) {
    if (!palette.has(color)) {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
      palette.set(color, m);
      ownedMaterials.add(m);
    }
    return palette.get(color)!;
  }
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  function add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrix?: THREE.Matrix4,
  ) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    g.deleteAttribute("uv");
    g.deleteAttribute("uv1");
    if (matrix) g.applyMatrix4(matrix);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    const list = batches.get(material) ?? [];
    list.push(g);
    batches.set(material, list);
  }
  const transform = new THREE.Object3D();
  function block(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
    yaw = 0,
  ) {
    transform.position.set(x, y, z);
    transform.rotation.set(0, yaw, 0);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    add(new THREE.BoxGeometry(w, h, d), mat(color), transform.matrix);
  }
  function surface(polygons: MapPolygon[], y: number, color: string) {
    for (const p of polygons) {
      const g = new THREE.ShapeGeometry(shapeOf(p));
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, 0);
      add(g, mat(color));
    }
  }
  const b = map.bounds;
  block(
    b.maxX - b.minX + 250,
    0.1,
    b.maxZ - b.minZ + 250,
    (b.minX + b.maxX) / 2,
    -0.08,
    (b.minZ + b.maxZ) / 2,
    "#879876",
  );
  surface(map.surface, 0.04, "#59605d");
  surface(map.sidewalks, 0.19, "#b9b9ac");
  // Curbs follow the union boundary, including the rounded corners of every junction.
  for (const p of map.surface)
    for (const ring of [p.outer, ...p.holes]) {
      const vertices: number[] = [];
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1],
          b = ring[i];
        vertices.push(
          a.x,
          0.04,
          a.z,
          b.x,
          0.04,
          b.z,
          b.x,
          0.19,
          b.z,
          a.x,
          0.04,
          a.z,
          b.x,
          0.19,
          b.z,
          a.x,
          0.19,
          a.z,
        );
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      const curb = mat("#d0cfc0");
      curb.side = THREE.DoubleSide;
      add(g, curb);
    }

  const windowMatrices: THREE.Matrix4[] = [],
    frameMatrices: THREE.Matrix4[] = [];
  const facadeColors = [
    "#d4c3a4",
    "#d1cdb7",
    "#cbb7a5",
    "#bac4b8",
    "#ded4bc",
    "#bdb7ae",
  ];
  const buildingBounds = map.buildings.map((building) => ({
    building,
    minX: Math.min(...building.points.map((p) => p.x)),
    maxX: Math.max(...building.points.map((p) => p.x)),
    minZ: Math.min(...building.points.map((p) => p.z)),
    maxZ: Math.max(...building.points.map((p) => p.z)),
  }));
  for (const building of map.buildings) {
    const ps = building.points.slice(0, -1),
      h = building.height;
    const color = facadeColors[Number(building.id) % facadeColors.length];
    const body = new THREE.ExtrudeGeometry(
      shapeOf({ outer: building.points, holes: [] }),
      { depth: h, bevelEnabled: false, steps: 1 },
    );
    body.rotateX(-Math.PI / 2);
    add(body, mat(color));
    // Simple quadrilateral footprints get the same properly pitched roof as
    // the lesson buildings. Complex courtyard blocks retain a flat roof.
    let rectangular = ps.length === 4;
    if (rectangular)
      for (let i = 0; i < 4; i++) {
        const a = ps[i],
          b = ps[(i + 1) % 4],
          c = ps[(i + 2) % 4];
        const dot = (b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z);
        if (
          Math.abs(dot) /
            (Math.hypot(b.x - a.x, b.z - a.z) *
              Math.hypot(c.x - b.x, c.z - b.z)) >
          0.06
        )
          rectangular = false;
      }
    if (rectangular && h < 13) {
      const a = ps[0],
        b = ps[1],
        c = ps[2];
      const roof = createRoof(
        Math.hypot(b.x - a.x, b.z - a.z),
        Math.hypot(c.x - b.x, c.z - b.z),
      );
      const holder = new THREE.Group();
      holder.position.set(
        ps.reduce((s, p) => s + p.x, 0) / 4,
        h,
        ps.reduce((s, p) => s + p.z, 0) / 4,
      );
      holder.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      holder.add(roof);
      holder.updateMatrixWorld(true);
      roof.traverse((o) => {
        if (o instanceof THREE.Mesh)
          add(o.geometry, o.material as THREE.Material, o.matrixWorld);
        // Tiny roof-course linework is omitted at neighbourhood scale.
        else if (o instanceof THREE.Line) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    } else
      surface([{ outer: building.points, holes: [] }], h + 0.025, "#777e74");
    const signedArea = ps.reduce(
      (sum, p, i) =>
        sum + p.x * ps[(i + 1) % ps.length].z - ps[(i + 1) % ps.length].x * p.z,
      0,
    );
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length],
        length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 2) continue;
      const yaw = -Math.atan2(b.z - a.z, b.x - a.x);
      const outward = signedArea > 0 ? -1 : 1;
      const nx = (-(b.z - a.z) / length) * outward,
        nz = ((b.x - a.x) / length) * outward;
      block(
        length,
        0.4,
        0.12,
        (a.x + b.x) / 2,
        0.2,
        (a.z + b.z) / 2,
        "#aaa895",
        yaw,
      );
      block(
        length,
        0.18,
        0.2,
        (a.x + b.x) / 2,
        h - 0.1,
        (a.z + b.z) / 2,
        "#e0d8c5",
        yaw,
      );
      if (!rectangular || h >= 13)
        block(
          length,
          0.3,
          0.22,
          (a.x + b.x) / 2,
          h + 0.15,
          (a.z + b.z) / 2,
          "#c9c8b8",
          yaw,
        );
      const columns = Math.max(1, Math.floor(length / 3)),
        floors = Math.max(1, Math.floor(h / 3.1));
      for (let floor = 0; floor < floors; floor++)
        for (let col = 0; col < columns; col++) {
          const t = (col + 0.5) / columns,
            x = a.x + (b.x - a.x) * t,
            z = a.z + (b.z - a.z) * t,
            y = 1.8 + floor * 3.1;
          transform.position.set(x + nx * 0.055, y, z + nz * 0.055);
          transform.rotation.set(0, yaw, 0);
          transform.scale.set(1.28, 1.5, 0.12);
          transform.updateMatrix();
          frameMatrices.push(transform.matrix.clone());
          transform.position.set(x + nx * 0.13, y, z + nz * 0.13);
          transform.scale.set(1.05, 1.28, 0.08);
          transform.updateMatrix();
          windowMatrices.push(transform.matrix.clone());
        }
    }
  }
  function instances(
    geometry: THREE.BufferGeometry,
    color: string,
    matrices: THREE.Matrix4[],
  ) {
    const m = new THREE.InstancedMesh(geometry, mat(color), matrices.length);
    matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix));
    m.castShadow = true;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    root.add(m);
  }
  instances(new THREE.BoxGeometry(1, 1, 1), "#ded9c9", frameMatrices);
  instances(new THREE.BoxGeometry(1, 1, 1), "#496465", windowMatrices);

  // Seeded landscaping: real footprints and streets stay fixed across visits.
  let seed = 141014;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }
  const trunks: THREE.Matrix4[] = [],
    crowns: THREE.Matrix4[] = [];
  function clear(p: MapPoint) {
    return (
      !mapContains(map, p) &&
      !buildingBounds.some(
        (b) =>
          p.x > b.minX - 3 &&
          p.x < b.maxX + 3 &&
          p.z > b.minZ - 3 &&
          p.z < b.maxZ + 3,
      )
    );
  }
  for (const road of map.roads) {
    const length = roadLength(road);
    for (let d = 18; d < length - 15; d += 18 + random() * 8) {
      const p = pointAlong(road.points, d),
        side = random() > 0.5 ? 1 : -1,
        offset = road.width / 2 + 4 + random() * 2;
      const x = p.x + Math.cos(p.yaw) * offset * side,
        z = p.z + Math.sin(p.yaw) * offset * side;
      if (!clear({ x, z })) continue;
      const size = 0.85 + random() * 0.45;
      transform.position.set(x, 1.8 * size, z);
      transform.rotation.set(0, 0, 0);
      transform.scale.set(0.13 * size, 3.6 * size, 0.13 * size);
      transform.updateMatrix();
      trunks.push(transform.matrix.clone());
      transform.position.set(x, 4.2 * size, z);
      transform.scale.set(1.9 * size, 2.3 * size, 1.7 * size);
      transform.updateMatrix();
      crowns.push(transform.matrix.clone());
    }
    for (let d = 25; d < length - 15; d += 60) {
      const p = pointAlong(road.points, d),
        offset = road.width / 2 + 1.5;
      const x = p.x + Math.cos(p.yaw) * offset,
        z = p.z + Math.sin(p.yaw) * offset;
      block(0.12, 6, 0.12, x, 3, z, "#626e68");
      block(
        1.2,
        0.14,
        0.4,
        x - Math.cos(p.yaw) * 0.5,
        6,
        z - Math.sin(p.yaw) * 0.5,
        "#d1d0bd",
        -p.yaw,
      );
    }
  }
  instances(new THREE.CylinderGeometry(1, 1, 1, 7), "#7a7060", trunks);
  instances(new THREE.IcosahedronGeometry(1, 1), "#597b54", crowns);

  const signMaterials = new Map<string, THREE.MeshStandardMaterial>();
  function signTexture(kind: string, text: string) {
    const key = kind + text;
    if (signMaterials.has(key)) return signMaterials.get(key)!;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const c = canvas.getContext("2d")!;
    c.clearRect(0, 0, 512, 256);
    if (kind === "entry") {
      c.fillStyle = "#cf3433";
      c.beginPath();
      c.arc(256, 128, 116, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      c.fillRect(170, 104, 172, 48);
    } else if (kind === "yield") {
      c.fillStyle = "#cc3836";
      c.beginPath();
      c.moveTo(128, 16);
      c.lineTo(384, 16);
      c.lineTo(256, 240);
      c.closePath();
      c.fill();
      c.fillStyle = "#fff9e9";
      c.beginPath();
      c.moveTo(164, 37);
      c.lineTo(348, 37);
      c.lineTo(256, 198);
      c.closePath();
      c.fill();
    } else if (kind === "turn") {
      c.fillStyle = "#2266a5";
      c.beginPath();
      c.arc(256, 128, 116, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#fff";
      c.lineWidth = 25;
      c.beginPath();
      c.moveTo(224, 202);
      c.lineTo(224, 100);
      c.lineTo(310, 100);
      c.stroke();
      c.fillStyle = "#fff";
      c.beginPath();
      c.moveTo(340, 100);
      c.lineTo(285, 55);
      c.lineTo(285, 145);
      c.fill();
    } else {
      c.fillStyle = kind === "oneway" ? "#24669c" : "#eee9d9";
      c.fillRect(4, 4, 504, 248);
      c.strokeStyle = kind === "oneway" ? "#fff" : "#42564e";
      c.lineWidth = 8;
      c.strokeRect(10, 10, 492, 236);
      c.fillStyle = kind === "oneway" ? "#fff" : "#2c453b";
      c.font = kind === "oneway" ? "bold 200px Arial" : "600 52px Arial";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, 256, 130, 460);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const m = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      side: THREE.FrontSide,
      roughness: 0.85,
    });
    ownedMaterials.add(m);
    signMaterials.set(key, m);
    return m;
  }
  function sign(p: MapPoint, yaw: number, kind: string, text: string) {
    const width = kind === "street" ? 2.6 : kind === "edge" ? 2.2 : 1.4,
      height = kind === "street" || kind === "edge" ? 0.62 : 0.7;
    block(0.065, 2.55, 0.065, p.x, 1.275, p.z, "#8e9991");
    transform.position.set(p.x, 2.35, p.z);
    transform.rotation.set(0, -yaw, 0);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    // Signs use a separate UV-preserving mesh; batch strips UVs from solid geometry.
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      signTexture(kind, text),
    );
    m.name = `map-sign-${kind}`;
    m.userData.approachYaw = yaw;
    m.position.copy(transform.position);
    m.rotation.copy(transform.rotation);
    root.add(m);
    // The rear is plain metal: a one-way arrow must not be visible in reverse.
    transform.position.set(
      p.x + Math.sin(yaw) * 0.015,
      2.35,
      p.z - Math.cos(yaw) * 0.015,
    );
    transform.rotation.set(0, -yaw + Math.PI, 0);
    transform.updateMatrix();
    add(
      kind === "yield"
        ? new THREE.ShapeGeometry(
            new THREE.Shape([
              new THREE.Vector2(-0.35, 0.306),
              new THREE.Vector2(0.35, 0.306),
              new THREE.Vector2(0, -0.306),
            ]),
          )
        : kind === "entry" || kind === "turn"
          ? new THREE.CircleGeometry(0.318, 32)
          : new THREE.PlaneGeometry(width, height),
      mat("#939d98"),
      transform.matrix,
    );
  }
  for (const road of map.roads) {
    const length = roadLength(road);
    if (length < 18) continue;
    const p = pointAlong(road.points, Math.min(13, length / 3)),
      offset = road.width / 2 + 1.2;
    sign(
      { x: p.x + Math.cos(p.yaw) * offset, z: p.z + Math.sin(p.yaw) * offset },
      p.yaw,
      "street",
      road.name,
    );
    if (road.direction !== 0) {
      const forward = road.direction === 1,
        ps = forward ? road.points : [...road.points].reverse();
      const start = pointAlong(ps, 8),
        end = pointAlong(ps, length - 6);
      sign(
        {
          x: start.x + Math.cos(start.yaw) * offset,
          z: start.z + Math.sin(start.yaw) * offset,
        },
        start.yaw,
        "oneway",
        "↑",
      );
      sign(
        {
          x: end.x - Math.cos(end.yaw) * offset,
          z: end.z - Math.sin(end.yaw) * offset,
        },
        end.yaw + Math.PI,
        "entry",
        "",
      );
    }
  }
  for (const control of map.importedControls) {
    if (control.kind !== "give_way" || control.yaw === null) continue;
    const road = map.roads.find((r) => r.osmWay === control.roadWay);
    if (!road) continue;
    const yaw = control.yaw,
      offset = road.width / 2 + 1;
    sign(
      {
        x: control.x + Math.cos(yaw) * offset,
        z: control.z + Math.sin(yaw) * offset,
      },
      yaw,
      "yield",
      "",
    );
  }
  for (const r of map.restrictions) {
    const road = map.roads.find(
      (road) =>
        road.osmWay === r.fromWay && (road.from === r.via || road.to === r.via),
    );
    if (!road) continue;
    const ps = road.to === r.via ? road.points : [...road.points].reverse();
    const p = pointAlong(ps, Math.max(0, roadLength(road) - 8)),
      offset = road.width / 2 + 1;
    // This snapshot's two mandatory-right turns and one straight-on ban all
    // allow a right turn; the latter is shown explicitly as text, not mislabelled mandatory.
    sign(
      { x: p.x + Math.cos(p.yaw) * offset, z: p.z + Math.sin(p.yaw) * offset },
      p.yaw,
      r.kind === "only_right_turn" ? "turn" : "street",
      r.kind === "no_straight_on" ? "Egyenesen tilos" : "",
    );
  }
  for (const n of map.nodes) {
    const roads = connectedRoads(map, n.id);
    if (roads.length !== 1) continue;
    const road = roads[0],
      ps = road.to === n.id ? road.points : [...road.points].reverse();
    const p = pointAlong(ps, roadLength(road) - 0.5),
      yaw = p.yaw;
    block(road.width, 0.22, 0.18, p.x, 1.0, p.z, "#e4dfcc", -yaw);
    for (let i = -road.width / 2 + 0.4; i < road.width / 2; i += 0.8)
      block(
        0.4,
        0.23,
        0.19,
        p.x + Math.cos(yaw) * i,
        1,
        p.z + Math.sin(yaw) * i,
        "#bd5143",
        -yaw,
      );
    for (const side of [-1, 1])
      block(
        0.15,
        1.1,
        0.15,
        p.x + Math.cos(yaw) * road.width * 0.4 * side,
        0.55,
        p.z + Math.sin(yaw) * road.width * 0.4 * side,
        "#777e74",
      );
    sign(
      {
        x: p.x + Math.cos(yaw) * (road.width / 2 + 1),
        z: p.z + Math.sin(yaw) * (road.width / 2 + 1),
      },
      yaw,
      "edge",
      "Pálya vége",
    );
  }
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!geometry) throw new Error("Unable to batch map geometry");
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  return {
    root,
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      ownedMaterials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
