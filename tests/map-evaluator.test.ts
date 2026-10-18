import { expect, it } from "vitest";
import {
  zuglo,
  mapSpawn,
  mapJunctions,
  pointAlong,
  roadLength,
} from "../src/domain/driving-map";
import { evaluateMapDriving } from "../src/domain/map-evaluator";
import type { MapEvaluation } from "../src/domain/map-evaluator";
import { createEvaluation } from "../src/domain/driving-evaluator";
import type { Vehicle } from "../src/domain/vehicle";

const traffic: Vehicle = { x: 9999, z: 9999, yaw: 0, speed: 0, steering: 0 };
function setup() {
  return { e: createEvaluation(), state: { visit: null } as MapEvaluation };
}
function observe(
  h: ReturnType<typeof setup>,
  p: Vehicle,
  old = p,
  time = 1,
  indicator: -1 | 0 | 1 = 0,
) {
  evaluateMapDriving(zuglo, h.state, h.e, old, p, traffic, time, indicator, 1);
}
it("uses the mapped 30 km/h limit and treats unknown priority as unknown", () => {
  const h = setup(),
    r = zuglo.roads.find((r) => r.speedLimit === 30 && roadLength(r) > 80)!;
  const p = pointAlong(r.points, 40),
    car = {
      ...p,
      x: p.x + (Math.cos(p.yaw) * r.width) / 4,
      z: p.z + (Math.sin(p.yaw) * r.width) / 4,
      speed: 10,
      steering: 0,
    };
  observe(h, car);
  expect(h.e.events.find((e) => e.code === "speed")?.message).toContain(
    "30 km/h",
  );
  expect(
    h.e.events.some(
      (e) => e.code === "priority" || e.code === "signal" || e.code === "stop",
    ),
  ).toBe(false);
});
it("checks one-way direction away from junctions without penalizing the allowed direction", () => {
  const r = zuglo.roads.find((r) => r.direction === 1 && roadLength(r) > 60)!,
    p = pointAlong(r.points, roadLength(r) / 2);
  const h = setup(),
    car = { ...p, speed: 2, steering: 0 };
  observe(h, car);
  expect(h.e.events.filter((e) => e.code === "lane")).toHaveLength(0);
  observe(h, { ...car, yaw: car.yaw + Math.PI }, car, 2);
  expect(h.e.events.find((e) => e.code === "lane")?.message).toContain(
    "egyirányú",
  );
});
it("tracks actual turns at translated, rotated junctions and accepts cancelling after exit", () => {
  const h = setup(),
    n = mapJunctions(zuglo).find((n) =>
      zuglo.roads.some((r) => r.to === n.id && roadLength(r) > 80),
    )!;
  const r = zuglo.roads.find((r) => r.to === n.id && roadLength(r) > 80)!,
    p = pointAlong(r.points, roadLength(r) - 18);
  const old = { ...p, speed: 2, steering: 0 };
  observe(h, old, old, 1, -1);
  expect(h.state.visit?.nodeId).toBe(n.id);
  const heading = h.state.visit!.heading;
  const turned = { ...old, x: n.x, z: n.z, yaw: heading - 0.4 };
  observe(h, turned, old, 3, -1);
  expect(h.e.events.some((e) => e.code === "indicator")).toBe(false);
  const exit = {
    ...turned,
    x: n.x + Math.sin(turned.yaw) * 15,
    z: n.z - Math.cos(turned.yaw) * 15,
  };
  observe(h, exit, turned, 6, 0);
  expect(h.state.visit).toBeNull();
  expect(h.e.events.some((e) => e.code === "indicator")).toBe(false);
  const missing = setup();
  observe(missing, old, old, 1);
  observe(missing, turned, old, 3);
  expect(missing.e.events.some((e) => e.code === "indicator")).toBe(true);
});
it("records actual world coordinates and suppresses repeated collision evidence", () => {
  const h = setup(),
    p = mapSpawn(zuglo);
  for (let i = 0; i < 60; i++)
    evaluateMapDriving(zuglo, h.state, h.e, p, p, p, i / 60, 0, 1);
  const events = h.e.events.filter((e) => e.code === "collision");
  expect(events).toHaveLength(1);
  expect(events[0].position).toEqual({ x: p.x, z: p.z, yaw: p.yaw });
});

it("does not report lane, curb or turn-restriction violations along the imported legal circuit", async () => {
  const { createMapTraffic } = await import("../src/domain/map-traffic");
  const route = createMapTraffic(zuglo),
    h = setup();
  let old = { ...pointAlong(route.points, 0), speed: 4, steering: 0 };
  for (let d = 1; d < route.length; d += 1) {
    const p = { ...pointAlong(route.points, d), speed: 4, steering: 0 };
    observe(h, p, old, d / 4);
    old = p;
  }
  expect(
    h.e.events.filter((e) => e.code === "route" || e.code === "lane"),
  ).toEqual([]);
});

it("reports an imported mandatory turn only after actually entering and taking a prohibited exit", () => {
  const restriction = zuglo.restrictions.find((r) => r.id === "16825149")!;
  const node = zuglo.nodes.find((n) => n.id === restriction.via)!;
  const incoming = zuglo.roads.find(
    (r) => r.osmWay === restriction.fromWay && r.to === node.id,
  )!;
  const exit = zuglo.roads.find(
    (r) => r.osmWay === "1231329983" && r.from === node.id,
  )!;
  const approach = {
    ...pointAlong(incoming.points, roadLength(incoming) - 18),
    speed: 3,
    steering: 0,
  };
  const centre = { ...approach, x: node.x, z: node.z };
  const departed = { ...pointAlong(exit.points, 14), speed: 3, steering: 0 };
  const h = setup();
  observe(h, approach, approach, 1);
  observe(h, centre, approach, 3);
  observe(h, departed, centre, 7);
  expect(h.e.events.filter((e) => e.code === "route")).toHaveLength(1);
});
