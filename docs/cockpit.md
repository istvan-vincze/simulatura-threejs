# Cockpit authoring

The interior is an original, generic left-hand-drive compact car. Its proportions and detailing use [Škoda's 2021 Fabia interior photograph](https://www.skoda-storyboard.com/cs/style_dashboard_straight/) as a visual reference. No manufacturer meshes, textures, logos or photographs are shipped in the application.

`scripts/build-cockpit.py` is the editable model source. It creates continuous dashboard and door surfaces, a curved wheel with articulated spokes and stitching, fitted vents, pillars and seals, console controls, seating and the rear cabin. It applies bevels and normals, batches geometry by material and moving parent, and bakes short-range contact shading into vertex colours. The resulting `src/scene/assets/cockpit/interior.glb` is checked in, so Blender is **not** required to run or build the application.

To regenerate with Blender 5.2:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/build-cockpit.py
```

To also render an offline driver's-eye preview:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/build-cockpit.py -- --render /tmp/simulatura-cockpit.png
```

The preview also saves `/tmp/simulatura-cockpit.blend` for inspection. Preview lights, camera, dial proxies and mirror glass are added **after** exporting the application asset. Blender's lighting and placeholder dials are not a screenshot of the application.

The source uses metres in Three.js coordinates: X right, Y up, forward −Z. The Blender conversion and glTF export preserve those coordinates. The camera sits at `(-0.38, 1.46, 0.42)`, with a 68° vertical field of view and −0.14 radian default pitch. Preserve these named export anchors:

| Node               | Runtime use                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `steering-wheel`   | Z-axis steering rotation, under the tilted steering-column parent |
| `instrument-mount` | Live canvas instrument display                                    |
| `mirror-mount`     | One planar rear-view reflection                                   |

`cockpit-materials.ts` adds small deterministic grain maps and a cabin-only daylight environment. Contact shading travels with the model; it does not simulate changing shadows. The front and side windows have open sightlines without a tinted glass overlay. The center display and physical cabin buttons are decorative; driving and lesson controls remain in the application UI.

The asset loads before the simulation starts, with a visible loading status and a recoverable reload message if loading fails. Tests replace only HTTP transport and parse the real GLB. Run `pnpm test`, `pnpm build` and `pnpm format:check` after changing the asset or anchors. Browser verification remains necessary for the final WebGL materials, instrument legibility and mirror performance.
