// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import type { Session } from "../src/domain/session";

const scene = vi.hoisted(() => ({
  render: vi.fn(),
  setCamera: vi.fn(),
  setRoute: vi.fn(),
}));
vi.mock("../src/scene/scene", () => ({ createScene: () => scene }));

it("registers and saves lesson 2 after completing lesson 1 through application controls", async () => {
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
  expect(document.querySelector("#progress")!.textContent).toBe("1 / 3");
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
  expect(document.querySelector("#progress")!.textContent).toBe("2 / 3");
  expect(JSON.parse(localStorage.getItem("simulatura.progress.v1")!)).toEqual([
    "priority",
    "stop",
  ]);
  expect(document.querySelector(".completion-notice")!.textContent).toContain(
    "Teljesítve és elmentve · 2 / 3",
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
  expect(document.querySelector("#progress")!.textContent).toBe("3 / 3");
  expect(document.querySelector(".completion-notice")!.textContent).toContain(
    "a böngésző nem engedte menteni",
  );
  expect(JSON.parse(localStorage.getItem("simulatura.progress.v1")!)).toEqual([
    "priority",
    "stop",
  ]);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
