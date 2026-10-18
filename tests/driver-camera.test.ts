// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { createScene } from "../src/scene/scene";
import { createSession } from "../src/domain/session";
import { DRIVER_FOV } from "../src/scene/cockpit";
import { loadLocalCockpit } from "./cockpit-asset";

const render = vi.hoisted(() => vi.fn());
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      shadowMap = {};
      setPixelRatio() {}
      setSize() {}
      render = render;
      dispose() {}
    },
  };
});

it("switches between exterior and cockpit cameras, supports looking around, and recenters", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    new Proxy({}, { get: () => () => {} }) as CanvasRenderingContext2D,
  );
  const container = document.createElement("div");
  document.body.append(container);
  loadLocalCockpit();
  const world = await createScene(container);
  const session = createSession("left-turn");
  session.player.yaw = -Math.PI / 2;
  const draw = () => world.render(session, false, -1, 1 / 60);
  world.setCamera("driver");
  draw();
  const [scene, camera] = render.mock.lastCall as [
    THREE.Scene,
    THREE.PerspectiveCamera,
  ];
  const cockpit = scene.getObjectByName("driver-cockpit")!;
  expect(cockpit.visible).toBe(true);
  expect(camera.fov).toBe(DRIVER_FOV);
  expect(camera.near).toBe(0.025);
  expect(camera.getWorldDirection(new THREE.Vector3()).x).toBeLessThan(-0.98);
  const eye = cockpit
    .getObjectByName("driver-eye")!
    .getWorldPosition(new THREE.Vector3());
  expect(camera.position.distanceTo(eye)).toBeLessThan(1e-6);
  const centered = camera.quaternion.clone();
  const canvas = container.querySelector("canvas")!;
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn(() => true);
  canvas.releasePointerCapture = vi.fn();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 200,
      clientY: 200,
    }),
  );
  canvas.dispatchEvent(
    new PointerEvent("pointermove", {
      pointerId: 1,
      clientX: 350,
      clientY: 230,
    }),
  );
  draw();
  expect(camera.quaternion.angleTo(centered)).toBeGreaterThan(0.5);
  world.centerLook();
  draw();
  expect(camera.quaternion.angleTo(centered)).toBeLessThan(1e-6);
  world.setCamera("follow");
  draw();
  expect(cockpit.visible).toBe(false);
  expect(camera.fov).toBe(43);
  expect(camera.near).toBe(0.1);
  expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
  world.setCamera("driver");
  draw();
  expect(camera.quaternion.angleTo(centered)).toBeLessThan(1e-6);
  world.dispose();
  container.remove();
  vi.restoreAllMocks();
});
