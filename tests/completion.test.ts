// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import type { Session } from "../src/domain/session";
import { followTurn } from "./helpers/turn-driver";

const scene = vi.hoisted(() => ({
  render: vi.fn(),
  setCamera: vi.fn(),
  setRoute: vi.fn(),
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
