// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { createMapScene } from "../src/scene/map";
import { zuglo, mapSpawn } from "../src/domain/driving-map";

it("builds batched, finite map geometry and renders the same carriageway used by driving", () => {
  const context = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      fillText() {},
      beginPath() {},
      closePath() {},
      arc() {},
      fill() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
    } as unknown as CanvasRenderingContext2D);
  try {
    const scene = createMapScene(zuglo);
    scene.root.updateMatrixWorld(true);
    let meshes = 0,
      windows = 0;
    scene.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      meshes++;
      if (o.name.startsWith("map-sign-")) {
        expect((o.material as THREE.Material).side).toBe(THREE.FrontSide);
        const yaw = o.userData.approachYaw as number;
        const normal = new THREE.Vector3(0, 0, 1).transformDirection(
          o.matrixWorld,
        );
        expect(
          normal.dot(new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw))),
        ).toBeCloseTo(-1);
      }
      const positions = o.geometry.getAttribute("position");
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      if (o instanceof THREE.InstancedMesh) windows += o.count;
    });
    expect(scene.root.getObjectByName("map-sign-yield")).toBeDefined();
    expect(meshes).toBeLessThan(150); // Hundreds of buildings do not become thousands of draw calls.
    expect(windows).toBeGreaterThan(1000);
    const spawn = mapSpawn(zuglo);
    const hits = new THREE.Raycaster(
      new THREE.Vector3(spawn.x, 1, spawn.z),
      new THREE.Vector3(0, -1, 0),
    ).intersectObject(scene.root, true);
    expect(hits[0].point.y).toBeCloseTo(0.04);
    const disposals: THREE.BufferGeometry[] = [];
    scene.root.traverse((o) => {
      if (o instanceof THREE.Mesh)
        o.geometry.addEventListener("dispose", () =>
          disposals.push(o.geometry),
        );
    });
    scene.dispose();
    expect(disposals.length).toBe(meshes);
  } finally {
    context.mockRestore();
  }
});
