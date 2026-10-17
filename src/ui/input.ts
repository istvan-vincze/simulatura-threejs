import type { Controls } from "../domain/vehicle";
export function createInput(onShortcut: (key: string) => void) {
  const keys = new Set<string>();
  const drivingKeys = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "Space",
  ];
  window.addEventListener("keydown", (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (
      drivingKeys.includes(e.code) &&
      !(e.code === "Space" && e.target instanceof HTMLButtonElement)
    ) {
      e.preventDefault();
      keys.add(e.code);
    }
    if (!e.repeat) onShortcut(e.code);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
  const touch = new Set<string>();
  document
    .querySelectorAll<HTMLButtonElement>("[data-control]")
    .forEach((button) => {
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        touch.add(button.dataset.control!);
      });
      const release = () => touch.delete(button.dataset.control!);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });
  return {
    clear() {
      keys.clear();
      touch.clear();
    },
    read(): Controls {
      return {
        throttle:
          keys.has("ArrowUp") || keys.has("KeyW") || touch.has("throttle")
            ? 1
            : 0,
        brake:
          keys.has("ArrowDown") ||
          keys.has("KeyS") ||
          keys.has("Space") ||
          touch.has("brake")
            ? 1
            : 0,
        steer:
          Number(
            keys.has("ArrowRight") || keys.has("KeyD") || touch.has("right"),
          ) -
          Number(
            keys.has("ArrowLeft") || keys.has("KeyA") || touch.has("left"),
          ),
      };
    },
  };
}
