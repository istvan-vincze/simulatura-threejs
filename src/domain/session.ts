import type { ScenarioId } from "./scenarios";
import { advanceVehicle, corners, overlaps, spawnPlayer } from "./vehicle";
import type { Controls, Vehicle } from "./vehicle";
import { signalsAt } from "./signals";
import {
  STOP_LINE,
  STOP_LINE_ENTRY,
  STOP_LINE_THICKNESS,
  STOP_APPROACH_DISTANCE,
  isOnCarriageway,
} from "./junction";

export type Stage = "observe" | "drive" | "review";
export type EventCode =
  "stop" | "priority" | "signal" | "collision" | "lane" | "speed" | "route";
export interface LessonEvent {
  code: EventCode;
  time: number;
  message: string;
  severity: "success" | "error";
}
export interface Session {
  scenario: ScenarioId;
  stage: Stage;
  elapsed: number;
  player: Vehicle;
  traffic: Vehicle;
  events: LessonEvent[];
  stopped: boolean;
  entered: boolean;
  crossedLine: boolean;
  completed: boolean;
  paused: boolean;
  amberMayProceed: boolean;
}
export function createSession(scenario: ScenarioId): Session {
  return {
    scenario,
    stage: "observe",
    elapsed: 0,
    player: spawnPlayer(),
    traffic: { x: 25, z: -1.85, yaw: -Math.PI / 2, speed: 4, steering: 0 },
    events: [],
    stopped: false,
    entered: false,
    crossedLine: false,
    completed: false,
    paused: false,
    amberMayProceed: false,
  };
}
function record(
  s: Session,
  code: EventCode,
  message: string,
  severity: LessonEvent["severity"] = "error",
) {
  if (!s.events.some((e) => e.code === code))
    s.events.push({ code, time: s.elapsed, message, severity });
}
export function stepSession(s: Session, input: Controls, dt: number): void {
  if (s.stage !== "drive" || s.paused) return;
  const before = signalsAt(s.elapsed).ns;
  s.elapsed += dt;
  const lights = signalsAt(s.elapsed);
  const oldFront = Math.min(...corners(s.player).map((p) => p.z));
  if (before !== "amber" && lights.ns === "amber") {
    // Amber permits clearing only when comfortable stopping is no longer possible.
    const stoppingDistance =
      s.player.speed * 0.7 + s.player.speed ** 2 / (2 * 5);
    s.amberMayProceed = oldFront - STOP_LINE < stoppingDistance;
  }
  advanceVehicle(s.player, input, dt);
  const points = corners(s.player);
  const front = Math.min(...points.map((p) => p.z));
  const trafficAtLine = s.traffic.x > 12.2 && s.traffic.x < 13;
  if (s.scenario === "signals" && lights.ew !== "green" && trafficAtLine)
    s.traffic.speed = 0;
  else s.traffic.speed = 4;
  s.traffic.x -= s.traffic.speed * dt;

  if (
    !s.stopped &&
    !s.crossedLine &&
    front >= STOP_LINE_ENTRY &&
    front <= STOP_LINE + STOP_LINE_THICKNESS / 2 + STOP_APPROACH_DISTANCE &&
    s.player.speed === 0
  ) {
    s.stopped = true;
    if (s.scenario === "stop")
      record(s, "stop", "Teljesen megálltál a vonal előtt.", "success");
  }
  if (
    !s.crossedLine &&
    oldFront >= STOP_LINE_ENTRY &&
    front < STOP_LINE_ENTRY
  ) {
    s.crossedLine = true;
    if (s.scenario === "stop" && !s.stopped)
      record(
        s,
        "stop",
        "A STOP vonal előtt teljesen meg kellett volna állnod.",
      );
    if (
      s.scenario === "signals" &&
      lights.ns !== "green" &&
      !(lights.ns === "amber" && s.amberMayProceed)
    )
      record(s, "signal", "Tiltó jelzésnél lépted át a megállás vonalát.");
  }
  if (!s.entered && front < 4) {
    s.entered = true;
    if (s.scenario !== "signals" && s.traffic.x > -6 && s.traffic.x < 22)
      record(
        s,
        "priority",
        "Az elsőbbséggel rendelkező kék autó előtt hajtottál be.",
      );
    else if (s.scenario !== "signals")
      record(
        s,
        "priority",
        "Megadtad az elsőbbséget a kék autónak.",
        "success",
      );
  }
  if (s.player.speed * 3.6 > 50.5)
    record(s, "speed", "Túllépted az 50 km/h sebességhatárt.");
  if (points.some((p) => !isOnCarriageway(p.x, p.z))) {
    record(s, "lane", "Elhagytad az úttestet. Próbáld meg kisebb sebességgel.");
    s.stage = "review";
  } else if (points.some((p) => p.x < 0 && Math.abs(p.z) > 5)) {
    record(s, "lane", "Átléptél a szembejövő forgalom sávjába.");
  }
  if (overlaps(s.player, s.traffic)) {
    record(
      s,
      "collision",
      "Ütköztél a kék autóval. Figyeld a keresztező forgalmat.",
    );
    s.stage = "review";
  }
  if (Math.abs(s.player.x) > 18 || s.player.z > 36) {
    record(
      s,
      "route",
      "A feladat útvonala egyenesen vezet át a kereszteződésen.",
    );
    s.stage = "review";
  }
  if (s.stage === "drive" && s.player.z < -24.2) {
    s.completed = true;
    s.stage = "review";
  }
  if (s.stage === "review") s.player.speed = 0;
}
export const passed = (s: Session): boolean =>
  s.completed && !s.events.some((e) => e.severity === "error");
