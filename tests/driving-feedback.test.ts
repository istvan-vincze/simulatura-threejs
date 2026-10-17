import { expect, it } from "vitest";
import { createSession } from "../src/domain/session";
import { speedLabel, stopFeedback } from "../src/ui/driving-feedback";

it("only displays zero speed when the vehicle is actually stationary", () => {
  expect(speedLabel(0)).toBe("0");
  expect(speedLabel(0.01)).toBe("0.1");
  expect(speedLabel(0.1)).toBe("0.4");
  expect(speedLabel(10)).toBe("36");
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
