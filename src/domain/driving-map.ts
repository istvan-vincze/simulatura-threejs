import data from "../data/zuglo.json";
import type { MapPoint, RoadEdge, RoadNetwork } from "./road-network";
import { nearestRoad, validateRoadNetwork } from "./road-network";
import { corners } from "./vehicle";
import type { Pose, Vehicle } from "./vehicle";

export interface MapPolygon {
  outer: MapPoint[];
  holes: MapPoint[][];
}
export interface MapRoad extends RoadEdge {
  osmWay: string;
  speedLimit: number;
  widthSource: string;
  speedSource: string;
}
export interface DrivingMap extends RoadNetwork {
  id: string;
  name: string;
  roads: MapRoad[];
  source: {
    attribution: string;
    url: string;
    timestamp: string;
    controlsVerified: boolean;
  };
  surface: MapPolygon[];
  sidewalks: MapPolygon[];
  buildings: {
    id: string;
    points: MapPoint[];
    height: number;
    heightSource: string;
  }[];
  importedControls: {
    id: string;
    kind: string;
    direction: string;
    yaw: number | null;
    roadWay: string;
    x: number;
    z: number;
  }[];
  restrictions: {
    id: string;
    fromWay: string;
    toWay: string;
    via: string;
    kind: string;
  }[];
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
}
export const zuglo = data as DrivingMap;
validateRoadNetwork(zuglo);

export function inRing(p: MapPoint, ring: readonly MapPoint[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function mapContains(map: DrivingMap, p: MapPoint) {
  return map.surface.some(
    (s) => inRing(p, s.outer) && !s.holes.some((h) => inRing(p, h)),
  );
}
export function vehicleOnMap(map: DrivingMap, pose: Pose) {
  const ps = corners(pose);
  return [
    ...ps,
    pose,
    ...ps.map((p, i) => ({
      x: (p.x + ps[(i + 1) % 4].x) / 2,
      z: (p.z + ps[(i + 1) % 4].z) / 2,
    })),
  ].every((p) => mapContains(map, p));
}
export function connectedRoads(map: RoadNetwork, nodeId: string) {
  return map.roads.filter((r) => r.from === nodeId || r.to === nodeId);
}
const junctionCache = new WeakMap<DrivingMap, DrivingMap["nodes"]>();
export function mapJunctions(map: DrivingMap) {
  let nodes = junctionCache.get(map);
  if (!nodes) {
    nodes = map.nodes.filter((n) => connectedRoads(map, n.id).length >= 3);
    junctionCache.set(map, nodes);
  }
  return nodes;
}
export function atMapEdge(map: DrivingMap, p: MapPoint) {
  return map.nodes.some(
    (n) =>
      connectedRoads(map, n.id).length === 1 &&
      Math.hypot(p.x - n.x, p.z - n.z) < 9,
  );
}
/** End barriers are physical map boundaries, not traffic-law violations. */
export function crossesMapBoundary(map: DrivingMap, pose: Pose) {
  return map.nodes.some((n) => {
    const roads = connectedRoads(map, n.id);
    if (roads.length !== 1 || Math.hypot(pose.x - n.x, pose.z - n.z) > 10)
      return false;
    const r = roads[0],
      ps = r.to === n.id ? r.points : [...r.points].reverse();
    const a = ps.at(-2)!,
      b = ps.at(-1)!;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / length,
      uz = (b.z - a.z) / length;
    return corners(pose).some(
      (p) => (p.x - b.x) * ux + (p.z - b.z) * uz > -0.5,
    );
  });
}
/** A stable legal lane on Szugló utca, away from its junctions. */
export function mapSpawn(map: DrivingMap): Vehicle {
  const road =
    map.roads.find((r) => r.osmWay === "301007416" && roadLength(r) > 65) ??
    map.roads[0];
  const p = pointAlong(road.points, roadLength(road) * 0.5);
  const yaw = road.direction === -1 ? p.yaw + Math.PI : p.yaw;
  const offset = road.direction === 0 ? road.width / 4 : 0;
  return {
    x: p.x + Math.cos(yaw) * offset,
    z: p.z + Math.sin(yaw) * offset,
    yaw,
    speed: 0,
    steering: 0,
  };
}
export function roadLength(road: Pick<RoadEdge, "points">) {
  return road.points
    .slice(1)
    .reduce(
      (sum, p, i) =>
        sum + Math.hypot(p.x - road.points[i].x, p.z - road.points[i].z),
      0,
    );
}
export function pointAlong(
  points: readonly MapPoint[],
  distance: number,
): Pose {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      length = Math.hypot(b.x - a.x, b.z - a.z);
    if (distance <= length || i === points.length - 1) {
      const t = Math.max(0, Math.min(1, distance / Math.max(length, 0.001)));
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        yaw: Math.atan2(b.x - a.x, a.z - b.z),
      };
    }
    distance -= length;
  }
  throw new Error("A route needs two distinct points");
}
export function streetAt(map: DrivingMap, p: MapPoint) {
  return nearestRoad(map, p)?.road.name ?? map.name;
}
