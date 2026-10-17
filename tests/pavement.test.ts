import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { isOnCarriageway } from "../src/domain/junction";
import { createPavement } from "../src/scene/pavement";

const pavement = createPavement();
pavement.updateMatrixWorld(true);
function height(x: number, z: number): number {
  const ray = new THREE.Raycaster(
    new THREE.Vector3(x, 10, z),
    new THREE.Vector3(0, -1, 0),
  );
  return ray.intersectObject(pavement)[0].point.y;
}

describe("junction surfaces", () => {
  it("matches the drivable boundary to the rounded curb in every quadrant", () => {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        for (const [x, z, road] of [
          [3.9, 18, true],
          [4.1, 4.1, true],
          [4.3, 4.3, true],
          [4.5, 4.5, false],
          [4.2, 5.1, false],
          [5.1, 4.2, false],
          [4.3, 12, false],
        ] as const) {
          expect(isOnCarriageway(sx * x, sz * z)).toBe(road);
          expect(height(sx * x, sz * z)).toBeCloseTo(road ? 0.04 : 0.2, 5);
        }
      }
  });

  it("lowers each zebra landing to the road and joins the raised sidewalk", () => {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        expect(height(sx * 4.001, sz * 7)).toBeCloseTo(0.04, 3);
        expect(height(sx * 5.2, sz * 7)).toBeCloseTo(0.12, 5);
        expect(height(sx * 6.4, sz * 7)).toBeCloseTo(0.2, 5);
        expect(height(sx * 4.1, sz * 9.2)).toBeCloseTo(0.2, 5);
        expect(height(sx * 7.2, sz * 4.1)).toBeCloseTo(0.2, 5);
      }
  });
});
