// Shared by the painted marking, evaluation and coaching display (metres).
export const STOP_LINE = 10;
export const STOP_LINE_THICKNESS = 0.35;
// Allow alignment anywhere on the painted stripe; crossing its far edge is entry.
export const STOP_LINE_ENTRY = STOP_LINE - STOP_LINE_THICKNESS / 2;
export const STOP_APPROACH_DISTANCE = 3;

export const ROAD_HALF_WIDTH = 4;
export const CORNER_RADIUS = 1.2;

export function isOnCarriageway(x: number, z: number): boolean {
  x = Math.abs(x);
  z = Math.abs(z);
  if (x <= ROAD_HALF_WIDTH || z <= ROAD_HALF_WIDTH) return true;
  const center = ROAD_HALF_WIDTH + CORNER_RADIUS;
  return (
    x < center &&
    z < center &&
    Math.hypot(x - center, z - center) >= CORNER_RADIUS
  );
}
