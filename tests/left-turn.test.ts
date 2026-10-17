import { describe, expect, it } from "vitest";
import { createSession, passed, stepSession } from "../src/domain/session";
import type { Session } from "../src/domain/session";
import {
  clearedGoal,
  conflictState,
  distanceOnPath,
  poseOnPath,
  TURN_EXIT,
} from "../src/domain/movements";
import { corners, NEUTRAL } from "../src/domain/vehicle";
import { isOnCarriageway } from "../src/domain/junction";

import { followTurn } from "./helpers/turn-driver";

function drive(indicator: (s: Session) => -1 | 0 | 1 = () => -1) {
  const s = createSession("left-turn");
  s.stage = "drive";
  for (let i = 0; i < 9 * 60; i++)
    stepSession(s, { ...NEUTRAL, indicator: indicator(s) }, 1 / 60);
  for (let i = 0; i < 45 * 60 && s.stage === "drive"; i++) {
    stepSession(s, { ...followTurn(s), indicator: indicator(s) }, 1 / 60);
  }
  return s;
}

describe("left-turn lesson", () => {
  it("drives from the spawn through the turn and west goal with normal controls", () => {
    const s = drive((s) => (s.turn.finished ? 0 : -1));
    expect(s.events.filter((e) => e.severity === "error")).toEqual([]);
    expect(passed(s)).toBe(true);
    expect(s.player.x).toBeLessThan(-24);
    expect(s.player.z).toBeCloseTo(-1.85, 1);
    expect(s.events.map((e) => e.code)).toEqual(
      expect.arrayContaining(["indicator", "priority", "route"]),
    );
  });
  it.each([0, 1] as const)(
    "does not pass a completed turn with indicator %s",
    (indicator) => {
      const s = drive(() => indicator);
      expect(s.completed).toBe(true);
      expect(passed(s)).toBe(false);
      expect(s.events.find((e) => e.code === "indicator")?.severity).toBe(
        "error",
      );
    },
  );
  it("retains the error if the signal is cancelled during the turn and then restored", () => {
    const s = drive((s) => (s.turn.started && s.player.x > -2 ? 0 : -1));
    expect(s.completed).toBe(true);
    expect(s.events.find((e) => e.code === "indicator")?.severity).toBe(
      "error",
    );
  });
  it("rejects a signal first switched on after steering begins", () => {
    const s = drive((s) => (s.turn.started ? -1 : 0));
    expect(passed(s)).toBe(false);
    expect(s.events.find((e) => e.code === "indicator")?.message).toContain(
      "előtt",
    );
  });
  it("allows waiting in the approach lane but penalizes crossing the oncoming path", () => {
    const s = createSession("left-turn");
    s.stage = "drive";
    s.player.z = 4;
    s.traffic.z = -10;
    stepSession(s, NEUTRAL, 1 / 60);
    expect(s.events.some((e) => e.code === "priority")).toBe(false);
    Object.assign(s.player, poseOnPath("south-west", 26));
    stepSession(s, NEUTRAL, 1 / 60);
    expect(s.events.find((e) => e.code === "priority")?.severity).toBe("error");
    expect(s.events.some((e) => e.code === "collision")).toBe(false);
  });
  it("does not impose waiting for a distant car that has no imminent conflict", () => {
    const s = createSession("left-turn");
    Object.assign(s.player, poseOnPath("south-west", 26), { speed: 2 });
    s.traffic.z = -100;
    expect(conflictState(s.scenario, s.player, s.traffic).mustYield).toBe(
      false,
    );
    s.traffic.z = -10;
    expect(conflictState(s.scenario, s.player, s.traffic).mustYield).toBe(true);
    s.traffic.z = 7;
    expect(conflictState(s.scenario, s.player, s.traffic).mustYield).toBe(
      false,
    );
  });
  it("rejects the wrong outbound lane and straight-ahead exit", () => {
    const wrongLane = createSession("left-turn");
    wrongLane.stage = "drive";
    Object.assign(wrongLane.player, { x: -9, z: 1.85, yaw: -Math.PI / 2 });
    stepSession(wrongLane, NEUTRAL, 1 / 60);
    expect(wrongLane.events.find((e) => e.code === "lane")?.severity).toBe(
      "error",
    );
    const straight = createSession("left-turn");
    straight.stage = "drive";
    straight.player.z = -9;
    stepSession(straight, NEUTRAL, 1 / 60);
    expect(straight.stage).toBe("review");
    expect(straight.events.find((e) => e.code === "route")?.severity).toBe(
      "error",
    );
    expect(straight.completed).toBe(false);
  });
  it("keeps the route footprint on the carriageway and requires the rear to clear the goal", () => {
    for (let distance = 0; distance < TURN_EXIT + 22; distance += 0.1) {
      const pose = poseOnPath("south-west", distance);
      expect(corners(pose).every((p) => isOnCarriageway(p.x, p.z))).toBe(true);
      expect(distanceOnPath("south-west", pose)).toBeCloseTo(distance, 6);
    }
    expect(
      clearedGoal("south-west", { x: -22, z: -1.85, yaw: -Math.PI / 2 }),
    ).toBe(false);
    expect(
      clearedGoal("south-west", { x: -24.3, z: -1.85, yaw: -Math.PI / 2 }),
    ).toBe(true);
  });
  it("keeps turn and signal state unchanged while paused and resets cleanly", () => {
    const s = createSession("left-turn");
    s.stage = "drive";
    s.paused = true;
    const original = structuredClone(s);
    stepSession(s, { ...NEUTRAL, indicator: -1, throttle: 1 }, 1);
    expect(s).toEqual(original);
    const retry = createSession("left-turn");
    expect(retry.turn).toEqual({
      signalSince: null,
      started: false,
      finished: false,
    });
    expect(retry.indicator).toBe(0);
  });
});
