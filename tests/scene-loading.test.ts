// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

const createScene = vi.hoisted(() => vi.fn());
vi.mock("../src/scene/scene", () => ({ createScene }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("shows loading while the model is pending and a reload message if it fails", async () => {
  document.body.innerHTML = '<div id="app"></div>';
  let fail!: (error: Error) => void;
  createScene.mockReturnValue(
    new Promise((_, reject) => {
      fail = reject;
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const boot = import("../src/main");
  await vi.waitFor(() => {
    expect(
      document.querySelector('.render-error[role="status"]')?.textContent,
    ).toBe("A gyakorlópálya betöltése…");
  });
  fail(new Error("Cockpit asset could not be loaded"));
  await boot;
  expect(document.querySelector('.render-error[role="status"]')).toBeNull();
  expect(document.querySelector(".render-error")?.textContent).toContain(
    "Töltsd újra az oldalt.",
  );
});
