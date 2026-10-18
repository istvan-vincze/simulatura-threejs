import { renderMap } from "./map";
import type { FreeRoam } from "../domain/free-roam";
import { RULE_SOURCE } from "../domain/scenarios";

export function renderFreeRoam(s: FreeRoam) {
  document.querySelectorAll<HTMLElement>("[data-scenario]").forEach((b) => {
    b.classList.remove("selected");
    b.setAttribute("aria-current", "false");
  });
  const events = s.evaluation.events.slice(-12).reverse();
  document.querySelector("#lesson-panel")!.innerHTML = `
    <section class="lesson-content free-roam-panel">
      <span class="eyebrow">SZABAD VEZETÉS</span>
      <h2>${s.map ? "Zugló, a te útvonaladon." : "Te választod az irányt."}</h2>
      <p class="description">${s.map ? "Újvidék tér és környéke: 23 kereszteződés, valódi utcahálózat. Fordulj, kerülj meg egy háztömböt, fedezd fel a környéket." : "Nincs kérdés vagy célkapu. Vezess a tér négy utcáján; a szabályellenőrzés menet közben is működik."}</p>
      <div class="map-switch" role="group" aria-label="Pálya"><button id="free-zuglo" class="${s.map ? "active" : ""}" aria-pressed="${!!s.map}">Zugló</button><button id="free-practice" class="${s.map ? "" : "active"}" aria-pressed="${!s.map}">Gyakorlótér</button></div>
      ${s.map ? renderMap(s.map) : ""}
      <div class="free-layouts" ${s.map ? "hidden" : ""} role="group" aria-label="Új menet forgalmi rendje">
        <span class="section-label">ÚJ MENET FORGALMI RENDJE</span>
        ${(
          [
            ["priority", "Jobbkéz"],
            ["stop", "STOP"],
            ["signals", "Lámpák"],
          ] as const
        )
          .map(
            ([id, label]) =>
              `<button data-layout="${id}" class="${s.scenario === id ? "active" : ""}" aria-pressed="${s.scenario === id}">${label}</button>`,
          )
          .join("")}
      </div>
      <div class="tip"><p><strong>W / S:</strong> gáz / fék · <strong>A / D:</strong> kormány · <strong>Q / E:</strong> index.<br><strong>X:</strong> előre / hátramenet, csak álló helyzetben. A gáz mindkét irányban W.<br><strong>R:</strong> vissza az induláshoz, a napló megmarad.</p></div>
      <div class="section-label">SZABÁLYSZEGÉSEK <span id="violation-count">${s.evaluation.total}</span></div>
      <div class="event-list violation-log" aria-label="Szabályszegések naplója">${events.length ? events.map((e) => `<p class="error"><time>${Math.floor(e.time / 60)}:${String(Math.floor(e.time % 60)).padStart(2, "0")}</time>${e.message}<small>KRESZ ${e.rule}</small></p>`).join("") : '<p class="description">Még nincs észlelt szabályszegés.</p>'}</div>
      ${s.evaluation.total > 12 ? '<p class="muted">A legutóbbi 12 esemény látható.</p>' : ""}
      <button class="secondary" id="free-recover">Vissza az induláshoz · R</button>
      <button class="secondary" id="free-new">Új menet, üres naplóval</button>
      <p class="description muted">${s.map ? "Ellenőrzés: sebesség, menetirány, sávtartás, indexelés, térképi kanyarodási tilalmak és ütközés. A helyi elsőbbségi táblák és lámpák még nincsenek ellenőrizve; itt ezeket nem értékeljük. STOP- és lámpás gyakorláshoz válaszd a Gyakorlóteret. Az utcaszélességek és a házak részletei becsültek." : "A pálya véges: az utca végén állj meg, majd tolass vagy térj vissza az induláshoz. A jelzések, elsőbbség, irányjelzés, sebesség, sávtartás és ütközések ellenőrzése működik."} Gyalogosok és kerékpárosok még nincsenek; ez még nem vizsgamód.</p>
      <a class="rule-link" href="${RULE_SOURCE}" target="_blank" rel="noreferrer">KRESZ · hivatalos szabályok ↗</a>
    </section>`;
}
