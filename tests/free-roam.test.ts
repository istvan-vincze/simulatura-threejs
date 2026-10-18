import { expect, it } from "vitest";
import {
  createFreeRoam,
  stepFreeRoam,
  changeDirection,
  recoverFreeRoam,
  ROAD_END,
} from "../src/domain/free-roam";
import { corners, NEUTRAL, overlaps } from "../src/domain/vehicle";

it("continues through the lesson goal, records violations and stops at the map edge", () => {
  const s = createFreeRoam("signals");
  s.traffic.x = -40;
  for (let i = 0; i < 1100; i++)
    stepFreeRoam(s, { throttle: 1, brake: 0, steer: 0 }, 1 / 60);
  expect(s.stage).toBe("drive");
  expect(s.player.z).toBeLessThan(-35);
  expect(s.evaluation.events.some((e) => e.code === "signal")).toBe(true);
  expect(corners(s.player).every((p) => Math.abs(p.z) <= ROAD_END)).toBe(true);
  expect(s.player.speed).toBe(0);
  expect(s.blocked).toBe("edge");
});
it("keeps violation evidence on recovery, while a new run starts clean", () => {
  const s = createFreeRoam();
  s.player.speed = 16;
  stepFreeRoam(s, NEUTRAL, 1 / 60);
  const count = s.evaluation.total;
  expect(count).toBeGreaterThan(0);
  recoverFreeRoam(s);
  expect(s.player.z).toBe(26);
  expect(s.evaluation.total).toBe(count);
  expect(s.evaluation.visit).toBeNull();
  expect(createFreeRoam().evaluation.total).toBe(0);
});
it("only changes direction at rest, reverses and freezes while paused", () => {
  const s = createFreeRoam();
  s.player.speed = 1;
  expect(changeDirection(s)).toBe(false);
  s.player.speed = 0;
  expect(changeDirection(s)).toBe(true);
  for (let i = 0; i < 60; i++)
    stepFreeRoam(s, { throttle: 1, brake: 0, steer: 0 }, 1 / 60);
  expect(s.player.z).toBeGreaterThan(26);
  expect(s.player.speed).toBeLessThanOrEqual(3);
  s.paused = true;
  const before = structuredClone(s);
  stepFreeRoam(s, { throttle: 1, brake: 0, steer: 1 }, 1);
  expect(s).toEqual(before);
});
it("blocks curb penetration without ending the session or flooding the log", () => {
  const s = createFreeRoam("priority");
  // Drive toward the northern curb on the east road.
  Object.assign(s.player, { x: 20, z: -2.8, yaw: -Math.PI / 2 });
  for (let i = 0; i < 300; i++)
    stepFreeRoam(s, { throttle: 1, brake: 0, steer: 1 }, 1 / 60);
  expect(s.stage).toBe("drive");
  expect(
    s.evaluation.events.filter(
      (e) => e.code === "lane" && e.message.includes("úttestet"),
    ),
  ).toHaveLength(1);
  expect(s.player.speed).toBe(0);
});
it("cycles traffic and holds it at a red signal", () => {
  const s = createFreeRoam();
  Object.assign(s.traffic, { x: 12.2, speed: 0 });
  s.elapsed = 15;
  stepFreeRoam(s, NEUTRAL, 1 / 60);
  expect(s.traffic.x).toBeCloseTo(12.2);
  expect(s.traffic.speed).toBe(0);
  s.traffic.x = -43.1;
  stepFreeRoam(s, NEUTRAL, 1 / 60);
  expect(s.traffic.x).toBe(43);
});
it("the crossing car yields to a conflicting learner coming from its right", () => {
  const s = createFreeRoam("priority");
  Object.assign(s.player, { x: -1.85, z: -7, yaw: Math.PI, speed: 4 });
  Object.assign(s.traffic, { x: 9, speed: 4 });
  let waited = false;
  for (let i = 0; i < 200; i++) {
    stepFreeRoam(s, NEUTRAL, 1 / 60);
    waited ||= s.traffic.speed === 0;
    expect(overlaps(s.player, s.traffic)).toBe(false);
  }
  expect(waited).toBe(true);
  expect(s.evaluation.events.some((e) => e.code === "priority")).toBe(false);
});
it("a learner collision is contained and logged without ending free driving", () => {
  const s = createFreeRoam("priority");
  Object.assign(s.player, { x: 1.85, z: 1.4, yaw: 0, speed: 5 });
  Object.assign(s.traffic, { x: 1.85, z: -1.85, speed: 4 });
  for (let i = 0; i < 10; i++)
    stepFreeRoam(s, { throttle: 1, brake: 0, steer: 0 }, 1 / 60);
  expect(s.evaluation.events.some((e) => e.code === "collision")).toBe(true);
  expect(s.stage).toBe("drive");
  expect(overlaps(s.player, s.traffic)).toBe(false);
});
