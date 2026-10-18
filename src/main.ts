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
import {
  createFreeRoam,
  createZugloFreeRoam,
  stepFreeRoam,
  changeDirection,
  recoverFreeRoam,
} from "./domain/free-roam";
import type { DrivingSession } from "./domain/free-roam";
import type { JunctionLayout } from "./domain/driving-evaluator";
import { updateMapPosition } from "./ui/map";
import { streetAt } from "./domain/driving-map";
import { renderFreeRoam } from "./ui/free-roam";

mountInterface();
let session: DrivingSession = createSession("priority");
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
let world: Awaited<ReturnType<typeof createScene>> | undefined;
const loading = document.createElement("div");
loading.className = "render-error";
loading.setAttribute("role", "status");
loading.textContent = "A gyakorlópálya betöltése…";
viewport.append(loading);
try {
  world = await createScene(viewport);
  loading.remove();
} catch (error) {
  console.error("Unable to start 3D renderer", error);
  viewport.innerHTML =
    '<div class="render-error"><h2>A 3D nézet nem indult el.</h2><p>Töltsd újra az oldalt. Ha a hiba megmarad, ellenőrizd a kapcsolatot és a böngésző hardveres gyorsítását. A gyakorlópályához WebGL 2 szükséges.</p></div>';
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
function startFreeRoam(layout?: JunctionLayout) {
  if (!world) return;
  session = layout ? createFreeRoam(layout) : createZugloFreeRoam();
  choice = null;
  indicator = 0;
  accumulator = 0;
  panelKey = "";
  input.clear();
  setCamera("follow");
  updatePanel();
}
function recover() {
  if (session.mode !== "free") return reset();
  recoverFreeRoam(session);
  indicator = 0;
  accumulator = 0;
  input.clear();
  world?.centerLook();
}
function shiftDirection() {
  if (session.mode === "free" && changeDirection(session)) input.clear();
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
  if (key === "KeyR") recover();
  if (key === "KeyX") shiftDirection();
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
  if (button.id === "free-roam" || button.id === "free-zuglo") startFreeRoam();
  if (button.id === "free-practice") startFreeRoam("signals");
  if (button.dataset.layout)
    startFreeRoam(button.dataset.layout as JunctionLayout);
  if (button.id === "free-new" && session.mode === "free")
    startFreeRoam(session.map ? undefined : session.scenario);
  if (button.id === "free-recover") recover();
  if (button.id === "direction") shiftDirection();
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
    session.mode === "lesson" &&
    world &&
    choice === scenarios.find((s) => s.id === session.scenario)!.answer
  ) {
    session.stage = "drive";
    input.clear();
    setCamera("follow");
    updatePanel();
  }
  if (button.id === "finish" && session.mode === "lesson") {
    session.stage = "review";
    session.player.speed = 0;
    input.clear();
    updatePanel();
  }
  if (button.id === "reset") recover();
  if (button.id === "retry") reset();
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
  const free = session.mode === "free";
  const freeButton = document.querySelector<HTMLButtonElement>("#free-roam")!;
  freeButton.disabled = !world;
  freeButton.classList.toggle("active", free);
  freeButton.setAttribute("aria-pressed", String(free));
  document.querySelector<HTMLButtonElement>("#direction")!.hidden = !free;
  document.querySelector<HTMLButtonElement>("#route")!.hidden = free;
  document.querySelector<HTMLElement>("#route-legend")!.hidden = free;
  document
    .querySelector("#reset")!
    .setAttribute(
      "aria-label",
      free ? "Vissza az induláshoz" : "Gyakorlat újrakezdése",
    );
  world?.setRoute(!free && routeVisible);
  if (session.mode === "free") {
    const key = `free:${session.map?.id ?? "practice"}:${session.scenario}:${session.evaluation.total}`;
    if (key !== panelKey) {
      renderFreeRoam(session);
      panelKey = key;
    }
    return;
  }
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
  const key = `lesson:${session.scenario}:${session.stage}:${eventsKey}:${choice}:${completed.size}`;
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
  const map = session.mode === "free" ? session.map : null;
  document.querySelector("#location-name")!.textContent = map
    ? streetAt(map, session.player)
    : "Hársfa tér";
  document.querySelector("#location-detail")!.textContent = map
    ? "Budapest XIV. · térképprototípus"
    : "Gyakorlópálya · Budapest";
  if (map) updateMapPosition(map, session.player);
  speed.textContent = speedLabel(session.player.speed);
  timer.textContent = `${String(Math.floor(session.elapsed / 60)).padStart(2, "0")}:${String(Math.floor(session.elapsed % 60)).padStart(2, "0")}`;
  gear.textContent =
    session.mode === "free" && session.direction === -1
      ? "R"
      : session.stage === "drive"
        ? "D"
        : "P";
  const directionButton =
    document.querySelector<HTMLButtonElement>("#direction")!;
  directionButton.textContent = gear.textContent;
  directionButton.disabled = session.player.speed !== 0;
  directionButton.setAttribute(
    "aria-label",
    session.mode === "free" && session.direction === -1
      ? "Előremenet kapcsolása · X"
      : "Hátramenet kapcsolása · X",
  );
  status.textContent = session.paused
    ? "Szünet"
    : session.mode === "free"
      ? "Szabad vezetés"
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
    else if (session.mode === "free") {
      const last = session.evaluation.events.at(-1);
      if (session.blocked === "edge")
        message =
          "A pálya vége · X: hátramenet álló helyzetben · R: vissza az induláshoz.";
      else if (session.blocked)
        message =
          "Megálltál az akadálynál · Tolass vissza (X), vagy térj vissza az induláshoz (R).";
      else if (last && session.elapsed - last.time < 6) message = last.message;
      else if (session.direction === -1)
        message =
          "Hátramenet · W: gáz · S / Space: fék · X: előremenet álló helyzetben.";
    } else if (session.scenario === "signals" && !session.crossedLine) {
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
      if (session.mode === "free") stepFreeRoam(session, controls, 1 / 60);
      else stepSession(session, controls, 1 / 60);
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
