import * as THREE from "three";

export function createInstruments() {
  const root = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 448;
  const context = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.49, 0.214),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  screen.name = "instrument-screen";
  screen.position.z = 0.022;
  root.add(screen);
  let previous = "";
  function update(
    speed: number,
    indicator: number,
    time: number,
    driving: boolean,
    turning: boolean,
  ) {
    const kmh = speed * 3.6;
    const speedText =
      speed === 0
        ? "0"
        : kmh < 1
          ? Math.max(0.1, kmh).toFixed(1)
          : String(Math.round(kmh));
    const blink = Math.floor(time * 2.4) % 2 === 0;
    const lit = blink ? indicator : 0;
    const key = `${speedText}:${lit}:${driving}:${turning}`;
    if (key === previous) return;
    previous = key;
    const c = context;
    c.fillStyle = "#10191e";
    c.fillRect(0, 0, 1024, 448);
    c.lineCap = "round";
    const cx = 286,
      cy = 232,
      radius = 157;
    c.strokeStyle = "#34434a";
    c.lineWidth = 5;
    c.beginPath();
    c.arc(cx, cy, radius, Math.PI * 0.75, Math.PI * 2.25);
    c.stroke();
    for (let value = 0; value <= 160; value += 10) {
      const a = Math.PI * 0.75 + (value / 160) * Math.PI * 1.5;
      const major = value % 20 === 0;
      c.strokeStyle = value === 50 ? "#eebc72" : "#d5dfd8";
      c.lineWidth = major ? 4 : 2;
      c.beginPath();
      c.moveTo(
        cx + Math.cos(a) * (radius - (major ? 18 : 10)),
        cy + Math.sin(a) * (radius - (major ? 18 : 10)),
      );
      c.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      c.stroke();
      if (major) {
        c.font = "22px Arial";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#bdcbc7";
        c.fillText(
          String(value),
          cx + Math.cos(a) * 116,
          cy + Math.sin(a) * 116,
        );
      }
    }
    const needle = Math.PI * 0.75 + (Math.min(kmh, 160) / 160) * Math.PI * 1.5;
    c.strokeStyle = "#f0a366";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(needle) * 134, cy + Math.sin(needle) * 134);
    c.stroke();
    c.fillStyle = "#e5b688";
    c.beginPath();
    c.arc(cx, cy, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e9f2e8";
    c.font = "600 84px Arial";
    c.textAlign = "center";
    c.fillText(speedText, 675, 196);
    c.fillStyle = "#91a79f";
    c.font = "25px Arial";
    c.fillText("km/h", 675, 248);
    c.fillStyle = "#c2d8b7";
    c.font = "34px Arial";
    c.fillText(driving ? "D" : "P", 850, 208);
    c.fillStyle = "#8fa79b";
    c.font = "23px Arial";
    c.fillText(turning ? "BALRA KANYARODÁS" : "EGYENESEN TOVÁBB", 694, 343);
    c.fillStyle = "#647b73";
    c.font = "18px Arial";
    c.fillText("SIMULATURA", 286, 408);
    for (const side of [-1, 1]) {
      const x = side === -1 ? 580 : 820;
      c.fillStyle = lit === side ? "#9cf7a6" : "#31423d";
      c.beginPath();
      c.moveTo(x + side * 28, 53);
      c.lineTo(x, 29);
      c.lineTo(x, 43);
      c.lineTo(x - side * 30, 43);
      c.lineTo(x - side * 30, 63);
      c.lineTo(x, 63);
      c.lineTo(x, 77);
      c.closePath();
      c.fill();
    }
    texture.needsUpdate = true;
  }
  update(0, 0, 0, false, false);
  return { root, update, texture };
}
