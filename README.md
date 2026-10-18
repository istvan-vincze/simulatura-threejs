# Simulatura

A fresh, Hungarian-language KRESZ practice application: **observe → decide → drive → review**. The old single-file prototype remains in Git history; none of its implementation was reused.

## Run

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173. Requires a browser with WebGL 2. Node 22.22.3 and pnpm 10.17.1 were used for validation.

```sh
pnpm test         # deterministic simulation and rule checks
pnpm build        # TypeScript + production bundle
pnpm format:check
```

## First playable chapter

Four junction exercises: right-hand priority, STOP and priority, traffic signals, and a left turn across oncoming traffic. Each has a decision question, manual driving, timestamped feedback, retry, and local completion tracking. A correct quiz answer does not imply a passed drive. The left-turn lesson checks advance and continuous signaling, priority, the outbound lane and the westbound goal.

The original models include a learner hatchback with a sculpted body, glazing, mirrors, wheels, brake lights and indicators; signals with separate lenses; stop/priority signs; road markings; sidewalks; trees; and town buildings. They use real metre dimensions. All assets are bundled locally; no third-party model service is needed. The setting is fictional, not a reconstruction of a Budapest location.

**Vezetőülés** uses an original Blender-authored compact-car interior: a continuous moulded dashboard, recessed instrument coaming, contoured stitched wheel, fitted vents and physical controls, upholstered pillars, sculpted door cards, seats and footwells. The model uses baked contact shading, fine material grain and soft daylight reflections. The wheel follows steering input. Instruments display actual speed, drive/park state, the lesson direction and synchronized indicator flashes. A planar rear-view mirror reflects the scene behind the car. The exterior body and regular speed HUD are hidden in this mode; switching cameras restores them. See [cockpit authoring](docs/cockpit.md) for the source model, references and rebuild command.

Controls: W/↑ accelerator, S/↓/Space brake, A/D/←/→ steering, Q/E indicators, C camera, P pause, R reset. Clickable indicator buttons work at every screen size; small-screen buttons also provide driving controls. Indicators toggle and remain active until switched off. Opening help, changing browser tabs, or losing window focus pauses a drive. Resume with P or the pause button. There is no automatic reverse or manual gearbox in this chapter.

In the driver view, drag the scene with the mouse or a finger to look around. Double-click or use the **Nézz előre** camera button to recenter. Looking around changes the camera, not the steering. The normal follow view retains its wider framing.

## Structure

- `src/domain/`: scenario content, bicycle-model vehicle motion, oriented collision boxes, signal phases, and lesson events. No rendering or DOM dependencies. SI units; app advances at 60 fixed steps per second.
- `src/scene/`: original Three.js model construction, environment, lighting, and cameras. Reads simulation state; never decides traffic rules.
- `src/ui/`: Hungarian interface, keyboard/pointer input, responsive styling.
- `src/main.ts`: small application coordinator and animation loop.
- `docs/rules.md`: official sources, verified version, implemented scope and approximations.
- `docs/reference/`: local consolidated KRESZ text reference, figure URLs, retrieval metadata and hashes.
- `docs/roadmap.md`: bounded next slices toward broad KRESZ coverage.

## Validation and boundaries

Tests cover successful runs, priority violations, stop location, rolling stops, signal interlocking, red/red-amber entry, amber clearance, collisions, braking, pause, turn signaling, wrong exits, and wrong outbound lanes. An application-level DOM test drives all four lessons through actual controls with the renderer mocked, including saving the left-turn result. Production compilation is checked. The user owns browser/visual verification for this iteration; no browser test was run.

Cockpit tests load the actual shipped GLB and cover eye placement as the car turns, clear forward sightlines, wheel framing, steering animation, instrument updates and blink timing, camera switching, pointer looking and recentering, and mirror resource disposal. Blender renders check the geometry from the same eye position and field of view. They do not verify WebGL lighting, canvas textures or live reflections. Check those in the browser, including mirror performance on the target device.

This is a working first chapter, not a complete KRESZ simulator or certified exam product. Traffic consists of one deterministic crossing or oncoming car. Shared lane paths define traffic motion, guide arrows, conflict timing and goal placement; the learner steers freely. No pedestrians, cyclists, trams, emergency vehicles, right-turn lessons, roundabouts, rail crossings, weather physics, scenario editor, or replay are implemented yet. The driving model is kinematic, not a tyre/suspension physics simulation. See the rule documentation for evaluator tolerances.

Progress is stored only in this browser under `simulatura.progress.v1`. No account, server, analytics or remote progress storage. Fonts are bundled locally. The full statute is reference material; it is not automatically executable rule coverage.

For a manual smoke check, select each lesson, try a wrong and then the correct answer, start driving, check all cameras, brake before the line, finish the route, and retry. Confirm that deliberately skipping STOP or crossing red produces the corresponding feedback. In lesson 4, signal left before steering, let the blue car pass, turn slowly along the guide, and straighten into the westbound lane. Keep the signal on until the turn is finished. Check that the goal is in the left street and completion persists after reload. Also try a missing signal and driving straight instead. Check the small-screen controls and window-blur pause behavior.
