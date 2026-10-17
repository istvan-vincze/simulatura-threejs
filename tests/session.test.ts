import { describe, expect, it } from "vitest";
import { createSession, passed, stepSession } from "../src/domain/session";
import { signalsAt } from "../src/domain/signals";
import {
  advanceVehicle,
  overlaps,
  spawnPlayer,
  NEUTRAL,
} from "../src/domain/vehicle";
import type { Session } from "../src/domain/session";
import type { Controls } from "../src/domain/vehicle";
function run(s: Session, seconds: number, controls: Controls = NEUTRAL) {
  for (let i = 0; i < Math.round(seconds * 60); i++)
    stepSession(s, controls, 1 / 60);
}
const gas = { throttle: 1, brake: 0, steer: 0 };
describe("signal safety", () => {
  it("never gives conflicting green or preparation phases", () => {
    for (let t = 0; t < 81; t += 0.05) {
      const s = signalsAt(t);
      if (s.ns !== "red") expect(s.ew).toBe("red");
      if (s.ew !== "red") expect(s.ns).toBe("red");
    }
  });
  it("includes red+amber before green and repeats the cycle", () => {
    expect(signalsAt(9.5).ns).toBe("red-amber");
    expect(signalsAt(10).ns).toBe("green");
    expect(signalsAt(27)).toEqual(signalsAt(0));
  });
});
describe("vehicle motion and collision", () => {
  it("accelerates in physical units and brakes to a full stop without reversing", () => {
    const v = spawnPlayer();
    for (let i = 0; i < 120; i++) advanceVehicle(v, gas, 1 / 60);
    expect(v.z).toBeLessThan(20);
    expect(v.speed).toBeGreaterThan(6);
    for (let i = 0; i < 120; i++)
      advanceVehicle(v, { ...NEUTRAL, brake: 1 }, 1 / 60);
    expect(v.speed).toBe(0);
  });
  it("detects perpendicular collision and rejects separated boxes", () => {
    expect(
      overlaps({ x: 0, z: 0, yaw: 0 }, { x: 1, z: 0, yaw: Math.PI / 2 }),
    ).toBe(true);
    expect(overlaps({ x: 0, z: 0, yaw: 0 }, { x: 3, z: 0, yaw: 0 })).toBe(
      false,
    );
  });
});
describe("lesson evaluation", () => {
  it("does not advance observation or paused runs", () => {
    const s = createSession("priority");
    run(s, 2, gas);
    expect(s.elapsed).toBe(0);
    s.stage = "drive";
    s.paused = true;
    run(s, 2, gas);
    expect(s.player.z).toBe(26);
  });
  it("fails forcing priority and records the violation once", () => {
    const s = createSession("priority");
    s.stage = "drive";
    run(s, 7, gas);
    expect(
      s.events.filter((e) => e.code === "priority" && e.severity === "error"),
    ).toHaveLength(1);
    expect(passed(s)).toBe(false);
  });
  it("passes a complete right-hand-priority lesson after waiting for traffic", () => {
    const s = createSession("priority");
    s.stage = "drive";
    run(s, 8);
    run(s, 3, gas);
    run(s, 10);
    expect(s.stage).toBe("review");
    expect(passed(s)).toBe(true);
  });
  it("requires a complete stop near the line, not at the spawn point", () => {
    const s = createSession("stop");
    s.stage = "drive";
    run(s, 8);
    run(s, 8, gas);
    expect(
      s.events.some((e) => e.code === "stop" && e.severity === "error"),
    ).toBe(true);
  });
  it("passes stopping at the line and giving priority", () => {
    const s = createSession("stop");
    s.stage = "drive";
    s.player.z = 13;
    run(s, 8);
    run(s, 3, gas);
    run(s, 10);
    expect(passed(s)).toBe(true);
    expect(s.events.find((e) => e.code === "stop")?.severity).toBe("success");
  });
  it.each([15, 12.2, 12.1])(
    "recognizes a full stop before or on the painted line at centre z=%s",
    (z) => {
      const s = createSession("stop");
      s.stage = "drive";
      s.player.z = z;
      run(s, 1);
      expect(s.stopped).toBe(true);
      run(s, 8);
      run(s, 3, gas);
      run(s, 10);
      expect(passed(s)).toBe(true);
    },
  );
  it("does not turn a stop after crossing the stripe into a valid stop", () => {
    const s = createSession("stop");
    s.stage = "drive";
    s.player.z = 12.1;
    s.player.speed = 1;
    run(s, 0.2, gas);
    run(s, 1, { ...NEUTRAL, brake: 1 });
    expect(s.crossedLine).toBe(true);
    expect(s.stopped).toBe(false);
    expect(s.events.find((e) => e.code === "stop")?.severity).toBe("error");
  });
  it("settles residual speed to zero when braking and recognizes that stop", () => {
    const s = createSession("stop");
    s.stage = "drive";
    s.player.z = 13;
    s.player.speed = 0.18;
    run(s, 1 / 60, { ...NEUTRAL, brake: 1 });
    expect(s.player.speed).toBe(0);
    expect(s.stopped).toBe(true);
  });
  it("rejects a rolling stop", () => {
    const s = createSession("stop");
    s.stage = "drive";
    s.player.z = 12.21;
    s.player.speed = 0.1;
    run(s, 1, gas);
    expect(s.events.find((e) => e.code === "stop")?.severity).toBe("error");
  });
  it("detects red and red+amber stop-line crossings", () => {
    for (const t of [0, 9.2]) {
      const s = createSession("signals");
      s.stage = "drive";
      s.elapsed = t;
      s.player.z = 12.3;
      s.player.speed = 2;
      run(s, 0.2, gas);
      expect(s.events.find((e) => e.code === "signal")?.severity).toBe("error");
    }
  });
  it("passes a signal lesson after waiting for green", () => {
    const s = createSession("signals");
    s.stage = "drive";
    run(s, 10.1);
    run(s, 3, gas);
    run(s, 10);
    expect(passed(s)).toBe(true);
  });
  it("allows clearing on amber when there was no safe stopping distance", () => {
    const s = createSession("signals");
    s.stage = "drive";
    s.elapsed = 21.99;
    s.player.z = 12.4;
    s.player.speed = 8;
    s.traffic.x = -30;
    run(s, 0.2, gas);
    expect(s.events.some((e) => e.code === "signal")).toBe(false);
  });
  it("stops the run on curb departure or collision", () => {
    const s = createSession("priority");
    s.stage = "drive";
    s.player.x = 4;
    run(s, 0.1);
    expect(s.stage).toBe("review");
    expect(passed(s)).toBe(false);
    const collision = createSession("priority");
    collision.stage = "drive";
    collision.traffic.x = 1.85;
    collision.player.z = -1.85;
    run(collision, 0.1);
    expect(collision.events.some((e) => e.code === "collision")).toBe(true);
  });
});
