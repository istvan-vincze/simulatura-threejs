export type Signal = "red" | "red-amber" | "green" | "amber";
// Interlocked phases include clearance time and the Hungarian red+amber phase.
const phases: readonly [number, Signal, Signal][] = [
  [6, "red", "green"],
  [2, "red", "amber"],
  [1, "red", "red"],
  [1, "red-amber", "red"],
  [12, "green", "red"],
  [3, "amber", "red"],
  [1, "red", "red"],
  [1, "red", "red-amber"],
];
export function signalsAt(elapsed: number): { ns: Signal; ew: Signal } {
  let t = ((elapsed % 27) + 27) % 27;
  for (const [duration, ns, ew] of phases) {
    if (t < duration) return { ns, ew };
    t -= duration;
  }
  return { ns: "red", ew: "red" };
}
