export type EventCode =
  | "stop"
  | "priority"
  | "signal"
  | "indicator"
  | "collision"
  | "lane"
  | "speed"
  | "route";
export interface LessonEvent {
  code: EventCode;
  time: number;
  message: string;
  severity: "success" | "error";
}
export function record(
  s: { events: LessonEvent[]; elapsed: number },
  code: EventCode,
  message: string,
  severity: LessonEvent["severity"] = "error",
) {
  const existing = s.events.find((e) => e.code === code);
  const event = { code, time: s.elapsed, message, severity };
  if (!existing) s.events.push(event);
  else if (existing.severity === "success" && severity === "error")
    Object.assign(existing, event);
}
