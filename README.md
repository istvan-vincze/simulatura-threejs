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

Three straight-through junction exercises: right-hand priority, STOP and priority, and traffic signals. Each has a decision question, manual driving, timestamped feedback, retry, and local completion tracking. A correct quiz answer does not imply a passed drive.

The original procedural models include a learner hatchback with a sculpted body, glazing, mirrors, wheels, brake lights and indicators; signals with separate lenses; stop/priority signs; road markings; sidewalks; trees; and town buildings. They use real metre dimensions and do not require downloaded model assets. The setting is fictional, not a reconstruction of a Budapest location.

Controls: W/↑ accelerator, S/↓/Space brake, A/D/←/→ steering, Q/E indicators, C camera, P pause, R reset. Small-screen on-screen buttons provide driving controls. Opening help, changing browser tabs, or losing window focus pauses a drive. Resume with P or the pause button. There is no automatic reverse or manual gearbox in this chapter.

## Structure

- `src/domain/`: scenario content, bicycle-model vehicle motion, oriented collision boxes, signal phases, and lesson events. No rendering or DOM dependencies. SI units; app advances at 60 fixed steps per second.
- `src/scene/`: original Three.js model construction, environment, lighting, and cameras. Reads simulation state; never decides traffic rules.
- `src/ui/`: Hungarian interface, keyboard/pointer input, responsive styling.
- `src/main.ts`: small application coordinator and animation loop.
- `docs/rules.md`: official sources, verified version, implemented scope and approximations.
- `docs/reference/`: local consolidated KRESZ text reference, figure URLs, retrieval metadata and hashes.
- `docs/roadmap.md`: bounded next slices toward broad KRESZ coverage.

## Validation and boundaries

Unit tests cover successful runs, priority violations, stop location, rolling stops, signal interlocking, red/red-amber entry, amber clearance, collisions, braking and pause. Production compilation is checked. The user owns browser/visual verification for this iteration; Chrome computer-use access was unavailable and no browser test was run.

This is a working first chapter, not a complete KRESZ simulator or certified exam product. Traffic consists of one deterministic crossing car. No pedestrians, cyclists, trams, emergency vehicles, turn manoeuvres, roundabouts, rail crossings, weather physics, scenario editor, or replay are implemented yet. The driving model is kinematic, not a tyre/suspension physics simulation. See the rule documentation for evaluator tolerances.

Progress is stored only in this browser under `simulatura.progress.v1`. No account, server, analytics or remote progress storage. Fonts are bundled locally. The full statute is reference material; it is not automatically executable rule coverage.

For a manual smoke check, select each lesson, try a wrong and then the correct answer, start driving, check all cameras, brake before the line, finish the route, and retry. Confirm that deliberately skipping STOP or crossing red produces the corresponding feedback. Check the small-screen controls and window-blur pause behavior.
