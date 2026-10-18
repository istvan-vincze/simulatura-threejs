"""Build the offline driving map. Requires Shapely (see requirements-map.txt).

No network calls: the checked-in OSM snapshot is the reproducible input.
Street centre-lines/directions/building footprints are OSM data. Widths and
missing building heights are explicitly estimated; controls remain unverified.
"""
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
raw = json.loads((ROOT / 'data/osm/zuglo.raw.json').read_text())
# Overpass emits tagged nodes first and repeats them as skeleton records during
# recursion. Merge records so that a later coordinate-only node cannot erase tags.
nodes = {}
for e in raw['elements']:
    if e['type'] == 'node': nodes[e['id']] = nodes.get(e['id'], {}) | e
NAMES = {'Torontál utca', 'Bölcsőde utca', 'Szugló utca', 'Újvidék utca',
         'Újvidék tér', 'Újvidék sétány', 'Újvilág utca', 'Emma utca',
         'Emília utca', 'Amerikai út', 'Variházy Oszkár utca', 'Gyertyán utca',
         'Szitakötő utca', 'Emma köz'}
# A bounded residential patch, excluding the long Szugló tail and the short
# connection on the far side of Róna. The motor-vehicle closure is NOT a road.
EXCLUDED = {14869457, 128169651, 518329916, 636671563, 518329912, 21894569}
ways = [e for e in raw['elements'] if e['type'] == 'way'
        and e.get('tags', {}).get('highway') == 'residential'
        and e['tags'].get('name') in NAMES and e['id'] not in EXCLUDED
        and e['tags'].get('motor_vehicle') != 'no'
        and e['tags'].get('access') not in ('private', 'no')]
ORIGIN = (47.5132, 19.1088)
def xy(n):
    return (round((n['lon']-ORIGIN[1])*111320*math.cos(math.radians(ORIGIN[0])), 3),
            round(-(n['lat']-ORIGIN[0])*111320, 3))
def point(p): return {'x': round(p[0], 3), 'z': round(p[1], 3)}
uses = Counter(n for w in ways for n in set(w['nodes']))
roads = []
for w in ways:
    tags = w['tags']; start = 0
    for i in range(1, len(w['nodes'])):
        nid = w['nodes'][i]
        if i != len(w['nodes'])-1 and uses[nid] == 1: continue
        ids = w['nodes'][start:i+1]; start = i
        ps = [xy(nodes[n]) for n in ids]
        if LineString(ps).length < .1: continue
        roads.append({'id': f"{w['id']}:{ids[0]}:{ids[-1]}", 'osmWay': str(w['id']),
                      'from': str(ids[0]), 'to': str(ids[-1]), 'points': [point(p) for p in ps],
                      'width': float(tags.get('width', '6.6').split()[0]),
                      'widthSource': 'osm' if 'width' in tags else 'estimated',
                      'direction': -1 if tags.get('oneway') == '-1' else 1 if tags.get('oneway') == 'yes' else 0,
                      'name': tags['name'], 'speedLimit': int(tags.get('maxspeed', '50')),
                      'speedSource': 'osm' if 'maxspeed' in tags else 'urban-default'})
# Keep the connected component containing Újvidék tér. No disconnected scenery roads.
adj = defaultdict(set)
for r in roads: adj[r['from']].add(r['to']); adj[r['to']].add(r['from'])
seen = set(); pending = [next(r['from'] for r in roads if r['name'] == 'Újvidék tér')]
while pending:
    n = pending.pop()
    if n in seen: continue
    seen.add(n); pending.extend(adj[n]-seen)
roads = [r for r in roads if r['from'] in seen]
map_nodes = [dict(id=n, **point(xy(nodes[int(n)]))) for n in sorted(seen)]
def line(r): return LineString([(p['x'], p['z']) for p in r['points']])
# A single union, with rounded inward corners, is used for both rendering and
# containment. This avoids layered pavements crossing adjoining streets.
surface = unary_union([line(r).buffer(r['width']/2, quad_segs=8) for r in roads])
surface = surface.buffer(2.5, quad_segs=8).buffer(-2.5, quad_segs=8).simplify(.025, preserve_topology=True)
walk = surface.buffer(2.2, quad_segs=8).difference(surface)
def polygons(g):
    gs = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    return [{'outer': [point(p) for p in q.exterior.coords],
             'holes': [[point(p) for p in ring.coords] for ring in q.interiors]} for q in gs if q.geom_type == 'Polygon']
buildings = []
area = surface.buffer(65)
for w in raw['elements']:
    t = w.get('tags', {})
    if w['type'] != 'way' or 'building' not in t or w['nodes'][0] != w['nodes'][-1]: continue
    ps = [xy(nodes[n]) for n in w['nodes']]
    poly = Polygon(ps)
    if not poly.is_valid or poly.area < 12 or not area.intersects(poly): continue
    # An imported building overlapping estimated road widths would obstruct the
    # drivable mesh. Omit it rather than moving a real footprint to invented coordinates.
    if poly.intersects(surface.buffer(.3)): continue
    try:
        levels = float(t.get('building:levels', '2'))
        height = float(t.get('height', str(levels*3.1)).replace(' m', ''))
    except ValueError: height = 6.2
    buildings.append({'id': str(w['id']), 'points': [point(p) for p in ps],
                      'height': max(3, min(height, 35)),
                      'heightSource': 'osm' if 'height' in t or 'building:levels' in t else 'estimated'})
way_ids = {r['osmWay'] for r in roads}
restrictions = []
for e in raw['elements']:
    if e['type'] != 'relation': continue
    m = {x['role']: str(x['ref']) for x in e.get('members', [])}
    if m.get('from') in way_ids and m.get('to') in way_ids and m.get('via') in seen:
        restrictions.append({'id': str(e['id']), 'fromWay': m['from'], 'toWay': m['to'], 'via': m['via'], 'kind': e['tags']['restriction']})
controls = []
used_ids = {n for w in ways for n in w['nodes']}
for nid in used_ids:
    t = nodes[nid].get('tags', {})
    if t.get('highway') in ('stop', 'give_way', 'traffic_signals'):
        direction = t.get('direction', t.get('traffic_signals:direction', 'unknown'))
        way = next(w for w in ways if nid in w['nodes'])
        i = way['nodes'].index(nid)
        a = xy(nodes[way['nodes'][max(0, i-1)]])
        b = xy(nodes[way['nodes'][min(len(way['nodes'])-1, i+1)]])
        yaw = math.atan2(b[0]-a[0], a[1]-b[1])
        if direction == 'backward': yaw += math.pi
        controls.append(dict(id=str(nid), kind=t['highway'], direction=direction,
                             yaw=yaw if direction in ('forward', 'backward') else None,
                             roadWay=str(way['id']), **point(xy(nodes[nid]))))
bounds = surface.bounds
result = {'id': 'zuglo-ujvidek-v1', 'name': 'Zugló · Újvidék tér',
          'source': {'attribution': '© OpenStreetMap contributors', 'url': 'https://www.openstreetmap.org/copyright', 'license': 'ODbL-1.0', 'licenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/',
                     'timestamp': raw['osm3s']['timestamp_osm_base'], 'origin': ORIGIN,
                     'controlsVerified': False},
          'nodes': map_nodes, 'roads': roads, 'surface': polygons(surface), 'sidewalks': polygons(walk),
          'buildings': buildings, 'restrictions': restrictions, 'importedControls': controls,
          'bounds': {'minX': bounds[0], 'minZ': bounds[1], 'maxX': bounds[2], 'maxZ': bounds[3]}}
out = ROOT / 'src/data/zuglo.json'
out.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n')
print(f'{len(map_nodes)} nodes, {len(roads)} roads, {sum(len(adj[n])>=3 for n in seen)} junctions, {len(buildings)} buildings, {len(controls)} controls, {len(restrictions)} restrictions')
print('Extent (metres):', bounds)
