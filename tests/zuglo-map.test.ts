import { expect, it } from "vitest";
import {
  zuglo,
  mapSpawn,
  mapJunctions,
  vehicleOnMap,
  pointAlong,
  connectedRoads,
} from "../src/domain/driving-map";
import { validateRoadNetwork } from "../src/domain/road-network";
import { createMapTraffic, trafficCircuit } from "../src/domain/map-traffic";
import {
  createZugloFreeRoam,
  stepFreeRoam,
  recoverFreeRoam,
} from "../src/domain/free-roam";
import { NEUTRAL } from "../src/domain/vehicle";

it("imports a connected real street patch with explicit provenance and no motor-closed streets", () => {
  expect(() => validateRoadNetwork(zuglo)).not.toThrow();
  expect(mapJunctions(zuglo).length).toBe(23);
  expect(zuglo.roads.some((r) => r.osmWay === "1204268060")).toBe(false);
  expect(zuglo.source.controlsVerified).toBe(false);
  // A later skeleton record from Overpass must not erase the tagged node.
  expect(zuglo.importedControls).toEqual([
    expect.objectContaining({
      id: "9489077224",
      kind: "give_way",
      direction: "forward",
    }),
  ]);
  expect(zuglo.roads.some((r) => r.direction === 1)).toBe(true);
  expect(zuglo.buildings.length).toBeGreaterThan(200);
  expect(vehicleOnMap(zuglo, mapSpawn(zuglo))).toBe(true);
});
it("routes traffic around a legal directed circuit entirely within the rendered carriageway", () => {
  const legs = trafficCircuit(zuglo);
  expect(legs.length).toBeGreaterThanOrEqual(4);
  for (const leg of legs)
    expect(leg.road.direction * (leg.forward ? 1 : -1)).toBeGreaterThanOrEqual(
      0,
    );
  const route = createMapTraffic(zuglo);
  expect(route.length).toBeGreaterThan(250);
  for (let d = 0; d < route.length; d += 0.5)
    expect(
      vehicleOnMap(zuglo, pointAlong(route.points, d)),
      `route distance ${d}`,
    ).toBe(true);
});
it("drives on imported geometry, preserves evidence on recovery and does not use the old origin junction", () => {
  const s = createZugloFreeRoam();
  const start = { ...s.player };
  for (let i = 0; i < 120; i++)
    stepFreeRoam(s, { throttle: 1, brake: 0, steer: 0 }, 1 / 60);
  expect(
    Math.hypot(s.player.x - start.x, s.player.z - start.z),
  ).toBeGreaterThan(3);
  expect(s.evaluation.events).toEqual([]);
  s.player.speed = 17;
  stepFreeRoam(s, NEUTRAL, 1 / 60);
  expect(s.evaluation.events.some((e) => e.code === "speed")).toBe(true);
  const total = s.evaluation.total;
  recoverFreeRoam(s);
  expect(s.player).toEqual(start);
  expect(s.evaluation.total).toBe(total);
});
it("contains movement at imported road endpoints instead of the old 47 metre bounds", () => {
  const s = createZugloFreeRoam();
  const end = zuglo.nodes.find(
    (n) => connectedRoads(zuglo, n.id).length === 1,
  )!;
  const road = connectedRoads(zuglo, end.id)[0];
  const points = road.to === end.id ? road.points : [...road.points].reverse();
  const a = points.at(-2)!,
    b = points.at(-1)!;
  const yaw = Math.atan2(b.x - a.x, a.z - b.z);
  Object.assign(s.player, {
    x: b.x - Math.sin(yaw) * 8 + Math.cos(yaw) * 1.65,
    z: b.z + Math.cos(yaw) * 8 + Math.sin(yaw) * 1.65,
    yaw,
  });
  for (let i = 0; i < 360; i++)
    stepFreeRoam(s, { throttle: 1, brake: 0, steer: 0 }, 1 / 60);
  expect(s.blocked).toBe("edge");
  expect(vehicleOnMap(zuglo, s.player)).toBe(true);
});
