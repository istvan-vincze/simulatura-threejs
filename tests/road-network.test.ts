import { expect, it } from "vitest";
import {
  nearestRoad,
  roadContains,
  roadDirectionIsWrong,
  validateRoadNetwork,
} from "../src/domain/road-network";
import type { RoadNetwork } from "../src/domain/road-network";

const network: RoadNetwork = {
  nodes: [
    { id: "a", x: 20, z: 20 },
    { id: "b", x: 60, z: -20 },
  ],
  roads: [
    {
      id: "ab",
      from: "a",
      to: "b",
      name: "Test",
      width: 8,
      direction: 0,
      points: [
        { x: 20, z: 20 },
        { x: 60, z: -20 },
      ],
    },
  ],
};
it("uses actual angled road geometry for containment and travel direction", () => {
  validateRoadNetwork(network);
  const offset = 1.85 / Math.sqrt(2);
  const pose = { x: 40 + offset, z: offset, yaw: Math.PI / 4 };
  expect(nearestRoad(network, pose)!.distance).toBeCloseTo(1.85);
  expect(roadContains(network, pose)).toBe(true);
  expect(roadDirectionIsWrong(network, pose)).toBe(false);
  expect(
    roadDirectionIsWrong(network, { ...pose, yaw: pose.yaw + Math.PI }),
  ).toBe(true);
  expect(roadContains(network, { x: 50, z: 10 })).toBe(false);
});
it("rejects disconnected data and roads that fail to meet their endpoints", () => {
  expect(() =>
    validateRoadNetwork({
      ...network,
      nodes: [...network.nodes, { id: "c", x: 100, z: 100 }],
    }),
  ).toThrow("disconnected");
  expect(() =>
    validateRoadNetwork({
      ...network,
      roads: [
        {
          ...network.roads[0],
          points: [
            { x: 0, z: 0 },
            { x: 60, z: -20 },
          ],
        },
      ],
    }),
  ).toThrow("junctions");
});
it("recognizes one-way direction independently of lateral position", () => {
  const oneWay = {
    ...network,
    roads: [{ ...network.roads[0], direction: 1 as const }],
  };
  expect(roadDirectionIsWrong(oneWay, { x: 39, z: -1, yaw: Math.PI / 4 })).toBe(
    false,
  );
  expect(
    roadDirectionIsWrong(oneWay, { x: 39, z: -1, yaw: -Math.PI * 0.75 }),
  ).toBe(true);
});

it("allows a wider road's surface even when a nearby narrow centre-line is closer", () => {
  const roads = [
    {
      ...network.roads[0],
      width: 2,
      points: [
        { x: 0, z: 0 },
        { x: 0, z: 20 },
      ],
    },
    {
      ...network.roads[0],
      id: "wide",
      width: 10,
      points: [
        { x: 6, z: 0 },
        { x: 6, z: 20 },
      ],
    },
  ];
  expect(roadContains({ ...network, roads }, { x: 2, z: 10 })).toBe(true);
});
