import { corners, overlaps, CAR } from "./vehicle";
import type { Pose, Vehicle } from "./vehicle";
import type { EventCode, LessonEvent } from "./lesson-events";
import { signalsAt } from "./signals";
import {
  isOnCarriageway,
  STOP_LINE_ENTRY,
  STOP_LINE,
  STOP_LINE_THICKNESS,
  STOP_APPROACH_DISTANCE,
} from "./junction";

export type JunctionLayout = "priority" | "stop" | "signals";
export type Arm = "south" | "north" | "east" | "west";
export const ARMS: Record<
  Arm,
  { x: number; z: number; yaw: number; axis: "ns" | "ew" }
> = {
  south: { x: 0, z: 1, yaw: 0, axis: "ns" },
  north: { x: 0, z: -1, yaw: Math.PI, axis: "ns" },
  east: { x: 1, z: 0, yaw: -Math.PI / 2, axis: "ew" },
  west: { x: -1, z: 0, yaw: Math.PI / 2, axis: "ew" },
};
export const angleDifference = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function armAt(p: Pose): Arm | null {
  if (Math.abs(p.z) > 5 && Math.abs(p.z) >= Math.abs(p.x))
    return p.z > 0 ? "south" : "north";
  if (Math.abs(p.x) > 5) return p.x > 0 ? "east" : "west";
  return null;
}
export function frontDistance(p: Pose, arm: Arm) {
  const a = ARMS[arm];
  return Math.min(...corners(p).map((c) => c.x * a.x + c.z * a.z));
}
export function approaching(p: Pose, arm: Arm) {
  return Math.abs(angleDifference(p.yaw, ARMS[arm].yaw)) < 0.65;
}
export interface TrafficObservation {
  vehicle: Vehicle;
  from: Arm;
}
export interface Violation extends LessonEvent {
  id: number;
  rule: string;
  position: Pose;
  approach: Arm | null;
}
interface Visit {
  from: Arm;
  stopped: boolean;
  crossed: boolean;
  amberMayProceed: boolean;
  turn: -1 | 0 | 1;
  reported: Set<EventCode>;
}
export interface Evaluation {
  visit: Visit | null;
  indicator: number;
  indicatorSince: number;
  active: Map<string, number>;
  events: Violation[];
  total: number;
}
export const createEvaluation = (): Evaluation => ({
  visit: null,
  indicator: 0,
  indicatorSince: 0,
  active: new Map(),
  events: [],
  total: 0,
});

/** Shared evidence log for both the authored junction and imported street maps. */
export function reportViolation(
  e: Evaluation,
  code: EventCode,
  message: string,
  rule: string,
  time: number,
  position: Pose,
  approach: Arm | null = null,
) {
  e.total++;
  e.events.push({
    id: e.total,
    code,
    message,
    rule,
    severity: "error",
    time,
    position: { x: position.x, z: position.z, yaw: position.yaw },
    approach,
  });
  if (e.events.length > 100) e.events.shift();
}

// Priority relations are separate from predicted path conflict. A vehicle to
// the right does not cause a violation if the two actual movements are clear.
export function mustYield(
  from: Arm,
  other: Arm,
  turningLeft: boolean,
  layout: JunctionLayout,
) {
  const a = ARMS[from],
    b = ARMS[other];
  if (from === other) return false;
  if (layout === "stop" && a.axis !== b.axis) return a.axis === "ns";
  const oncoming = a.x * b.x + a.z * b.z < -0.5;
  if (oncoming) return turningLeft;
  return (
    layout === "priority" && b.x * Math.cos(a.yaw) + b.z * Math.sin(a.yaw) > 0.5
  );
}

/** Short-horizon collision envelope, not a planned/commanded route. */
export function pathsConflict(player: Vehicle, traffic: Vehicle) {
  const p = { ...player },
    t = { ...traffic };
  for (let i = 0; i <= 20; i++) {
    if (overlaps(p, t)) return true;
    const dt = 0.15;
    p.yaw += (p.speed / CAR.wheelbase) * Math.tan(p.steering) * dt;
    p.x += Math.sin(p.yaw) * p.speed * dt;
    p.z -= Math.cos(p.yaw) * p.speed * dt;
    t.x += Math.sin(t.yaw) * t.speed * dt;
    t.z -= Math.cos(t.yaw) * t.speed * dt;
  }
  return false;
}

export interface DrivingObservation {
  previous: Vehicle;
  player: Vehicle;
  traffic: readonly TrafficObservation[];
  layout: JunctionLayout;
  elapsed: number;
  previousTime: number;
  indicator: -1 | 0 | 1;
  direction: 1 | -1;
}

/** Emits evidence only: never ends a drive, awards a lesson, or assigns an exam score. */
export function evaluateDriving(e: Evaluation, o: DrivingObservation) {
  const { player: p, previous: old, elapsed: time, layout } = o;
  if (o.indicator !== e.indicator) {
    e.indicator = o.indicator;
    e.indicatorSince = time;
  }
  function emit(code: EventCode, message: string, rule: string) {
    reportViolation(e, code, message, rule, time, p, e.visit?.from ?? armAt(p));
  }
  function episode(
    key: string,
    condition: boolean,
    code: EventCode,
    message: string,
    rule: string,
  ) {
    if (!condition) return;
    if (!e.active.has(key)) emit(code, message, rule);
    e.active.set(key, time);
  }
  function once(code: EventCode, message: string, rule: string) {
    if (e.visit!.reported.has(code)) return;
    e.visit!.reported.add(code);
    emit(code, message, rule);
  }
  const points = corners(p);
  episode(
    "speed",
    p.speed * 3.6 > 50.5,
    "speed",
    "Túllépted az 50 km/h sebességhatárt.",
    "26. § (1) a)",
  );
  episode(
    "curb",
    points.some((c) => !isOnCarriageway(c.x, c.z)),
    "lane",
    "Elhagytad az úttestet; a járda nem vezetési terület.",
    "25. § (2)",
  );
  const arm = armAt(p);
  const wrongLane =
    arm !== null &&
    points.some((c) => {
      // Junction turns are evaluated on their exit, not against an approach lane.
      if (Math.abs(c.z) > 6 && Math.abs(Math.cos(p.yaw)) > 0.65)
        return c.x * Math.cos(p.yaw) < -0.12;
      if (Math.abs(c.x) > 6 && Math.abs(Math.sin(p.yaw)) > 0.65)
        return c.z * Math.sin(p.yaw) < -0.12;
      return false;
    });
  episode(
    "wrong-lane",
    wrongLane,
    "lane",
    "A menetirány szerinti bal oldali sávban haladsz.",
    "25. § (2)",
  );
  episode(
    "collision",
    o.traffic.some((t) => overlaps(p, t.vehicle)),
    "collision",
    "Ütközés a másik járművel.",
    "3. § (1) c)",
  );

  const oldArm = armAt(old);
  if (!e.visit && oldArm && approaching(old, oldArm) && o.direction === 1) {
    e.visit = {
      from: oldArm,
      stopped: false,
      crossed: false,
      amberMayProceed: false,
      turn: 0,
      reported: new Set(),
    };
  }
  if (e.visit) {
    const visit = e.visit;
    const reversedBehindLine =
      visit.crossed &&
      o.direction === -1 &&
      frontDistance(old, visit.from) < STOP_LINE_ENTRY &&
      frontDistance(p, visit.from) >= STOP_LINE_ENTRY;
    const exited =
      arm &&
      visit.crossed &&
      frontDistance(p, arm) > 5.2 &&
      Math.abs(angleDifference(p.yaw, ARMS[arm].yaw + Math.PI)) < 0.25;
    const abandoned =
      arm &&
      !visit.crossed &&
      frontDistance(p, visit.from) > 18 &&
      !approaching(p, arm);
    if (reversedBehindLine || exited || abandoned) e.visit = null;
  }
  const v = e.visit;
  if (v) {
    const front = frontDistance(p, v.from),
      oldFront = frontDistance(old, v.from);
    const axis = ARMS[v.from].axis;
    const lights = signalsAt(time)[axis],
      before = signalsAt(o.previousTime)[axis];
    if (before !== "amber" && lights === "amber")
      v.amberMayProceed =
        oldFront - STOP_LINE < old.speed * 0.7 + old.speed ** 2 / 10;
    if (!v.crossed) {
      if (front > STOP_LINE + STOP_APPROACH_DISTANCE + 1) v.stopped = false;
      if (
        front >= STOP_LINE_ENTRY &&
        front <= STOP_LINE + STOP_LINE_THICKNESS / 2 + STOP_APPROACH_DISTANCE &&
        p.speed === 0
      )
        v.stopped = true;
      if (
        oldFront >= STOP_LINE_ENTRY &&
        front < STOP_LINE_ENTRY &&
        o.direction === 1
      ) {
        v.crossed = true;
        if (layout === "stop" && axis === "ns" && !v.stopped)
          once(
            "stop",
            "Áthaladtál a STOP vonalán teljes megállás nélkül.",
            "12. § (1) b)",
          );
        if (
          layout === "signals" &&
          lights !== "green" &&
          !(lights === "amber" && v.amberMayProceed)
        )
          once(
            "signal",
            "Tiltó jelzésnél lépted át a megállás vonalát.",
            "9. § (4)",
          );
      }
    }
    const delta = angleDifference(p.yaw, ARMS[v.from].yaw);
    const atJunction = Math.abs(p.x) < 8 && Math.abs(p.z) < 8;
    if (!v.turn && atJunction && Math.abs(delta) > 0.2 && o.direction === 1) {
      v.turn = delta < 0 ? -1 : 1;
      if (o.indicator !== v.turn || time - e.indicatorSince < 1)
        once(
          "indicator",
          "A kanyarodás előtt időben jelezd a megfelelő irányt.",
          "29. § (2)",
        );
    }
    if (v.turn && o.indicator !== v.turn)
      once(
        "indicator",
        "Az irányjelzést a kanyar befejezéséig tartsd fenn.",
        "29. § (2)",
      );
    if (atJunction && front < 5 && p.speed > 0.1 && o.direction === 1) {
      for (const t of o.traffic) {
        const clearing =
          layout === "signals" &&
          ARMS[t.from].axis !== axis &&
          Math.abs(t.vehicle.x) < 6 &&
          Math.abs(t.vehicle.z) < 6;
        if (
          (mustYield(v.from, t.from, v.turn === -1, layout) || clearing) &&
          pathsConflict(p, t.vehicle)
        )
          once(
            "priority",
            "A másik jármű útjába hajtottál elsőbbségadás nélkül.",
            layout === "signals" ? "9. § (4); 31. § (5)" : "28. §; 31. § (5)",
          );
      }
    }
  }
  for (const [key, last] of e.active) if (time - last > 1) e.active.delete(key);
}
