// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  createCockpit,
  DRIVER_EYE,
  DRIVER_FOV,
  DRIVER_PITCH,
} from "../src/scene/cockpit";
import { createInstruments } from "../src/scene/cockpit-instruments";
import { loadLocalCockpit } from "./cockpit-asset";

function canvasContext() {
  const fillText = vi.fn();
  const context = new Proxy(
    { fillText },
    {
      get(target, key) {
        return key in target ? target[key as keyof typeof target] : () => {};
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return { fillText };
}
afterEach(() => vi.restoreAllMocks());

it("attaches the left-seat eye and wheel to the vehicle and leaves the forward sightline clear", async () => {
  canvasContext();
  loadLocalCockpit();
  const cockpit = await createCockpit();
  for (const yaw of [0, -Math.PI / 2, Math.PI / 2]) {
    cockpit.update(
      { x: 8, z: 12, yaw, steering: -0.3, speed: 2 },
      -1,
      1,
      true,
      true,
    );
    cockpit.root.updateMatrixWorld(true);
    const expectedEye = DRIVER_EYE.clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw)
      .add(new THREE.Vector3(8, 0.04, 12));
    expect(
      cockpit.eye.getWorldPosition(new THREE.Vector3()).distanceTo(expectedEye),
    ).toBeLessThan(1e-6);
    expect(cockpit.wheel.rotation.z).toBeCloseTo(1.5);
    const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const hits = new THREE.Raycaster(
      expectedEye,
      forward,
      0.03,
      5,
    ).intersectObject(cockpit.root);
    expect(hits).toHaveLength(0);
  }
  cockpit.update(
    { x: 0, z: 0, yaw: 0, steering: 0, speed: 0 },
    0,
    0,
    false,
    false,
  );
  cockpit.root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(DRIVER_FOV, 1.65, 0.025, 230);
  cockpit.eye.getWorldPosition(camera.position);
  camera.rotation.x = DRIVER_PITCH;
  camera.updateMatrixWorld(true);
  // Both indicator arrows remain visible above the rim from the driving eye.
  const screen = cockpit.root.getObjectByName("instrument-screen")!;
  for (const x of [0.033, 0.147]) {
    const arrow = screen.localToWorld(new THREE.Vector3(x, 0.082, 0));
    const hits = new THREE.Raycaster(
      camera.position,
      arrow.sub(camera.position).normalize(),
      0.025,
      3,
    ).intersectObject(cockpit.root);
    expect(hits[0]?.object).toBe(screen);
  }
  // The entire wheel stays in the default frame, without relying on HUD overlays.
  const bounds = new THREE.Box3().setFromObject(cockpit.wheel);
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(camera);
        expect(Math.abs(p.x)).toBeLessThan(1);
        expect(Math.abs(p.y)).toBeLessThan(1);
      }
  const dispose = vi.spyOn(cockpit.mirror.getRenderTarget(), "dispose");
  let leather: THREE.MeshStandardMaterial | undefined;
  cockpit.root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material.name === "Leather")
      leather = object.material;
  });
  const disposeGrain = vi.spyOn(leather!.bumpMap!, "dispose");
  const disposeEnvironment = vi.spyOn(leather!.envMap!, "dispose");
  cockpit.dispose();
  expect(dispose).toHaveBeenCalledOnce();
  expect(disposeGrain).toHaveBeenCalledOnce();
  expect(disposeEnvironment).toHaveBeenCalledOnce();
});

it("updates actual speed, gear, route and blink phase without redrawing unchanged instruments", () => {
  const { fillText } = canvasContext();
  const instruments = createInstruments();
  instruments.update(0.1, -1, 0, true, true);
  expect(fillText).toHaveBeenCalledWith("0.4", 675, 196);
  expect(fillText).toHaveBeenCalledWith("D", 850, 208);
  expect(fillText).toHaveBeenCalledWith("BALRA KANYARODÁS", 694, 343);
  const litVersion = instruments.texture.version;
  instruments.update(0.1, -1, 0.1, true, true);
  expect(instruments.texture.version).toBe(litVersion);
  instruments.update(0.1, -1, 0.5, true, true);
  expect(instruments.texture.version).toBeGreaterThan(litVersion);
  instruments.update(0, 0, 1, false, false);
  expect(fillText).toHaveBeenCalledWith("0", 675, 196);
  expect(fillText).toHaveBeenCalledWith("P", 850, 208);
  expect(fillText).toHaveBeenCalledWith("EGYENESEN TOVÁBB", 694, 343);
  instruments.texture.dispose();
});
