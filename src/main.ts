import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./ui/style.css";
import { mountInterface, renderLesson } from "./ui/interface";
import { createInput } from "./ui/input";
import { speedLabel, stopFeedback, turnFeedback } from "./ui/driving-feedback";
import { scenarios } from "./domain/scenarios";
import type { ScenarioId } from "./domain/scenarios";
import { createSession, passed, stepSession } from "./domain/session";
import { signalsAt } from "./domain/signals";
import { createScene } from "./scene/scene";
import type { CameraMode } from "./scene/scene";

mountInterface();
let session = createSession("priority");
let choice: number | null = null;
let camera: CameraMode = "overview";
let indicator: -1 | 0 | 1 = 0;
let routeVisible = true,
  panelKey = "",
  accumulator = 0;
let completed = new Set<string>();
let progressSaved = true;
try {
  const stored: unknown = JSON.parse(
    localStorage.getItem("simulatura.progress.v1") ?? "[]",
  );
  if (Array.isArray(stored))
    completed = new Set(
      stored.filter((id) => scenarios.some((s) => s.id === id)),
    );
} catch {
  /* Storage may be unavailable; practice still works. */
}
const viewport = document.querySelector<HTMLElement>("#viewport")!;
let world: ReturnType<typeof createScene> | undefined;
try {
  world = createScene(viewport);
} catch (error) {
  console.error("Unable to start 3D renderer", error);
  viewport.innerHTML =
    '<div class="render-error"><h2>A 3D nézet nem indult el.</h2><p>A gyakorlópályához WebGL 2 támogatás szükséges. Kapcsold be a böngésző hardveres gyorsítását, majd töltsd újra az oldalt.</p></div>';
}
const help = document.querySelector<HTMLDialogElement>("#help-dialog")!;
function setCamera(mode: CameraMode) {
  camera = mode;
  world?.setCamera(mode);
  document
    .querySelector(".simulation")!
    .classList.toggle("driver-view", mode === "driver");
  document.querySelectorAll<HTMLButtonElement>("[data-camera]").forEach((b) => {
    b.classList.toggle("active", b.dataset.camera === mode);
    b.setAttribute("aria-pressed", String(b.dataset.camera === mode));
  });
  document.querySelector("#scene-hint")!.textContent =
    mode === "overview"
      ? "Húzd az egeret a körülnézéshez · Görgess a nagyításhoz"
      : mode === "follow"
        ? "Kövesd a tanulóautót · C: kameraváltás"
        : "Húzd a nézetet a körülnézéshez · Dupla kattintás: előre";
}
function reset(id: ScenarioId = session.scenario) {
  session = createSession(id);
  choice = null;
  indicator = 0;
  accumulator = 0;
  input.clear();
  setCamera("overview");
  updatePanel();
}
function pause() {
  if (session.stage !== "drive") return;
  session.paused = !session.paused;
  input.clear();
  accumulator = 0;
}
const input = createInput((key) => {
  if (help.open) return;
  if (key === "KeyP") pause();
  if (key === "KeyR") reset();
  if (key === "KeyQ") indicator = indicator === -1 ? 0 : -1;
  if (key === "KeyE") indicator = indicator === 1 ? 0 : 1;
  if (key === "KeyC") {
    const modes: CameraMode[] = ["overview", "follow", "driver"];
    setCamera(modes[(modes.indexOf(camera) + 1) % modes.length]);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && session.stage === "drive") {
    session.paused = true;
    input.clear();
    accumulator = 0;
  }
});
window.addEventListener("blur", () => {
  if (session.stage === "drive") session.paused = true;
});
document.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button",
  );
  if (!button) return;
  if (button.dataset.indicator) {
    const direction = Number(button.dataset.indicator) as -1 | 1;
    indicator = indicator === direction ? 0 : direction;
  }
  if (button.dataset.scenario) reset(button.dataset.scenario as ScenarioId);
  if (button.dataset.camera) setCamera(button.dataset.camera as CameraMode);
  if (button.id === "center-look") world?.centerLook();
  if (button.dataset.answer !== undefined) {
    choice = Number(button.dataset.answer);
    updatePanel();
  }
  if (
    button.id === "start" &&
    world &&
    choice === scenarios.find((s) => s.id === session.scenario)!.answer
  ) {
    session.stage = "drive";
    input.clear();
    setCamera("follow");
    updatePanel();
  }
  if (button.id === "finish") {
    session.stage = "review";
    session.player.speed = 0;
    input.clear();
    updatePanel();
  }
  if (button.id === "reset" || button.id === "retry") reset();
  if (button.id === "next")
    reset(
      scenarios[
        (scenarios.findIndex((s) => s.id === session.scenario) + 1) %
          scenarios.length
      ].id,
    );
  if (button.id === "pause") pause();
  if (button.id === "route") {
    routeVisible = !routeVisible;
    world?.setRoute(routeVisible);
    button.classList.toggle("active", routeVisible);
    button.setAttribute("aria-pressed", String(routeVisible));
  }
  if (button.id === "help") {
    if (session.stage === "drive") session.paused = true;
    input.clear();
    help.showModal();
  }
  if (button.classList.contains("dialog-close")) help.close();
});
function updatePanel() {
  if (passed(session) && !completed.has(session.scenario)) {
    completed.add(session.scenario);
    try {
      localStorage.setItem(
        "simulatura.progress.v1",
        JSON.stringify([...completed]),
      );
      progressSaved = true;
    } catch {
      progressSaved = false;
    }
  }
  const eventsKey = session.events
    .map((e) => `${e.code}:${e.severity}`)
    .join(",");
  const key = `${session.scenario}:${session.stage}:${eventsKey}:${choice}:${completed.size}`;
  if (key !== panelKey) {
    renderLesson(
      session,
      scenarios.find((s) => s.id === session.scenario)!,
      choice,
      completed,
      progressSaved,
    );
    panelKey = key;
    if (!world) {
      const start = document.querySelector<HTMLButtonElement>("#start");
      if (start) start.disabled = true;
    }
  }
}
const speed = document.querySelector("#speed")!,
  timer = document.querySelector("#timer")!,
  gear = document.querySelector("#gear")!,
  status = document.querySelector("#drive-status")!,
  notice = document.querySelector("#drive-notice")!;
const pauseButton = document.querySelector<HTMLButtonElement>("#pause")!;
function updateDashboard() {
  speed.textContent = speedLabel(session.player.speed);
  timer.textContent = `${String(Math.floor(session.elapsed / 60)).padStart(2, "0")}:${String(Math.floor(session.elapsed % 60)).padStart(2, "0")}`;
  gear.textContent = session.stage === "drive" ? "D" : "P";
  status.textContent = session.paused
    ? "Szünet"
    : session.stage === "observe"
      ? "Megfigyelés"
      : session.stage === "review"
        ? "Értékelés"
        : session.scenario === "left-turn"
          ? "Balra kanyarodás"
          : "Egyenesen tovább";
  document
    .querySelectorAll<HTMLButtonElement>("[data-indicator]")
    .forEach((button) => {
      const active = Number(button.dataset.indicator) === indicator;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  pauseButton.disabled = session.stage !== "drive";
  pauseButton.classList.toggle("active", session.paused);
  pauseButton.setAttribute(
    "aria-label",
    session.paused ? "Folytatás" : "Szünet",
  );
  let message = "";
  if (session.stage === "drive") {
    if (session.paused)
      message = "Szünet · A folytatáshoz nyomd meg a P billentyűt.";
    else if (session.scenario === "signals" && !session.crossedLine) {
      const signal = signalsAt(session.elapsed).ns;
      message =
        signal === "green"
          ? "Zöld jelzés · Ha szabad az út, továbbhaladhatsz."
          : signal === "red-amber"
            ? "Piros-sárga · Még várj a vonal előtt."
            : signal === "amber"
              ? "Sárga jelzés · Állj meg, ha biztonságosan megteheted."
              : "Piros jelzés · Állj meg a vonal előtt.";
    } else if (session.scenario === "stop") message = stopFeedback(session);
    else if (session.scenario === "left-turn") message = turnFeedback(session);
  }
  if (notice.textContent !== message) notice.textContent = message;
  notice.classList.toggle("visible", !!message);
}
let previous = performance.now();
function frame(now: number) {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  const controls = { ...input.read(), indicator };
  if (session.stage === "drive" && !session.paused) {
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      stepSession(session, controls, 1 / 60);
      accumulator -= 1 / 60;
    }
  } else accumulator = 0;
  updatePanel();
  updateDashboard();
  world?.render(session, controls.brake > 0, indicator, dt);
  requestAnimationFrame(frame);
}
updatePanel();
setCamera("overview");
requestAnimationFrame(frame);
