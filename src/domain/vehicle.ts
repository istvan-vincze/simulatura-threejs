export interface Pose {
  x: number;
  z: number;
  yaw: number;
}
export interface Vehicle extends Pose {
  speed: number;
  steering: number;
}
export interface Controls {
  throttle: number;
  brake: number;
  steer: number;
  indicator?: -1 | 0 | 1;
}
export const NEUTRAL: Controls = { throttle: 0, brake: 0, steer: 0 };
export const CAR = { length: 4.4, width: 1.82, wheelbase: 2.65 };
export const spawnPlayer = (): Vehicle => ({
  x: 1.85,
  z: 26,
  yaw: 0,
  speed: 0,
  steering: 0,
});

// Metres, seconds and radians. The visual model never owns vehicle motion.
export function advanceVehicle(v: Vehicle, input: Controls, dt: number): void {
  const steeringLimit = 0.48 / (1 + v.speed * 0.07);
  const desired = input.steer * steeringLimit;
  v.steering += (desired - v.steering) * (1 - Math.exp(-7 * dt));
  const acceleration =
    input.throttle * 3.8 -
    input.brake * 8 -
    (v.speed > 0 ? 0.28 + v.speed * 0.045 : 0);
  v.speed = Math.max(0, Math.min(17, v.speed + acceleration * dt));
  // Finish braking cleanly instead of retaining imperceptible residual motion.
  if (input.brake > 0 && input.throttle === 0 && v.speed < 0.05) v.speed = 0;
  v.yaw += (v.speed / CAR.wheelbase) * Math.tan(v.steering) * dt;
  v.x += Math.sin(v.yaw) * v.speed * dt;
  v.z -= Math.cos(v.yaw) * v.speed * dt;
}
export function corners(p: Pose): { x: number; z: number }[] {
  return [-1, 1].flatMap((side) =>
    [-1, 1].map((end) => ({
      x:
        p.x +
        ((side * CAR.width) / 2) * Math.cos(p.yaw) +
        ((end * CAR.length) / 2) * Math.sin(p.yaw),
      z:
        p.z +
        ((side * CAR.width) / 2) * Math.sin(p.yaw) -
        ((end * CAR.length) / 2) * Math.cos(p.yaw),
    })),
  );
}
export function overlaps(a: Pose, b: Pose): boolean {
  const ac = corners(a),
    bc = corners(b);
  return [a.yaw, b.yaw].every((yaw) =>
    [
      { x: Math.cos(yaw), z: Math.sin(yaw) },
      { x: Math.sin(yaw), z: -Math.cos(yaw) },
    ].every((axis) => {
      const pa = ac.map((p) => p.x * axis.x + p.z * axis.z),
        pb = bc.map((p) => p.x * axis.x + p.z * axis.z);
      return (
        Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa)
      );
    }),
  );
}
