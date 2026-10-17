import type { Session } from "../domain/session";
import { corners } from "../domain/vehicle";
import { conflictState } from "../domain/movements";
import {
  STOP_LINE,
  STOP_LINE_THICKNESS,
  STOP_APPROACH_DISTANCE,
} from "../domain/junction";

export function speedLabel(speed: number): string {
  if (speed === 0) return "0";
  const kmh = speed * 3.6;
  return kmh < 1 ? Math.max(0.1, kmh).toFixed(1) : String(Math.round(kmh));
}

export function stopFeedback(session: Session): string {
  if (session.crossedLine && !session.stopped)
    return "A vonal előtt nem sikerült megállni · Újrapróbálás: R.";
  if (session.stopped)
    return "Megállás elfogadva ✓ · Adj elsőbbséget, majd haladj a célkapuig.";
  const distance = Math.max(
    0,
    Math.min(...corners(session.player).map((p) => p.z)) -
      (STOP_LINE + STOP_LINE_THICKNESS / 2),
  );
  if (session.player.speed === 0 && distance > STOP_APPROACH_DISTANCE)
    return `Még ${distance.toFixed(1)} m a vonal · Gurulj közelebb, majd állj meg újra.`;
  return `STOP · ${distance.toFixed(1)} m a vonalig · Tartsd a féket a teljes megállásig.`;
}

export function turnFeedback(session: Session): string {
  if (session.turn.finished)
    return "Kanyar kész · Kapcsold ki az indexet, és haladj a célkapuig.";
  if (session.indicator !== -1)
    return "Balra kanyarodás · Kapcsold be a bal indexet: Q vagy a bal index gomb.";
  const conflict = conflictState(
    session.scenario,
    session.player,
    session.traffic,
  );
  if (conflict.mustYield)
    return "Bal index bekapcsolva · Lassíts, engedd el a szemből érkezőt. Ne fordulj a sávjába.";
  return "Szabad a kanyar útja · Kis sebességgel, nagy ívben fordulj balra (A / ←). Tartsd az indexet.";
}
