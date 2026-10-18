import type { DrivingMap } from "./driving-map";
import {
  connectedRoads,
  pointAlong,
  roadLength,
  vehicleOnMap,
} from "./driving-map";
import type { MapPoint, RoadEdge } from "./road-network";
import type { Vehicle } from "./vehicle";
import { CAR, overlaps } from "./vehicle";
import { angleDifference, pathsConflict } from "./driving-evaluator";

interface Leg {
  road: RoadEdge;
  forward: boolean;
}
export interface MapTraffic {
  points: MapPoint[];
  length: number;
  distance: number;
}
function permitted(
  map: DrivingMap,
  previous: RoadEdge,
  next: RoadEdge,
  via: string,
) {
  const a = map.roads.find((r) => r.id === previous.id)!;
  const b = map.roads.find((r) => r.id === next.id)!;
  return !map.restrictions.some(
    (r) =>
      r.via === via &&
      r.fromWay === a.osmWay &&
      (r.kind.startsWith("only_")
        ? b.osmWay !== r.toWay
        : b.osmWay === r.toWay),
  );
}
/** Find a real directed circuit, not a respawn across the map. */
export function trafficCircuit(map: DrivingMap): Leg[] {
  for (const first of [...map.roads].sort(
    (a, b) => roadLength(b) - roadLength(a),
  )) {
    for (const forward of [true, false]) {
      if (
        (forward && first.direction === -1) ||
        (!forward && first.direction === 1)
      )
        continue;
      const start = forward ? first.from : first.to;
      function search(
        path: Leg[],
        node: string,
        seen: Set<string>,
      ): Leg[] | null {
        const last = path.at(-1)!.road;
        if (
          node === start &&
          path.length >= 4 &&
          path.reduce((sum, l) => sum + roadLength(l.road), 0) > 250
        )
          return permitted(map, last, first, node) ? path : null;
        if (seen.has(node) || path.length > 12) return null;
        for (const road of connectedRoads(map, node)) {
          if (
            road.id === last.id ||
            roadLength(road) < 12 ||
            !permitted(map, last, road, node)
          )
            continue;
          const forward = road.from === node;
          if (
            (forward && road.direction === -1) ||
            (!forward && road.direction === 1)
          )
            continue;
          const found = search(
            [...path, { road, forward }],
            forward ? road.to : road.from,
            new Set([...seen, node]),
          );
          if (found) return found;
        }
        return null;
      }
      const result = search(
        [{ road: first, forward }],
        forward ? first.to : first.from,
        new Set(),
      );
      if (result) return result;
    }
  }
  throw new Error("Map has no legal traffic circuit");
}
function lanePoint(leg: Leg, distance: number) {
  const points = leg.forward ? leg.road.points : [...leg.road.points].reverse();
  const p = pointAlong(points, distance);
  const offset = leg.road.direction === 0 ? leg.road.width / 4 : 0;
  return {
    ...p,
    x: p.x + Math.cos(p.yaw) * offset,
    z: p.z + Math.sin(p.yaw) * offset,
  };
}
function splitBends(legs: Leg[]): Leg[] {
  return legs.flatMap((leg) => {
    const ps = leg.forward ? leg.road.points : [...leg.road.points].reverse();
    const result: Leg[] = [];
    let start = 0;
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i],
        c = ps[i + 1];
      if (
        c &&
        Math.abs(
          angleDifference(
            Math.atan2(b.x - a.x, a.z - b.z),
            Math.atan2(c.x - b.x, b.z - c.z),
          ),
        ) < 0.25
      )
        continue;
      result.push({
        forward: true,
        road: {
          ...leg.road,
          direction: leg.road.direction === 0 ? 0 : 1,
          points: ps.slice(start, i + 1),
        },
      });
      start = i;
    }
    return result;
  });
}
function circuitPoints(legs: Leg[], trim: number) {
  const points: MapPoint[] = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i],
      length = roadLength(leg.road),
      cut = Math.min(trim, length / 3);
    for (let d = cut; d < length - cut; d += 2) points.push(lanePoint(leg, d));
    const a = lanePoint(leg, length - cut),
      next = legs[(i + 1) % legs.length];
    const b = lanePoint(next, Math.min(trim, roadLength(next.road) / 3));
    // Intersection of lane tangents supplies a quadratic turn's control point.
    const ux = Math.sin(a.yaw),
      uz = -Math.cos(a.yaw),
      vx = Math.sin(b.yaw),
      vz = -Math.cos(b.yaw);
    const cross = ux * vz - uz * vx;
    const t =
      Math.abs(cross) > 0.05
        ? ((b.x - a.x) * vz - (b.z - a.z) * vx) / cross
        : 0;
    const control =
      Math.abs(cross) > 0.05 && Math.abs(t) < 30
        ? { x: a.x + ux * t, z: a.z + uz * t }
        : { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    for (let j = 0; j <= 20; j++) {
      const f = j / 20,
        g = 1 - f;
      points.push({
        x: g * g * a.x + 2 * g * f * control.x + f * f * b.x,
        z: g * g * a.z + 2 * g * f * control.z + f * f * b.z,
      });
    }
  }
  points.push({ ...points[0] });
  return points.filter(
    (p, i) =>
      !i || Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z) > 0.001,
  );
}
const routeCache = new WeakMap<DrivingMap, Omit<MapTraffic, "distance">>();
export function createMapTraffic(map: DrivingMap): MapTraffic {
  let route = routeCache.get(map);
  if (!route) {
    const legs = trafficCircuit(map);
    for (const trim of [8, 6, 4, 2]) {
      const points = circuitPoints(splitBends(legs), trim),
        length = roadLength({ points });
      let fits = true;
      for (let d = 0; d < length; d += 0.75)
        if (!vehicleOnMap(map, pointAlong(points, d))) {
          fits = false;
          break;
        }
      if (fits) {
        route = { points, length };
        break;
      }
    }
    if (!route) throw new Error("Traffic circuit does not fit the carriageway");
    routeCache.set(map, route);
  }
  return { ...route, distance: route.length * 0.4 };
}
export function trafficPose(route: MapTraffic): Vehicle {
  return { ...pointAlong(route.points, route.distance), speed: 0, steering: 0 };
}
export function stepMapTraffic(
  route: MapTraffic,
  traffic: Vehicle,
  player: Vehicle,
  dt: number,
) {
  const distance = (route.distance + 4 * dt) % route.length;
  const next = { ...pointAlong(route.points, distance), speed: 4, steering: 0 };
  const preview = {
    ...pointAlong(route.points, (route.distance + 6) % route.length),
    speed: 4,
    steering: 0,
  };
  // Unknown junction priorities are never asserted. This prototype traffic
  // yields conservatively to the learner whenever their movements conflict.
  if (
    overlaps(next, player) ||
    overlaps(preview, player) ||
    (Math.hypot(player.x - traffic.x, player.z - traffic.z) < 18 &&
      pathsConflict({ ...traffic, speed: 4 }, player))
  ) {
    traffic.speed = 0;
    return;
  }
  next.steering = Math.atan(
    (angleDifference(next.yaw, traffic.yaw) * CAR.wheelbase) / (4 * dt),
  );
  Object.assign(traffic, next);
  route.distance = distance;
}
