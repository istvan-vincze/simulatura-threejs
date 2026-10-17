import type { Session } from "../../src/domain/session";
import { distanceOnPath, poseOnPath } from "../../src/domain/movements";
import { CAR } from "../../src/domain/vehicle";
import type { Controls } from "../../src/domain/vehicle";

// Test driver uses only the same throttle, brake and steering inputs as a learner.
// It never places the player on the path or edits completion state.
export function followTurn(s: Session): Controls {
  const progress = distanceOnPath("south-west", s.player);
  const target = poseOnPath("south-west", progress + 2.5);
  const dx = target.x - s.player.x,
    dz = target.z - s.player.z;
  const heading = Math.atan2(dx, -dz);
  const error = Math.atan2(
    Math.sin(heading - s.player.yaw),
    Math.cos(heading - s.player.yaw),
  );
  const curvature = (2 * Math.sin(error)) / Math.hypot(dx, dz);
  const limit = 0.48 / (1 + s.player.speed * 0.07);
  return {
    throttle: s.player.speed < 1.8 ? 1 : 0,
    brake: s.player.speed > 2 ? 0.2 : 0,
    steer: Math.max(
      -1,
      Math.min(1, Math.atan(CAR.wheelbase * curvature) / limit),
    ),
    indicator: -1,
  };
}
