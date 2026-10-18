import {
  zuglo,
  mapSpawn,
  vehicleOnMap,
  atMapEdge,
  crossesMapBoundary,
} from "./driving-map";
import type { DrivingMap } from "./driving-map";
import { createMapTraffic, trafficPose, stepMapTraffic } from "./map-traffic";
import type { MapTraffic } from "./map-traffic";
import { evaluateMapDriving } from "./map-evaluator";
import type { MapEvaluation } from "./map-evaluator";
import { advanceVehicle, corners, overlaps, spawnPlayer } from "./vehicle";
import type { Controls, Vehicle } from "./vehicle";
import type { Session } from "./session";
import { isOnCarriageway } from "./junction";
import { signalsAt } from "./signals";
import {
  createEvaluation,
  evaluateDriving,
  armAt,
  approaching,
  frontDistance,
  mustYield,
  pathsConflict,
} from "./driving-evaluator";
import type { Evaluation, JunctionLayout } from "./driving-evaluator";

export interface FreeRoam {
  mode: "free";
  map: DrivingMap | null;
  mapEvaluation: MapEvaluation;
  mapTraffic: MapTraffic | null;
  scenario: JunctionLayout;
  stage: "drive";
  player: Vehicle;
  traffic: Vehicle;
  elapsed: number;
  paused: boolean;
  direction: 1 | -1;
  evaluation: Evaluation;
  blocked: "curb" | "edge" | "collision" | null;
}
export type DrivingSession = Session | FreeRoam;
export const ROAD_END = 47;
export function createFreeRoam(scenario: JunctionLayout = "signals"): FreeRoam {
  return {
    mode: "free",
    map: null,
    mapEvaluation: { visit: null },
    mapTraffic: null,
    scenario,
    stage: "drive",
    player: spawnPlayer(),
    traffic: { x: 39, z: -1.85, yaw: -Math.PI / 2, speed: 4, steering: 0 },
    elapsed: 0,
    paused: false,
    direction: 1,
    evaluation: createEvaluation(),
    blocked: null,
  };
}
export function createZugloFreeRoam(): FreeRoam {
  const session = createFreeRoam("priority");
  session.map = zuglo;
  session.player = mapSpawn(zuglo);
  session.mapTraffic = createMapTraffic(zuglo);
  session.traffic = trafficPose(session.mapTraffic);
  return session;
}
export function changeDirection(s: FreeRoam) {
  if (s.player.speed !== 0) return false;
  s.direction = s.direction === 1 ? -1 : 1;
  return true;
}
export function recoverFreeRoam(s: FreeRoam) {
  s.player = s.map ? mapSpawn(s.map) : spawnPlayer();
  s.mapEvaluation.visit = null;
  if (
    s.mapTraffic &&
    Math.hypot(s.player.x - s.traffic.x, s.player.z - s.traffic.z) < 10
  ) {
    s.mapTraffic.distance =
      (s.mapTraffic.distance + s.mapTraffic.length / 2) % s.mapTraffic.length;
    s.traffic = trafficPose(s.mapTraffic);
  }
  s.direction = 1;
  s.blocked = null;
  s.evaluation.visit = null;
  s.evaluation.indicator = 0;
  s.evaluation.indicatorSince = s.elapsed;
  s.evaluation.active.clear();
}

export function stepFreeRoam(s: FreeRoam, input: Controls, dt: number) {
  if (s.paused) return;
  const previousTime = s.elapsed;
  s.elapsed += dt;
  const previous = { ...s.player };
  advanceVehicle(s.player, input, dt, s.direction);

  if (s.map && s.mapTraffic) {
    stepMapTraffic(s.mapTraffic, s.traffic, s.player, dt);
    evaluateMapDriving(
      s.map,
      s.mapEvaluation,
      s.evaluation,
      previous,
      s.player,
      s.traffic,
      s.elapsed,
      input.indicator ?? 0,
      s.direction,
    );
    s.blocked = crossesMapBoundary(s.map, s.player)
      ? "edge"
      : !vehicleOnMap(s.map, s.player)
        ? atMapEdge(s.map, s.player)
          ? "edge"
          : "curb"
        : overlaps(s.player, s.traffic)
          ? "collision"
          : null;
    if (s.blocked)
      Object.assign(s.player, previous, {
        speed: 0,
        steering: s.player.steering,
      });
    return;
  }

  // The crossing car repeats its route, respects signals, and yields to a
  // conflicting vehicle with priority. It never respawns on top of the learner.
  const t = s.traffic;
  let desiredSpeed = 4;
  const front = t.x - 2.2;
  const from = s.evaluation.visit?.from ?? armAt(s.player);
  if (
    s.scenario === "signals" &&
    signalsAt(s.elapsed).ew !== "green" &&
    front >= 9.8
  )
    desiredSpeed = Math.min(4, Math.max(0, (front - 10) / dt));
  if (
    from &&
    front >= 5 &&
    s.player.speed > 0.1 &&
    (approaching(s.player, from) || frontDistance(s.player, from) < 6) &&
    mustYield("east", from, false, s.scenario) &&
    pathsConflict({ ...t, speed: 4 }, s.player)
  )
    desiredSpeed = Math.min(desiredSpeed, Math.max(0, (front - 5) / dt));
  const next = { ...t, x: t.x - desiredSpeed * dt, speed: desiredSpeed };
  if (!overlaps(next, s.player)) Object.assign(t, next);
  else t.speed = 0;
  if (t.x < -43) {
    const spawn = { ...t, x: 43, speed: 4 };
    if (Math.hypot(s.player.x - spawn.x, s.player.z - spawn.z) > 10)
      Object.assign(t, spawn);
    else t.speed = 0;
  }

  // Observe the attempted movement before containing a curb or collision.
  // The evaluator owns evidence; the world owns physical movement constraints.
  evaluateDriving(s.evaluation, {
    previous,
    player: s.player,
    traffic: [{ vehicle: t, from: "east" }],
    layout: s.scenario,
    elapsed: s.elapsed,
    previousTime,
    indicator: input.indicator ?? 0,
    direction: s.direction,
  });
  const points = corners(s.player);
  s.blocked = points.some(
    (p) => Math.abs(p.x) > ROAD_END || Math.abs(p.z) > ROAD_END,
  )
    ? "edge"
    : points.some((p) => !isOnCarriageway(p.x, p.z))
      ? "curb"
      : overlaps(s.player, t)
        ? "collision"
        : null;
  if (s.blocked) {
    Object.assign(s.player, previous, {
      speed: 0,
      steering: s.player.steering,
    });
  }
}
