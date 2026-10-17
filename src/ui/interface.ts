import type { Scenario } from "../domain/scenarios";
import { scenarios, RULE_SOURCE } from "../domain/scenarios";
import type { Session } from "../domain/session";
import { passed } from "../domain/session";
export const icon = (
  name:
    | "arrow"
    | "reset"
    | "camera"
    | "book"
    | "route"
    | "pause"
    | "help"
    | "check",
) => {
  const paths = {
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    reset: '<path d="M4 9a8 8 0 1 1 0 6M4 4v5h5"/>',
    camera:
      '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
    book: '<path d="M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v15c-4 0-6 0-9 2-3-2-5-2-9-2z"/>',
    route:
      '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M5 7v7a5 5 0 0 0 5 5h7M12 5h7v7m-6-1 6-6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 1-1 2m0 2v1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};
export function mountInterface() {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <header class="app-header"><a class="brand" href="./" aria-label="Simulatura kezdőlap"><span class="brand-mark"><i></i><i></i><i></i></span>simulatura<span class="brand-dot">.</span></a>
      <span class="header-divider"></span><span class="header-label">KRESZ MŰHELY</span><span class="edition">Első fejezet <span>·</span> Városi kereszteződések</span>
      <button class="icon-button" id="help" aria-label="Irányítás és tudnivalók">${icon("help")}</button></header>
    <main class="workspace"><aside class="sidebar">
      <div class="chapter"><span class="eyebrow">TANULJ TAPASZTALATBÓL</span><h1>Minden döntés<br>számít.</h1><p>Figyeld meg. Értsd meg. Vezess.</p></div>
      <div class="lesson-navigation"><div class="section-label">GYAKORLATOK <span id="progress">0 / ${scenarios.length}</span></div><nav aria-label="Gyakorlatok">${scenarios.map((s) => `<button class="lesson-button" data-scenario="${s.id}"><span class="lesson-number">${s.number}</span><span><strong>${s.title}</strong><small>${s.subtitle}</small></span><span class="lesson-status" data-status="${s.id}">↗</span></button>`).join("")}</nav></div>
      <div id="lesson-panel"></div>
      <footer class="sidebar-footer"><span class="status-dot"></span> Saját tempóban. Biztonságos környezetben.<a href="${RULE_SOURCE}" target="_blank" rel="noreferrer">KRESZ · 2026.04.11-i szöveg ↗</a></footer>
    </aside>
    <section class="simulation" aria-label="Gyakorlópálya"><div id="viewport"></div>
      <div class="scene-top"><div class="location-tag"><span class="status-dot"></span><span>Hársfa tér <small>Gyakorlópálya · Budapest</small></span></div><span class="weather">☀ <span>Nappal · Száraz út</span></span></div>
      <div class="camera-bar" role="group" aria-label="Kameranézet"><button data-camera="overview" class="active">${icon("camera")} Áttekintés</button><button data-camera="follow">Követés</button><button data-camera="driver">Vezetőülés</button></div>
      <div class="scene-tools"><button id="route" class="icon-button active" aria-label="Útvonal megjelenítése" aria-pressed="true" title="Útvonal">${icon("route")}</button><button id="reset" class="icon-button" aria-label="Gyakorlat újrakezdése" title="Újrakezdés · R">${icon("reset")}</button><button id="pause" class="icon-button" aria-label="Szünet" title="Szünet · P">${icon("pause")}</button></div>
      <div class="scene-hint" id="scene-hint">Húzd az egeret a körülnézéshez · Görgess a nagyításhoz</div>
      <div class="drive-notice" id="drive-notice" role="status"></div>
      <div class="legend"><span><i class="player-dot"></i> Te</span><span><i class="traffic-dot"></i> Másik jármű</span><span><i class="route-dot"></i> Útvonal</span></div>
      <div class="dashboard"><div class="speedometer"><span id="speed">0</span><span>km/h<small>SEBESSÉG</small></span></div><div class="dash-divider"></div><div class="drive-state"><span id="gear">P</span><small id="drive-status">Megfigyelés</small></div><div class="speed-limit" title="Lakott területen érvényes sebességhatár">50</div><div class="keyboard-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>vezetés</span><kbd>SPACE</kbd><span>fék</span></div><div class="lesson-timer"><span id="timer">00:00</span><small>ELTELT IDŐ</small></div></div>
      <div class="indicator-controls" role="group" aria-label="Irányjelzők"><button data-indicator="-1" aria-pressed="false" aria-label="Bal irányjelző">◀ <span>Bal index</span> <kbd>Q</kbd></button><button data-indicator="1" aria-pressed="false" aria-label="Jobb irányjelző"><kbd>E</kbd> <span>Jobb index</span> ▶</button></div>
      <div class="touch-controls" aria-label="Vezérlés"><button data-control="left" aria-label="Balra kormányzás">←</button><button data-control="right" aria-label="Jobbra kormányzás">→</button><button data-control="brake">Fék</button><button data-control="throttle">Gáz</button></div>
      <div class="scene-caption"><span>SIMULATURA / INTERAKTÍV KRESZ GYAKORLÁS</span><span>01 — ${String(scenarios.length).padStart(2, "0")}</span></div>
    </section></main>
    <dialog id="help-dialog"><button class="dialog-close" aria-label="Bezárás">×</button><span class="eyebrow">JÓ UTAT!</span><h2>A tudásból rutin lesz.</h2><p>Válassz egy gyakorlatot, válaszolj a kérdésre, majd vezess át a kereszteződésen. A narancsszínű tanulóautó a tiéd.</p><dl><dt>W / ↑</dt><dd>Gáz</dd><dt>S / ↓ / Space</dt><dd>Fék</dd><dt>A D / ← →</dt><dd>Kormányzás</dd><dt>Q / E</dt><dd>Bal / jobb irányjelző</dd><dt>C</dt><dd>Kameraváltás</dd><dt>P / R</dt><dd>Szünet / újrakezdés</dd></dl><p class="muted">Az első három gyakorlat egyenes áthaladást, a negyedik balra kanyarodást tanít. A gyalogosok, kerékpárosok és villamosok még nem részei ennek a változatnak.</p><a href="${RULE_SOURCE}" target="_blank" rel="noreferrer">Hatályos KRESZ a Nemzeti Jogszabálytárban ↗</a></dialog>`;
}
export function renderLesson(
  s: Session,
  lesson: Scenario,
  choice: number | null,
  completions: Set<string>,
  progressSaved = true,
) {
  document
    .querySelectorAll<HTMLButtonElement>("[data-scenario]")
    .forEach((b) => {
      const active = b.dataset.scenario === s.scenario;
      b.classList.toggle("selected", active);
      b.classList.toggle("completed", completions.has(b.dataset.scenario!));
      b.setAttribute("aria-current", String(active));
    });
  document.querySelector("#progress")!.textContent =
    `${completions.size} / ${scenarios.length}`;
  document
    .querySelectorAll<HTMLElement>("[data-status]")
    .forEach(
      (el) =>
        (el.textContent = completions.has(el.dataset.status!) ? "✓" : "↗"),
    );
  const correct = choice === lesson.answer;
  const steps = `<div class="steps"><span class="${s.stage === "observe" ? "current" : "done"}">01 · Döntés</span><span class="${s.stage === "drive" ? "current" : s.stage === "review" ? "done" : ""}">02 · Vezetés</span><span class="${s.stage === "review" ? "current" : ""}">03 · Értékelés</span></div>`;
  let content: string;
  if (s.stage === "observe")
    content = `<p class="description">${lesson.description}</p><h2 class="question">${lesson.question}</h2><div class="answers">${lesson.choices.map((c, i) => `<button data-answer="${i}" class="answer ${choice === i ? (correct ? "correct" : "incorrect") : ""}"><span>${String.fromCharCode(65 + i)}</span>${c}${choice === i ? `<b>${correct ? "✓" : "×"}</b>` : ""}</button>`).join("")}</div>${choice !== null ? `<div class="answer-feedback ${correct ? "positive" : ""}" role="status"><strong>${correct ? "Pontosan." : "Gondold át még egyszer."}</strong> ${correct ? lesson.explanation : "Nézd meg, mi szabályozza az áthaladást ebben a helyzetben."}</div>` : '<p class="answer-prompt">Nézz körül a pályán, majd válassz egy választ.</p>'}<button class="primary" id="start" ${!correct ? "disabled" : ""}>Vezessük le ${icon("arrow")}</button>`;
  else if (s.stage === "drive")
    content = `<span class="eyebrow">MOST RAJTAD A SOR</span><h2 class="question">${lesson.id === "left-turn" ? "Irány a bal oldali utca." : "Irány a túloldal."}</h2><p class="description">${lesson.description}</p><ol class="objectives">${lesson.objectives.map((o) => `<li>${o}</li>`).join("")}</ol><div class="tip">${icon("book")}<p>Finoman a gázzal. A fékezéshez tartsd nyomva az <strong>S</strong> vagy <strong>Space</strong> billentyűt.</p></div><div class="event-list">${s.events.map((e) => `<p class="${e.severity}">${e.severity === "error" ? "!" : "✓"} ${e.message}</p>`).join("")}</div><button class="secondary" id="finish">Gyakorlat befejezése</button>`;
  else
    content = `<div class="result-icon ${passed(s) ? "success" : ""}">${passed(s) ? "✓" : "↻"}</div><span class="eyebrow">${passed(s) ? "SIKERES GYAKORLAT" : "MINDEN PRÓBA TANÍT"}</span><h2>${passed(s) ? "Szép, nyugodt áthaladás." : "Nézzük meg együtt."}</h2><p class="description">${passed(s) ? "Jól döntöttél, és a vezetés során is figyeltél a szabályokra." : !s.completed && !s.events.some((e) => e.severity === "error") ? "A gyakorlatot a cél előtt fejezted be. Próbáld meg újra, és haladj át a célkapun." : "A következő próbán ezekre figyelj:"}</p><div class="event-list">${s.events.map((e) => `<p class="${e.severity}"><time>${e.time.toFixed(1)} s</time>${e.message}</p>`).join("")}</div><div class="rule-recap">${lesson.explanation}</div><button class="primary" id="retry">Újrapróbálom ${icon("reset")}</button>${passed(s) ? `<button class="secondary" id="next">${lesson.id === scenarios.at(-1)!.id ? "Vissza az első gyakorlathoz" : "Következő gyakorlat"} ${icon("arrow")}</button>` : ""}`;
  const completionNotice =
    s.stage === "review" && passed(s)
      ? `<p class="completion-notice ${progressSaved ? "" : "unsaved"}" role="status">${
          progressSaved
            ? `Teljesítve és elmentve · ${completions.size} / ${scenarios.length} gyakorlat.`
            : "Teljesítve, de a böngésző nem engedte menteni. Az eredmény csak ezen a megnyitott oldalon marad meg."
        }</p>`
      : "";
  document.querySelector("#lesson-panel")!.innerHTML =
    `${steps}<section class="lesson-content">${completionNotice}${content}<a class="rule-link" href="${RULE_SOURCE}" target="_blank" rel="noreferrer">${lesson.rule} ↗</a></section>`;
}
