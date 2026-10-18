# Zugló OpenStreetMap snapshot

`zuglo.raw.json` is an OpenStreetMap extract downloaded through the public Overpass API on 18 October 2026. The snapshot's `timestamp_osm_base` is **2026-10-18T00:40:51Z**. The source database is © OpenStreetMap contributors, available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [copyright and attribution](https://www.openstreetmap.org/copyright).

The derived database `src/data/zuglo.json` is also provided under ODbL 1.0. Its download link is included beside the in-app map. This data license is separate from the application's original source code and models.

The one-off query sent to `https://overpass-api.de/api/interpreter` was:

```overpass
[out:json][timeout:30];
(
  way[highway~"^(residential|tertiary|unclassified|living_street|secondary)$"](47.5115,19.1055,47.5195,19.1175);
  way[building](47.5115,19.1055,47.5195,19.1175);
  node[highway~"^(traffic_signals|stop|give_way)$"](47.5115,19.1055,47.5195,19.1175);
  relation[type=restriction](47.5115,19.1055,47.5195,19.1175);
);
out body;
>;
out skel qt;
```

The importer selects a connected residential patch around Újvidék tér from this larger extract. OSM ways returned by a bounding-box query can extend beyond that box; buildings at the outermost ends therefore have less coverage. The app never queries Overpass at runtime.

Rebuild with Python 3 and Shapely 2:

```sh
python3 -m venv /tmp/simulatura-map-env
/tmp/simulatura-map-env/bin/pip install -r scripts/requirements-map.txt
/tmp/simulatura-map-env/bin/python scripts/import-zuglo.py
pnpm exec prettier --write src/data/zuglo.json
```

With Shapely already installed in the active Python environment, use `pnpm map:build`.

## What is real and what is generated

- Imported: metric street centre-lines, street names, one-way directions, mapped speed limits, three node-based turn restrictions, one mapped give-way sign, building footprints, and mapped building levels/heights where present.
- Excluded: the motor-vehicle closure on Szugló utca, disconnected roads, the main arterials, and buildings that overlap estimated carriageways. Boundary barriers mark the limited playable area, not real road closures.
- Estimated: widths absent from OSM (6.6 m), sidewalk widths, corner fillets, unknown building heights, roof styles, facades, windows, trees and lamps. The small local projection uses metres east and metres south from 47.5132 N, 19.1088 E. It is not a cadastral model.
- Unverified: actual current traffic-control signs, local priority arrangements, lane markings, stop lines and signal programs. The extract contains one direction-tagged give-way node on the selected streets, which is rendered, but no mapped STOP or signal nodes there. This sparse coverage is not evidence that the remaining streets lack controls. The real map does not score those rules yet.
- Speeds: explicit OSM values take precedence; missing limits use the built-up-area passenger-car default, visibly documented as `urban-default`. A mapped 30 km/h zone remains attached to each imported road segment.

The single asphalt polygon union (with holes and rounded inner corners) feeds rendering and vehicle containment. Roads, NPC routing, the minimap and lane checks share the same graph. Source provenance remains in the generated database. Changes to this import must update connectivity, circuit, geometry and evaluator tests.
