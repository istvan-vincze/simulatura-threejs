import type { Session } from "./session";
import { corners } from "./vehicle";
import { record } from "./lesson-events";

export interface TurnProgress {
  signalSince: number | null;
  started: boolean;
  finished: boolean;
}
export const INITIAL_TURN = (): TurnProgress => ({
  signalSince: null,
  started: false,
  finished: false,
});

export function evaluateLeftTurn(s: Session) {
  const turn = s.turn;
  if (s.indicator === -1) turn.signalSince ??= s.elapsed;
  else turn.signalSince = null;
  if (!turn.started && s.player.yaw < -0.12) {
    turn.started = true;
    // One second is a coaching threshold, not a statutory duration.
    if (turn.signalSince === null || s.elapsed - turn.signalSince < 1)
      record(
        s,
        "indicator",
        "A bal irányjelzést a kormányzás előtt, időben kezdd meg (Q vagy a bal index gomb).",
      );
  }
  if (turn.started && !turn.finished && s.indicator !== -1)
    record(
      s,
      "indicator",
      "A bal irányjelzőt a kanyarodás végéig tartsd bekapcsolva.",
    );
  const points = corners(s.player);
  if (
    !turn.finished &&
    turn.started &&
    points.every((p) => p.x < -4) &&
    Math.abs(s.player.yaw + Math.PI / 2) < 0.25
  ) {
    turn.finished = true;
    record(
      s,
      "indicator",
      "Időben jeleztél, és a kanyarodás végéig bekapcsolva hagytad a bal irányjelzőt.",
      "success",
    );
  }
  if (points.some((p) => (p.z > 5 && p.x < 0) || (p.x < -5 && p.z > 0)))
    record(
      s,
      "lane",
      "A kanyar előtt és után is maradj a menetirány szerinti jobb oldalon. Balra nagy ívben fordulj.",
    );
  if (s.player.z < -8 || s.player.x > 8 || s.player.z > 36) {
    record(
      s,
      "route",
      "Ebben a feladatban balra kell kanyarodnod. Kövesd a bal oldali utcába vezető útvonalat.",
    );
    s.stage = "review";
  }
}
