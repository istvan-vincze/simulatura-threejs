import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createMapScene } from "./map";
import { createTown } from "./town";
import { createCar } from "./car";
import { createCockpit, DRIVER_FOV, DRIVER_PITCH } from "./cockpit";
import type { DrivingSession } from "../domain/free-roam";
import { signalsAt } from "../domain/signals";
export type CameraMode = "overview" | "follow" | "driver";
export async function createScene(container: HTMLElement) {
  const cockpit = await createCockpit();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dce2d2");
  scene.fog = new THREE.Fog("#dce2d2", 75, 160);
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    cockpit.dispose();
    throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Interaktív 3D gyakorlópálya");
  scene.add(new THREE.HemisphereLight("#fff5dc", "#7f9580", 2.4));
  const sun = new THREE.DirectionalLight("#fff0d2", 3.8);
  sun.position.set(-28, 48, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -55,
    right: 55,
    top: 55,
    bottom: -55,
    near: 1,
    far: 140,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 230);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.enablePan = true;
  orbit.minDistance = 12;
  orbit.maxDistance = 85;
  orbit.maxPolarAngle = Math.PI / 2.2;
  const town = createTown();
  scene.add(town.root);
  let neighbourhood: ReturnType<typeof createMapScene> | null = null;
  let lastPosition = { x: 0, z: 0 };
  let onMap = false;
  const player = createCar("#c66a43", true),
    traffic = createCar("#537f98");
  scene.add(player.root, traffic.root);
  scene.add(cockpit.root);
  let mode: CameraMode = "overview";
  let lookYaw = 0,
    lookPitch = DRIVER_PITCH;
  let drag: { id: number; x: number; y: number } | null = null;
  const events = new AbortController();
  const canvas = renderer.domElement;
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (mode !== "driver" || event.button !== 0 || drag) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    },
    { signal: events.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (mode !== "driver" || !drag || event.pointerId !== drag.id) return;
      lookYaw = THREE.MathUtils.clamp(
        lookYaw - (event.clientX - drag.x) * 0.004,
        -1.35,
        1.35,
      );
      lookPitch = THREE.MathUtils.clamp(
        lookPitch - (event.clientY - drag.y) * 0.003,
        -0.55,
        0.28,
      );
      drag.x = event.clientX;
      drag.y = event.clientY;
    },
    { signal: events.signal },
  );
  const endDrag = (event: PointerEvent) => {
    if (drag?.id === event.pointerId) drag = null;
  };
  canvas.addEventListener("pointerup", endDrag, { signal: events.signal });
  canvas.addEventListener("pointercancel", endDrag, { signal: events.signal });
  canvas.addEventListener("lostpointercapture", endDrag, {
    signal: events.signal,
  });
  function centerLook() {
    lookYaw = 0;
    lookPitch = DRIVER_PITCH;
  }
  canvas.addEventListener("dblclick", centerLook, { signal: events.signal });
  function setCamera(next: CameraMode) {
    mode = next;
    orbit.enabled = mode === "overview";
    player.root.visible = mode !== "driver";
    cockpit.root.visible = mode === "driver";
    camera.fov = mode === "driver" ? DRIVER_FOV : 43;
    camera.near = mode === "driver" ? 0.025 : 0.1;
    camera.updateProjectionMatrix();
    if (drag && canvas.hasPointerCapture(drag.id))
      canvas.releasePointerCapture(drag.id);
    drag = null;
    centerLook();
    if (mode === "overview") {
      camera.position.set(
        (onMap ? lastPosition.x : 0) + 37,
        40,
        (onMap ? lastPosition.z : 0) + 46,
      );
      orbit.target.set(
        onMap ? lastPosition.x : 0,
        0,
        onMap ? lastPosition.z : 2,
      );
      orbit.update();
    }
  }
  setCamera("overview");
  const resize = new ResizeObserver(() => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resize.observe(container);
  const desired = new THREE.Vector3(),
    target = new THREE.Vector3();
  const headRotation = new THREE.Quaternion();
  const headEuler = new THREE.Euler(0, 0, 0, "YXZ");
  return {
    setCamera,
    centerLook,
    setRoute(visible: boolean) {
      town.route.visible = visible;
    },
    render(s: DrivingSession, braking: boolean, indicator: number, dt: number) {
      const map = s.mode === "free" ? s.map : null;
      if (map && !neighbourhood) {
        neighbourhood = createMapScene(map);
        scene.add(neighbourhood.root);
      }
      if (onMap !== !!map) {
        onMap = !!map;
        camera.far = map ? 1200 : 230;
        camera.updateProjectionMatrix();
        orbit.maxDistance = map ? 600 : 85;
        scene.fog = new THREE.Fog("#dce2d2", map ? 180 : 75, map ? 650 : 160);
        lastPosition = { x: map ? s.player.x : 0, z: map ? s.player.z : 0 };
        setCamera(mode);
        if (map && mode === "follow")
          camera.position.set(
            s.player.x - Math.sin(s.player.yaw) * 13,
            6.8,
            s.player.z + Math.cos(s.player.yaw) * 13,
          );
      }
      lastPosition = { x: s.player.x, z: s.player.z };
      town.root.visible = !map;
      if (neighbourhood) neighbourhood.root.visible = !!map;
      sun.position.set(s.player.x - 28, 48, s.player.z + 25);
      sun.target.position.set(s.player.x, 0, s.player.z);
      town.setScenario(s.scenario, s.mode === "free");
      town.setSignals(signalsAt(s.elapsed));
      const step = s.stage === "drive" && !s.paused ? dt : 0;
      player.update(
        s.player,
        braking,
        indicator,
        s.elapsed,
        step,
        s.mode === "free" ? s.direction : 1,
      );
      traffic.update(s.traffic, s.traffic.speed === 0, 0, s.elapsed, step);
      if (mode === "overview") orbit.update();
      else if (mode === "driver") {
        cockpit.update(
          s.player,
          indicator,
          s.elapsed,
          s.stage === "drive",
          s.scenario === "left-turn",
          s.mode === "free" ? { direction: s.direction } : undefined,
        );
        cockpit.root.updateMatrixWorld(true);
        cockpit.eye.getWorldPosition(camera.position);
        headRotation.setFromEuler(headEuler.set(lookPitch, lookYaw, 0));
        camera.quaternion.copy(cockpit.root.quaternion).multiply(headRotation);
      } else {
        const { x, z, yaw } = s.player;
        const distance = 13,
          height = 6.8,
          lookAhead = 3.5;
        desired.set(
          x - Math.sin(yaw) * distance,
          height,
          z + Math.cos(yaw) * distance,
        );
        camera.position.lerp(desired, 1 - Math.exp(-7 * dt));
        target.set(
          // Keep the rear lights above the dashboard while retaining the road ahead.
          x + Math.sin(yaw) * lookAhead,
          0.8,
          z - Math.cos(yaw) * lookAhead,
        );
        camera.lookAt(target);
      }
      renderer.render(scene, camera);
    },
    dispose() {
      events.abort();
      cockpit.dispose();
      neighbourhood?.dispose();
      resize.disconnect();
      orbit.dispose();
      renderer.dispose();
    },
  };
}
