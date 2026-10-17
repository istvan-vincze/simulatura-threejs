import type { ScenarioId } from "./scenarios";
import { CAR, corners } from "./vehicle";
import type { Pose, Vehicle } from "./vehicle";

export type MovementId =
  "south-north" | "south-west" | "east-west" | "north-south";
type PlayerMovement = "south-north" | "south-west";
const APPROACH = 22;
const RADIUS = 5.85;
const ARC = (RADIUS * Math.PI) / 2;
export const TURN_EXIT = APPROACH + ARC;

export function movementsFor(id: ScenarioId): {
  player: PlayerMovement;
  traffic: "east-west" | "north-south";
} {
  return id === "left-turn"
    ? { player: "south-west", traffic: "north-south" }
    : { player: "south-north", traffic: "east-west" };
}

// Distance along a lane in metres. The same paths drive traffic, guide arrows,
// conflict timing and goal placement; the learner still steers freely.
export function poseOnPath(id: MovementId, distance: number): Pose {
  if (id === "east-west")
    return { x: 25 - distance, z: -1.85, yaw: -Math.PI / 2 };
  if (id === "north-south")
    return { x: -1.85, z: -30 + distance, yaw: Math.PI };
  if (id === "south-north" || distance <= APPROACH)
    return { x: 1.85, z: 26 - distance, yaw: 0 };
  if (distance >= TURN_EXIT)
    return { x: -4 - (distance - TURN_EXIT), z: -1.85, yaw: -Math.PI / 2 };
  const angle = -(distance - APPROACH) / RADIUS;
  return {
    x: -4 + RADIUS * Math.cos(angle),
    z: 4 + RADIUS * Math.sin(angle),
    yaw: angle,
  };
}

export function distanceOnPath(
  id: MovementId,
  pose: Pick<Pose, "x" | "z">,
): number {
  if (id === "east-west") return 25 - pose.x;
  if (id === "north-south") return pose.z + 30;
  if (id === "south-north" || pose.z >= 4) return 26 - pose.z;
  if (pose.x <= -4) return TURN_EXIT - 4 - pose.x;
  return (
    APPROACH +
    Math.max(0, Math.min(Math.PI / 2, -Math.atan2(pose.z - 4, pose.x + 4))) *
      RADIUS
  );
}

export function goalPose(id: MovementId): Pose {
  return poseOnPath(id, id === "south-west" ? TURN_EXIT + 18 : 48);
}

export function clearedGoal(id: MovementId, pose: Pose): boolean {
  const goal = goalPose(id);
  return corners(pose).every(
    (p) =>
      (p.x - goal.x) * Math.sin(goal.yaw) -
        (p.z - goal.z) * Math.cos(goal.yaw) >
      0,
  );
}

interface Area {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const CROSSING: Area = { minX: -4, maxX: 4, minZ: -4, maxZ: 4 };
const ONCOMING: Area = { minX: -3, maxX: 0, minZ: -4, maxZ: 4 };
function intersects(pose: Pose, area: Area): boolean {
  const points = corners(pose);
  return (
    Math.min(...points.map((p) => p.x)) < area.maxX &&
    Math.max(...points.map((p) => p.x)) > area.minX &&
    Math.min(...points.map((p) => p.z)) < area.maxZ &&
    Math.max(...points.map((p) => p.z)) > area.minZ
  );
}

// Conservative swept-footprint windows for these two authored movement pairs.
// AABB overlap and a one-second clearance margin are training approximations.
function windowFor(
  id: MovementId,
  area: Area,
): { entry: number; exit: number } {
  let entry = Infinity,
    exit = -Infinity;
  for (let distance = 0; distance <= 65; distance += 0.05) {
    if (intersects(poseOnPath(id, distance), area)) {
      entry = Math.min(entry, distance);
      exit = distance;
    }
  }
  return { entry, exit };
}
const conflicts = {
  "south-north": {
    area: CROSSING,
    player: windowFor("south-north", CROSSING),
    traffic: windowFor("east-west", CROSSING),
  },
  "south-west": {
    area: ONCOMING,
    player: windowFor("south-west", ONCOMING),
    traffic: windowFor("north-south", ONCOMING),
  },
};

export function conflictState(
  id: ScenarioId,
  player: Vehicle,
  traffic: Vehicle,
) {
  const movements = movementsFor(id);
  const conflict = conflicts[movements.player];
  const playerDistance = distanceOnPath(movements.player, player);
  const trafficDistance = distanceOnPath(movements.traffic, traffic);
  const trafficCleared = trafficDistance > conflict.traffic.exit + 0.1;
  const timeToTraffic =
    Math.max(0, conflict.traffic.entry - trafficDistance) /
    Math.max(traffic.speed, 0.1);
  const timeToClear =
    Math.max(0, conflict.player.exit - playerDistance) /
      Math.max(player.speed, 2) +
    1;
  return {
    occupying: intersects(player, conflict.area),
    cleared: playerDistance > conflict.player.exit + CAR.width / 2,
    mustYield: !trafficCleared && timeToTraffic <= timeToClear,
    trafficCleared,
  };
}

export function advanceTraffic(
  id: ScenarioId,
  traffic: Vehicle,
  speed: number,
  dt: number,
) {
  const path = movementsFor(id).traffic;
  const distance = distanceOnPath(path, traffic) + speed * dt;
  Object.assign(traffic, poseOnPath(path, distance), { speed });
}
