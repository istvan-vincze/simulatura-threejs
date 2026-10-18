import type { DrivingMap } from "./driving-map";
import {
  atMapEdge,
  connectedRoads,
  mapJunctions,
  vehicleOnMap,
} from "./driving-map";
import { nearestRoad, roadDirectionIsWrong } from "./road-network";
import { angleDifference, reportViolation } from "./driving-evaluator";
import type { Evaluation } from "./driving-evaluator";
import type { EventCode } from "./lesson-events";
import { corners, overlaps } from "./vehicle";
import type { Vehicle } from "./vehicle";

export interface MapVisit {
  nodeId: string;
  incomingWay: string;
  heading: number;
  entered: boolean;
  turn: -1 | 0 | 1;
  reported: Set<EventCode>;
}
export interface MapEvaluation {
  visit: MapVisit | null;
}

/** Only judge facts represented by this map. Missing OSM signs do not imply
 * right-hand priority; those junctions are deliberately not priority-scored. */
export function evaluateMapDriving(
  map: DrivingMap,
  state: MapEvaluation,
  e: Evaluation,
  old: Vehicle,
  p: Vehicle,
  traffic: Vehicle,
  time: number,
  indicator: -1 | 0 | 1,
  direction: -1 | 1,
) {
  if (indicator !== e.indicator) {
    e.indicator = indicator;
    e.indicatorSince = time;
  }
  const emit = (code: EventCode, message: string, rule: string) =>
    reportViolation(e, code, message, rule, time, p);
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
  const nearest = nearestRoad(map, p);
  const limit =
    map.roads.find((r) => r.id === nearest?.road.id)?.speedLimit ?? 50;
  episode(
    "speed",
    p.speed * 3.6 > limit + 0.5,
    "speed",
    `Túllépted a ${limit} km/h sebességhatárt.`,
    "26. § (1) a)",
  );
  episode(
    "curb",
    !vehicleOnMap(map, p) && !atMapEdge(map, p),
    "lane",
    "Elhagytad az úttestet; a járda nem vezetési terület.",
    "25. § (2)",
  );
  const junctions = mapJunctions(map);
  // Lane centre-lines meet at both branching junctions and two-edge bends.
  // Do not compare a turning footprint against just one of those approach lines.
  const nearJunction =
    map.nodes.some(
      (n) =>
        connectedRoads(map, n.id).length >= 2 &&
        Math.hypot(p.x - n.x, p.z - n.z) < 11,
    ) ||
    map.roads.some((r) =>
      r.points.some((b, i) => {
        if (
          !i ||
          i === r.points.length - 1 ||
          Math.hypot(p.x - b.x, p.z - b.z) >= 11
        )
          return false;
        const a = r.points[i - 1],
          c = r.points[i + 1];
        return (
          Math.abs(
            angleDifference(
              Math.atan2(b.x - a.x, a.z - b.z),
              Math.atan2(c.x - b.x, b.z - c.z),
            ),
          ) > 0.25
        );
      }),
    );
  episode(
    "wrong-lane",
    !nearJunction &&
      corners(p).some((c) => roadDirectionIsWrong(map, { ...c, yaw: p.yaw })),
    "lane",
    nearest?.road.direction
      ? "Az egyirányú utcában a tiltott irányba haladsz."
      : "A menetirány szerinti bal oldali sávban haladsz.",
    "25. § (2); 17. § (1) a)",
  );
  episode(
    "collision",
    overlaps(p, traffic),
    "collision",
    "Ütközés a másik járművel.",
    "3. § (1) c)",
  );

  if (!state.visit && direction === 1) {
    const r = nearestRoad(map, old)?.road;
    const n = junctions.find(
      (n) =>
        r &&
        (n.id === r.from || n.id === r.to) &&
        Math.hypot(old.x - n.x, old.z - n.z) < 24 &&
        Math.hypot(old.x - n.x, old.z - n.z) > 9 &&
        Math.abs(
          angleDifference(old.yaw, Math.atan2(n.x - old.x, old.z - n.z)),
        ) < 0.4,
    );
    if (n && r)
      state.visit = {
        nodeId: n.id,
        incomingWay: (r as DrivingMap["roads"][number]).osmWay,
        heading: old.yaw,
        entered: false,
        turn: 0,
        reported: new Set(),
      };
  }
  const v = state.visit;
  if (v) {
    const n = map.nodes.find((n) => n.id === v.nodeId)!;
    const distance = Math.hypot(p.x - n.x, p.z - n.z);
    if (distance < 8) v.entered = true;
    const outward =
      Math.cos(p.yaw) * (n.z - p.z) * -1 + Math.sin(p.yaw) * (n.x - p.x);
    function once(code: EventCode, message: string, rule: string) {
      if (v!.reported.has(code)) return;
      v!.reported.add(code);
      emit(code, message, rule);
    }
    // Reversing/abandoning an approach rearms the next visit; cancelling a
    // completed turn must not be mistaken for cancelling during the turn.
    if (distance > 11 && outward < -distance * 0.8) {
      const exit = nearestRoad(map, p)?.road as
        DrivingMap["roads"][number] | undefined;
      if (exit && v.entered && direction === 1) {
        const illegal = map.restrictions.some(
          (r) =>
            r.via === n.id &&
            r.fromWay === v.incomingWay &&
            (r.kind.startsWith("only_")
              ? exit.osmWay !== r.toWay
              : exit.osmWay === r.toWay),
        );
        if (illegal)
          once(
            "route",
            "A térképen jelölt kanyarodási tilalom ellenére hajtottál tovább.",
            "13. §; 31. §",
          );
      }
      state.visit = null;
    } else if (distance > 30 || (direction === -1 && distance > 14))
      state.visit = null;
    else {
      const delta = angleDifference(p.yaw, v.heading);
      if (
        !v.turn &&
        distance < 10 &&
        Math.abs(delta) > 0.25 &&
        direction === 1
      ) {
        v.turn = delta < 0 ? -1 : 1;
        if (indicator !== v.turn || time - e.indicatorSince < 1)
          once(
            "indicator",
            "A kanyarodás előtt időben jelezd a megfelelő irányt.",
            "29. § (2)",
          );
      }
      if (v.turn && indicator !== v.turn)
        once(
          "indicator",
          "Az irányjelzést a kanyar befejezéséig tartsd fenn.",
          "29. § (2)",
        );
    }
  }
  for (const [key, last] of e.active) if (time - last > 1) e.active.delete(key);
}
