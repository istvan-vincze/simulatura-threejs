import type { Pose } from "./vehicle";

/** Metric geometry shared by generated scenery, vehicle containment and routing. */
export interface MapPoint {
  x: number;
  z: number;
}
export interface RoadNode extends MapPoint {
  id: string;
}
export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  points: readonly MapPoint[];
  width: number;
  /** Zero is two-way; +/-1 is one-way along/against the points. */
  direction: -1 | 0 | 1;
  name: string;
}
export interface RoadNetwork {
  nodes: readonly RoadNode[];
  roads: readonly RoadEdge[];
}

export function nearestRoad(network: RoadNetwork, point: MapPoint) {
  let nearest: {
    road: RoadEdge;
    distance: number;
    lateral: number;
    yaw: number;
    point: MapPoint;
  } | null = null;
  for (const road of network.roads) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1],
        b = road.points[i];
      const dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz);
      if (length < 0.001) continue;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.z - a.z) * dz) / (length * length),
        ),
      );
      const projected = { x: a.x + t * dx, z: a.z + t * dz };
      const distance = Math.hypot(point.x - projected.x, point.z - projected.z);
      if (!nearest || distance < nearest.distance)
        nearest = {
          road,
          distance,
          point: projected,
          yaw: Math.atan2(dx, -dz),
          lateral:
            ((point.x - projected.x) * -dz + (point.z - projected.z) * dx) /
            length,
        };
    }
  }
  return nearest;
}

export function roadContains(network: RoadNetwork, point: MapPoint) {
  return network.roads.some((road) => {
    const nearest = nearestRoad({ nodes: [], roads: [road] }, point);
    return nearest !== null && nearest.distance <= road.width / 2;
  });
}

export function roadDirectionIsWrong(network: RoadNetwork, pose: Pose) {
  const nearest = nearestRoad(network, pose);
  if (!nearest) return false;
  const alignment = Math.cos(pose.yaw - nearest.yaw);
  if (Math.abs(alignment) < 0.65) return false; // Turning across the centreline.
  return nearest.road.direction === 0
    ? nearest.lateral * alignment < -0.12
    : alignment * nearest.road.direction < 0;
}

/** Catch disconnected imports/generators before a driver can enter the map. */
export function validateRoadNetwork(network: RoadNetwork): void {
  const nodes = new Map(network.nodes.map((n) => [n.id, n]));
  if (!nodes.size || nodes.size !== network.nodes.length)
    throw new Error("Map needs unique road nodes");
  const adjacent = new Map(network.nodes.map((n) => [n.id, new Set<string>()]));
  const ids = new Set<string>();
  for (const road of network.roads) {
    const from = nodes.get(road.from),
      to = nodes.get(road.to);
    if (
      ids.has(road.id) ||
      !from ||
      !to ||
      from === to ||
      road.points.length < 2 ||
      !Number.isFinite(road.width) ||
      road.width <= 0
    )
      throw new Error(`Invalid road ${road.id}`);
    ids.add(road.id);
    const first = road.points[0],
      last = road.points.at(-1)!;
    if (
      road.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z)) ||
      Math.hypot(first.x - from.x, first.z - from.z) > 0.01 ||
      Math.hypot(last.x - to.x, last.z - to.z) > 0.01
    )
      throw new Error(`Road ${road.id} does not meet its junctions`);
    adjacent.get(from.id)!.add(to.id);
    adjacent.get(to.id)!.add(from.id);
  }
  const seen = new Set<string>(),
    pending = [network.nodes[0].id];
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...adjacent.get(id)!);
  }
  if (seen.size !== nodes.size) throw new Error("Road network is disconnected");
}
