import mapDownloadUrl from "../data/zuglo.json?url";
import type { DrivingMap } from "../domain/driving-map";
import type { Pose } from "../domain/vehicle";
import { nearestRoad } from "../domain/road-network";

export function renderMap(map: DrivingMap) {
  const b = map.bounds,
    padding = 25;
  return `<figure class="neighbourhood-map">
    <figcaption>Újvidék tér és környéke <span>É ↑</span></figcaption>
    <svg id="neighbourhood-map" viewBox="${b.minX - padding} ${b.minZ - padding} ${b.maxX - b.minX + padding * 2} ${b.maxZ - b.minZ + padding * 2}" role="img" aria-label="Zugló utcahálózata, az autó helyével">
      <g fill="#d5dacb">${map.buildings.map((b) => `<polygon points="${b.points.map((p) => `${p.x},${p.z}`).join(" ")}"/>`).join("")}</g>
      <g fill="none" stroke="#6b8079" stroke-linecap="round" stroke-linejoin="round">${map.roads.map((r) => `<polyline stroke-width="${r.width + 2}" points="${r.points.map((p) => `${p.x},${p.z}`).join(" ")}"/>`).join("")}</g>
      <g id="map-player"><circle r="18" fill="#fff7e6"/><path d="M 0,-18 L 12,12 L 0,7 L -12,12 Z" fill="#bd593e" stroke="#fff7e6" stroke-width="2"/></g>
    </svg>
    <div class="map-street"><span id="map-street-name"></span><span id="map-speed-limit" aria-label="Sebességhatár"></span></div>
    <a class="map-attribution" href="${map.source.url}" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL ↗</a>
    <a class="map-attribution" href="${mapDownloadUrl}" download="zuglo-map.json">Térképadatok letöltése · ODbL</a>
    <p class="map-data-note">Valódi utcaalaprajz · generált 3D környezet<br>Forgalmi rend: részben feldolgozott, nem hitelesített</p>
  </figure>`;
}
export function updateMapPosition(map: DrivingMap, p: Pose) {
  document
    .querySelector("#map-player")
    ?.setAttribute(
      "transform",
      `translate(${p.x} ${p.z}) rotate(${(p.yaw * 180) / Math.PI})`,
    );
  const road = nearestRoad(map, p)?.road;
  const name = document.querySelector("#map-street-name"),
    limit = document.querySelector("#map-speed-limit");
  if (name) name.textContent = road?.name ?? map.name;
  if (limit)
    limit.textContent = String(
      map.roads.find((r) => r.id === road?.id)?.speedLimit ?? 50,
    );
}
