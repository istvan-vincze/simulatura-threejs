import { describe, expect, it } from "vitest";
import {
  ARMS,
  createEvaluation,
  evaluateDriving,
  mustYield,
} from "../src/domain/driving-evaluator";
import type {
  Arm,
  DrivingObservation,
  Evaluation,
  JunctionLayout,
} from "../src/domain/driving-evaluator";
import type { Vehicle } from "../src/domain/vehicle";

function pose(arm: Arm, distance: number, speed = 4): Vehicle {
  const a = ARMS[arm];
  return {
    x: a.x * distance + Math.cos(a.yaw) * 1.85,
    z: a.z * distance + Math.sin(a.yaw) * 1.85,
    yaw: a.yaw,
    speed,
    steering: 0,
  };
}
function observe(
  e: Evaluation,
  old: Vehicle,
  player: Vehicle,
  options: Partial<DrivingObservation> = {},
) {
  evaluateDriving(e, {
    previous: old,
    player,
    traffic: [],
    layout: "priority",
    elapsed: 2,
    previousTime: 1.9,
    indicator: 0,
    direction: 1,
    ...options,
  });
}
const codes = (e: Evaluation) => e.events.map((v) => v.code);

describe("route-independent approach evaluation", () => {
  it.each<Arm>(["south", "north", "east", "west"])(
    "checks the correct signal for the %s approach",
    (arm) => {
      const e = createEvaluation();
      const redTime = ARMS[arm].axis === "ns" ? 2 : 15;
      observe(e, pose(arm, 12.2), pose(arm, 11.8), {
        layout: "signals",
        elapsed: redTime,
        previousTime: redTime - 0.1,
      });
      expect(codes(e)).toEqual(["signal"]);
      expect(e.events[0].approach).toBe(arm);
      expect(e.events[0].position).toEqual(
        expect.objectContaining({ yaw: ARMS[arm].yaw }),
      );
      const green = createEvaluation();
      const greenTime = ARMS[arm].axis === "ns" ? 15 : 2;
      observe(green, pose(arm, 12.2), pose(arm, 11.8), {
        layout: "signals",
        elapsed: greenTime,
        previousTime: greenTime - 0.1,
      });
      expect(codes(green)).not.toContain("signal");
    },
  );
  it.each<Arm>(["south", "north", "east", "west"])(
    "checks STOP only on signed approaches: %s",
    (arm) => {
      const e = createEvaluation();
      observe(e, pose(arm, 12.2), pose(arm, 11.8), { layout: "stop" });
      expect(codes(e)).toEqual(ARMS[arm].axis === "ns" ? ["stop"] : []);
    },
  );
  it("accepts an actual stop, rejects rolling, and rearms on another visit", () => {
    const e = createEvaluation();
    observe(e, pose("south", 13, 0), pose("south", 13, 0), { layout: "stop" });
    observe(e, pose("south", 12.2), pose("south", 11.8), {
      layout: "stop",
      elapsed: 3,
    });
    expect(codes(e)).not.toContain("stop");
    const exit = { ...pose("north", 20), x: 1.85, yaw: 0 };
    observe(e, pose("south", 0), exit, { layout: "stop", elapsed: 6 });
    expect(e.visit).toBeNull();
    observe(e, pose("north", 13, 0.1), pose("north", 13, 0.1), {
      layout: "stop",
      elapsed: 12,
    });
    observe(e, pose("north", 12.2), pose("north", 11.8), {
      layout: "stop",
      elapsed: 13,
    });
    expect(codes(e).filter((c) => c === "stop")).toHaveLength(1);
    // Leave again, then repeat the same violation: it is a new encounter.
    observe(
      e,
      pose("north", 0),
      { ...pose("south", 20), x: -1.85, yaw: Math.PI },
      { layout: "stop", elapsed: 16 },
    );
    observe(e, pose("south", 12.2), pose("south", 11.8), {
      layout: "stop",
      elapsed: 20,
    });
    expect(codes(e).filter((c) => c === "stop")).toHaveLength(2);
  });
  it("does not retain a stop after retreating away from the line", () => {
    const e = createEvaluation();
    observe(e, pose("south", 13, 0), pose("south", 13, 0), { layout: "stop" });
    observe(e, pose("south", 13), pose("south", 19), {
      layout: "stop",
      direction: -1,
    });
    observe(e, pose("south", 12.2), pose("south", 11.8), { layout: "stop" });
    expect(codes(e)).toContain("stop");
  });
  it("checks entry again after reversing back behind the stop line", () => {
    const e = createEvaluation();
    observe(e, pose("south", 12.2), pose("south", 11.8), {
      layout: "signals",
      elapsed: 15,
      previousTime: 14.9,
    });
    observe(e, pose("south", 11.8), pose("south", 12.2), {
      layout: "signals",
      elapsed: 16,
      previousTime: 15.9,
      direction: -1,
    });
    expect(e.visit).toBeNull();
    observe(e, pose("south", 12.2), pose("south", 11.8), {
      layout: "signals",
      elapsed: 26,
      previousTime: 25.9,
    });
    expect(codes(e)).toEqual(["signal"]);
  });
  it("allows cancelling the indicator once the actual turn is complete", () => {
    const e = createEvaluation();
    observe(e, pose("south", 15), pose("south", 15), {
      elapsed: 1,
      indicator: -1,
    });
    observe(e, pose("south", 12.2), pose("south", 11.8), {
      elapsed: 2,
      indicator: -1,
    });
    const turning = { ...pose("south", 4), yaw: -0.3 };
    observe(e, pose("south", 4), turning, { elapsed: 3, indicator: -1 });
    const exit = { x: -9, z: -1.85, yaw: -Math.PI / 2, steering: 0, speed: 4 };
    observe(e, turning, exit, { elapsed: 5, indicator: 0 });
    expect(e.visit).toBeNull();
    expect(codes(e)).not.toContain("indicator");
  });
  it("permits unavoidable amber clearance but never red or red-amber entry", () => {
    const e = createEvaluation();
    observe(e, pose("south", 12.6, 8), pose("south", 12.2, 8), {
      layout: "signals",
      previousTime: 21.99,
      elapsed: 22.01,
    });
    observe(e, pose("south", 12.2, 8), pose("south", 11.8, 8), {
      layout: "signals",
      previousTime: 22.01,
      elapsed: 22.06,
    });
    expect(codes(e)).not.toContain("signal");
    for (const time of [1, 9.5]) {
      const red = createEvaluation();
      observe(red, pose("south", 12.2), pose("south", 11.8), {
        layout: "signals",
        elapsed: time,
        previousTime: time - 0.1,
      });
      expect(codes(red)).toContain("signal");
    }
    const safe = createEvaluation();
    observe(safe, pose("south", 20, 2), pose("south", 19.9, 2), {
      layout: "signals",
      previousTime: 21.99,
      elapsed: 22.01,
    });
    observe(safe, pose("south", 12.2), pose("south", 11.8), {
      layout: "signals",
      previousTime: 22.9,
      elapsed: 23,
    });
    expect(codes(safe)).toContain("signal");
  });
});

describe("continuous feedback", () => {
  it("logs one speeding episode, then a new one after recovery, without an unbounded log", () => {
    const e = createEvaluation();
    for (let i = 0; i < 30; i++)
      observe(e, pose("south", 25, 16), pose("south", 25, 16), {
        elapsed: 2 + i / 60,
      });
    expect(codes(e)).toEqual(["speed"]);
    observe(e, pose("south", 25, 0), pose("south", 25, 0), { elapsed: 4 });
    observe(e, pose("south", 25, 16), pose("south", 25, 16), { elapsed: 5 });
    expect(e.total).toBe(2);
    for (let i = 0; i < 110; i++) {
      observe(e, pose("south", 25, 0), pose("south", 25, 0), {
        elapsed: 10 + i * 4,
      });
      observe(e, pose("south", 25, 16), pose("south", 25, 16), {
        elapsed: 12 + i * 4,
      });
    }
    expect(e.events).toHaveLength(100);
    expect(e.total).toBe(112);
  });
  it.each<Arm>(["south", "north", "east", "west"])(
    "detects wrong-lane travel on %s",
    (arm) => {
      const e = createEvaluation(),
        correct = pose(arm, 25);
      observe(e, correct, correct);
      expect(codes(e)).not.toContain("lane");
      const a = ARMS[arm];
      const wrong = {
        ...correct,
        x: a.x * 25 - Math.cos(a.yaw) * 1.85,
        z: a.z * 25 - Math.sin(a.yaw) * 1.85,
      };
      observe(e, wrong, wrong);
      expect(codes(e)).toContain("lane");
    },
  );
  it.each([-1, 1] as const)(
    "detects missing and cancelled turn indication for direction %s",
    (direction) => {
      const p = { ...pose("south", 4), yaw: direction * 0.3 };
      const missing = createEvaluation();
      observe(missing, pose("south", 15), pose("south", 15));
      observe(missing, pose("south", 4), p, { elapsed: 4 });
      expect(codes(missing)).toContain("indicator");
      const correct = createEvaluation();
      observe(correct, pose("south", 15), pose("south", 15), {
        indicator: direction,
        elapsed: 1,
      });
      observe(correct, pose("south", 4), p, {
        indicator: direction,
        elapsed: 3,
      });
      expect(codes(correct)).not.toContain("indicator");
      observe(correct, p, p, { indicator: 0, elapsed: 3.5 });
      expect(codes(correct)).toContain("indicator");
    },
  );
  it("uses priority relations and actual conflicting motion, not the selected lesson", () => {
    expect(mustYield("south", "east", false, "priority")).toBe(true);
    expect(mustYield("north", "east", false, "priority")).toBe(false);
    expect(mustYield("north", "east", false, "stop")).toBe(true);
    expect(mustYield("west", "east", true, "signals")).toBe(true);
    const t = { ...pose("east", 6), speed: 4 };
    for (const layout of ["priority", "stop"] as JunctionLayout[]) {
      const e = createEvaluation();
      observe(e, pose("south", 15), pose("south", 15), { layout });
      observe(e, pose("south", 6), pose("south", 5.9), {
        layout,
        traffic: [{ vehicle: t, from: "east" }],
      });
      expect(codes(e)).toContain("priority");
    }
    const safe = createEvaluation();
    observe(safe, pose("south", 6, 0), pose("south", 6, 0), {
      traffic: [{ vehicle: t, from: "east" }],
    });
    expect(codes(safe)).not.toContain("priority");
    const clear = createEvaluation();
    observe(clear, pose("south", 6), pose("south", 5.9), {
      traffic: [{ vehicle: pose("east", 40), from: "east" }],
    });
    expect(codes(clear)).not.toContain("priority");
  });
  it("reports curb departure and collision with position and rule evidence", () => {
    const e = createEvaluation(),
      p = { ...pose("south", 25), x: 4 };
    observe(e, p, p, { traffic: [{ vehicle: p, from: "south" }] });
    expect(codes(e)).toEqual(["lane", "collision"]);
    expect(e.events[0].rule).toBe("25. § (2)");
    expect(e.events[0].position.x).toBe(4);
  });
});
