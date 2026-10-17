// @vitest-environment happy-dom
import { expect, it } from "vitest";
import * as THREE from "three";
import { stopSign } from "../src/scene/stop-sign";

it("presents the printed front to approaching drivers and a solid metal back", () => {
  const sign = stopSign();
  sign.rotation.y = Math.PI; // South approach placement used by the town.
  sign.updateMatrixWorld(true);
  const front = sign.getObjectByName("stop-sign-face")!;
  const frontNormal = new THREE.Vector3(0, 0, 1).transformDirection(
    front.matrixWorld,
  );
  expect(frontNormal.z).toBeCloseTo(1);
  const cast = (z: number, direction: number) =>
    new THREE.Raycaster(
      new THREE.Vector3(0.3, 2.7, z),
      new THREE.Vector3(0, 0, direction),
    ).intersectObject(sign, true);
  expect(cast(3, -1)[0].object.name).toBe("sign-face-layer");
  expect(cast(-3, 1)[0].object.name).toBe("solid-octagonal-plate");
  const letters: THREE.Object3D[] = [];
  sign.traverse((o) => {
    if (o.name === "stop-letter") letters.push(o);
  });
  expect(letters).toHaveLength(4);
  for (const letter of letters)
    expect(((letter as THREE.Mesh).material as THREE.Material).side).toBe(
      THREE.FrontSide,
    );
});
