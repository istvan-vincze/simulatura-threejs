import { expect, it } from "vitest";
import { createSession } from "../src/domain/session";
import {
  speedLabel,
  stopFeedback,
  turnFeedback,
} from "../src/ui/driving-feedback";

it("only displays zero speed when the vehicle is actually stationary", () => {
  expect(speedLabel(0)).toBe("0");
  expect(speedLabel(0.01)).toBe("0.1");
  expect(speedLabel(0.1)).toBe("0.4");
  expect(speedLabel(10)).toBe("36");
});
it("coaches signaling, yielding and cancellation through the left turn", () => {
  const s = createSession("left-turn");
  expect(turnFeedback(s)).toContain("Kapcsold be");
  s.indicator = -1;
  s.player.z = 4;
  s.traffic.z = -10;
  expect(turnFeedback(s)).toContain("engedd el");
  s.traffic.z = 8;
  expect(turnFeedback(s)).toContain("Szabad");
  s.turn.finished = true;
  expect(turnFeedback(s)).toContain("Kapcsold ki");
});
it("distinguishes an early stop, an accepted stop and a missed stop", () => {
  const s = createSession("stop");
  expect(stopFeedback(s)).toContain("Gurulj közelebb");
  s.player.z = 13;
  expect(stopFeedback(s)).toContain("Tartsd a féket");
  s.stopped = true;
  expect(stopFeedback(s)).toContain("Megállás elfogadva");
  s.stopped = false;
  s.crossedLine = true;
  expect(stopFeedback(s)).toContain("nem sikerült megállni");
});
