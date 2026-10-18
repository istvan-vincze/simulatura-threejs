// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import type { Session } from "../src/domain/session";
import type { FreeRoam } from "../src/domain/free-roam";
import { followTurn } from "./helpers/turn-driver";

const scene = vi.hoisted(() => ({
  render: vi.fn(),
  setCamera: vi.fn(),
  setRoute: vi.fn(),
  centerLook: vi.fn(),
}));
vi.mock("../src/scene/scene", () => ({ createScene: () => scene }));

it("tracks all four lessons through application controls, including blocked storage and turn signals", async () => {
  document.body.innerHTML = '<div id="app"></div>';
  localStorage.clear();
  let nextFrame: FrameRequestCallback;
  let now = 0;
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  await import("../src/main");
  const step = () => {
    now += 1000 / 60;
    nextFrame(now);
  };
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) step();
  };
  const click = (selector: string) =>
    document.querySelector<HTMLButtonElement>(selector)!.click();
  const key = (code: string, down: boolean) =>
    window.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }),
    );
  const current = () => scene.render.mock.lastCall![0] as Session;
  click('[data-answer="1"]');
  click("#start");
  run(8);
  key("KeyW", true);
  run(3);
  key("KeyW", false);
  run(10);
  expect(document.querySelector("#lesson-panel")!.textContent).toContain(
    "SIKERES GYAKORLAT",
  );
  expect(document.querySelector("#progress")!.textContent).toBe("1 / 4");
  click("#next");
  click('[data-answer="2"]');
  click("#start");
  step();
  // Approach from the real spawn; brake before the line rather than teleporting the car.
  key("KeyW", true);
  for (let i = 0; i < 600; i++) {
    const s = current();
    if (s.player.z - 2.2 <= 11 + s.player.speed ** 2 / 16) break;
    step();
  }
  key("KeyW", false);
  key("KeyS", true);
  run(2);
  key("KeyS", false);
  expect(current().stopped).toBe(true);
  run(8);
  key("KeyW", true);
  run(3);
  key("KeyW", false);
  run(10);
  expect(document.querySelector("#lesson-panel")!.textContent).toContain(
    "SIKERES GYAKORLAT",
  );
  expect(document.querySelector('[data-status="stop"]')!.textContent).toBe("✓");
  expect(document.querySelector("#progress")!.textContent).toBe("2 / 4");
  expect(JSON.parse(localStorage.getItem("simulatura.progress.v1")!)).toEqual([
    "priority",
    "stop",
  ]);
  expect(document.querySelector(".completion-notice")!.textContent).toContain(
    "Teljesítve és elmentve · 2 / 4",
  );
  click('[data-scenario="priority"]');
  click('[data-scenario="stop"]');
  expect(document.querySelector('[data-status="stop"]')!.textContent).toBe("✓");
  // A blocked storage write must remain visible instead of pretending the result was saved.
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new DOMException("Storage blocked", "SecurityError");
  });
  click('[data-scenario="signals"]');
  click('[data-answer="0"]');
  click("#start");
  run(10.1);
  key("KeyW", true);
  run(3);
  key("KeyW", false);
  run(10);
  expect(document.querySelector("#progress")!.textContent).toBe("3 / 4");
  expect(document.querySelector(".completion-notice")!.textContent).toContain(
    "a böngésző nem engedte menteni",
  );
  expect(JSON.parse(localStorage.getItem("simulatura.progress.v1")!)).toEqual([
    "priority",
    "stop",
  ]);
  vi.mocked(localStorage.setItem).mockRestore();
  click("#next");
  expect(
    document
      .querySelector('[data-scenario="left-turn"]')!
      .getAttribute("aria-current"),
  ).toBe("true");
  click('[data-answer="0"]');
  click("#start");
  click('[data-indicator="-1"]');
  run(9);
  expect(
    document
      .querySelector('[data-indicator="-1"]')!
      .getAttribute("aria-pressed"),
  ).toBe("true");
  let steeringDebt = 0;
  for (let i = 0; i < 45 * 60 && current().stage === "drive"; i++) {
    const controls = followTurn(current());
    // Pulse keyboard steering to exercise the real input path, including its
    // steering smoothing; no direct mutation of the running session.
    steeringDebt += controls.steer;
    const steer = steeringDebt < -0.5 ? -1 : steeringDebt > 0.5 ? 1 : 0;
    steeringDebt -= steer;
    key("KeyW", controls.throttle > 0);
    key("KeyS", controls.brake > 0);
    key("KeyA", steer === -1);
    key("KeyD", steer === 1);
    step();
  }
  expect(current().events.filter((e) => e.severity === "error")).toEqual([]);
  expect(document.querySelector("#lesson-panel")!.textContent).toContain(
    "SIKERES GYAKORLAT",
  );
  expect(document.querySelector("#progress")!.textContent).toBe("4 / 4");
  expect(document.querySelector('[data-status="left-turn"]')!.textContent).toBe(
    "✓",
  );
  expect(JSON.parse(localStorage.getItem("simulatura.progress.v1")!)).toContain(
    "left-turn",
  );
  click("#retry");
  step();
  expect(current().turn.started).toBe(false);
  expect(
    document
      .querySelector('[data-indicator="-1"]')!
      .getAttribute("aria-pressed"),
  ).toBe("false");
  expect(document.querySelector('[data-status="left-turn"]')!.textContent).toBe(
    "✓",
  );
  click('[data-camera="driver"]');
  expect(
    document.querySelector(".simulation")!.classList.contains("driver-view"),
  ).toBe(true);
  click("#center-look");
  expect(scene.centerLook).toHaveBeenCalledOnce();
  click('[data-camera="follow"]');
  expect(
    document.querySelector(".simulation")!.classList.contains("driver-view"),
  ).toBe(false);

  // Free driving is entered without a quiz and cannot change lesson progress.
  const savedProgress = localStorage.getItem("simulatura.progress.v1");
  const currentFree = () => scene.render.mock.lastCall![0] as FreeRoam;
  click("#free-roam");
  step();
  expect(currentFree().mode).toBe("free");
  expect(document.querySelector("[data-answer]")).toBeNull();
  expect(document.querySelector("#finish")).toBeNull();
  expect(document.querySelector<HTMLButtonElement>("#route")!.hidden).toBe(
    true,
  );
  expect(scene.setRoute).toHaveBeenLastCalledWith(false);
  expect(currentFree().map?.id).toBe("zuglo-ujvidek-v1");
  expect(document.querySelector("#neighbourhood-map")).not.toBeNull();
  expect(document.querySelector(".map-attribution")!.textContent).toContain(
    "OpenStreetMap",
  );
  click("#free-new");
  step();
  expect(currentFree().map?.id).toBe("zuglo-ujvidek-v1");
  click("#free-practice");
  step();
  expect(currentFree().map).toBeNull();
  key("KeyW", true);
  run(18);
  key("KeyW", false);
  expect(currentFree().stage).toBe("drive");
  expect(currentFree().player.z).toBeLessThan(-35);
  expect(currentFree().evaluation.events.some((e) => e.code === "signal")).toBe(
    true,
  );
  expect(document.querySelector("#violation-count")!.textContent).toBe(
    String(currentFree().evaluation.total),
  );
  expect(localStorage.getItem("simulatura.progress.v1")).toBe(savedProgress);
  const count = currentFree().evaluation.total;
  click('[data-camera="driver"]');
  click("#direction");
  step();
  expect(currentFree().direction).toBe(-1);
  expect(document.querySelector("#gear")!.textContent).toBe("R");
  const end = currentFree().player.z;
  key("KeyW", true);
  run(1);
  key("KeyW", false);
  expect(currentFree().player.z).toBeGreaterThan(end);
  key("KeyX", true);
  key("KeyX", false);
  expect(currentFree().direction).toBe(-1); // Cannot shift while moving.
  key("KeyR", true);
  key("KeyR", false);
  step();
  expect(currentFree().player.z).toBe(26);
  expect(currentFree().evaluation.total).toBe(count);
  expect(currentFree().direction).toBe(1);
  window.dispatchEvent(new Event("blur"));
  const pausedTime = currentFree().elapsed;
  run(1);
  expect(currentFree().elapsed).toBe(pausedTime);
  click("#pause");
  run(1);
  expect(currentFree().elapsed).toBeGreaterThan(pausedTime);
  click('[data-layout="stop"]');
  step();
  expect(currentFree().scenario).toBe("stop");
  expect(currentFree().evaluation.total).toBe(0);
  click('[data-scenario="priority"]');
  step();
  expect(current().mode).toBe("lesson");
  expect(current().stage).toBe("observe");
  expect(scene.setRoute).toHaveBeenLastCalledWith(true);
  expect(document.querySelector<HTMLButtonElement>("#direction")!.hidden).toBe(
    true,
  );
  expect(document.querySelector("#progress")!.textContent).toBe("4 / 4");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
