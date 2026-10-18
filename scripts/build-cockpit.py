"""Original metric compact-car interior. Blender 5.2+, no external assets.

Run: Blender --background --python scripts/build-cockpit.py
Add -- --render /tmp/cockpit.png for a driver's-eye preview.
Coordinates below match Three.js: x right, y up, -z forward, metres.
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
args = argparse.ArgumentParser()
args.add_argument('--render')
opts = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def xyz(p):
    return C @ Vector(p)


def material(name, color, roughness=.75, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_backface_culling = True
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    return m


rubber = material('Rubber', (.012, .016, .019), .87)
grain = material('Grained plastic', (.034, .039, .043), .83)
lower = material('Lower fascia', (.057, .062, .066), .77)
leather = material('Leather', (.023, .027, .03), .62)
cloth = material('Woven fabric', (.10, .115, .124), .94)
headliner = material('Headliner', (.52, .51, .47), .96)
satin = material('Satin aluminium', (.43, .47, .49), .29, .8)
copper = material('Warm brushed trim', (.30, .22, .16), .4, .65)
piano = material('Gloss black', (.009, .014, .017), .22)
white = material('Etched markings', (.63, .68, .68), .6)
stitch = material('Stitching', (.21, .23, .23), .9)
red = material('Hazard marking', (.65, .035, .025), .6)
paint = material('Body paint', (.56, .18, .075), .27, .35)
screen = material('Screen glass', (.012, .028, .035), .25)
screen.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value = (.02, .04, .05, 1)
screen.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = .2


def empty(name, pos=(0, 0, 0), rot=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    ob.location = xyz(pos)
    ob.rotation_euler = (C @ Euler(rot, 'XYZ').to_matrix() @ C.transposed()).to_euler()
    return ob


static = empty('cabin-shell')
wheel_mount = empty('steering-column', (-.38, 1.025, -.42), (-.3, 0, 0))
wheel = empty('steering-wheel', parent=wheel_mount)
mirror_mount = empty('mirror-mount', (.1, 1.64, -.7), (.08, -.2, 0))
instrument_mount = empty('instrument-mount', (-.38, 1.125, -.725), (-.12, 0, 0))


def finish(ob, mat, parent, bevel=0):
    ob.data.materials.append(mat)
    ob.parent = parent
    for p in ob.data.polygons:
        p.use_smooth = True
    if bevel:
        mod = ob.modifiers.new('Soft tooling radii', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod = ob.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return ob


def mesh(name, verts, faces, mat, parent=static, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in verts], [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    # Metric UVs, shared by runtime grain maps. Curved surfaces get stable seams.
    uv = data.uv_layers.new(name='Metric UV')
    for poly in data.polygons:
        n = poly.normal
        axis = max(range(3), key=lambda a: abs(n[a]))
        axes = [a for a in range(3) if a != axis]
        for li in poly.loop_indices:
            v = data.vertices[data.loops[li].vertex_index].co
            uv.data[li].uv = (v[axes[0]], v[axes[1]])
    return finish(ob, mat, parent, bevel)


def box(name, size, pos, mat, radius=.008, parent=static, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.location = xyz(pos)
    ob.rotation_euler = (C @ Euler(rot, 'XYZ').to_matrix() @ C.transposed()).to_euler()
    return finish(ob, mat, parent, min(radius, min(size) * .48))


def path(name, points, radius, mat, parent=static, resolution=3, linear=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 8 if len(points) < 10 else 2
    data.bevel_depth = radius
    data.bevel_resolution = resolution
    data.use_fill_caps = True
    s = data.splines.new('BEZIER')
    s.bezier_points.add(len(points) - 1)
    for b, p in zip(s.bezier_points, points):
        b.co = xyz(p)
        b.handle_left_type = b.handle_right_type = 'VECTOR' if linear else 'AUTO'
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    data.materials.append(mat)
    return ob


def ellipse(name, pos, rx, ry, tube, mat, parent=static, count=64):
    pts = [(pos[0] + rx * math.cos(t * math.tau / count),
            pos[1] + ry * math.sin(t * math.tau / count), pos[2]) for t in range(count + 1)]
    return path(name, pts, tube, mat, parent, 2)


def disc(name, pos, radius, depth, mat, parent=static):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth)
    ob = bpy.context.object
    ob.name = name
    ob.location = xyz(pos)
    ob.rotation_euler.x = math.pi / 2
    return finish(ob, mat, parent, .0015)


def poly_extrude(name, outline, front, depth, mat, parent=static, bevel=.009):
    n = len(outline)
    vs = [(x, y, z) for z in (front - depth, front) for x, y in outline]
    fs = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    fs += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    return mesh(name, vs, fs, mat, parent, bevel)


def catmull(points, steps=5):
    result = []
    for i in range(len(points)):
        a, b, c, d = [Vector(points[j % len(points)]) for j in (i-1, i, i+1, i+2)]
        for s in range(steps):
            t = s / steps
            result.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    return result


def loft(name, sections, mat, parent=static):
    n = len(sections[0])
    verts = [v for section in sections for v in section]
    faces = [tuple(reversed(range(n))), tuple(range((len(sections)-1)*n, len(sections)*n))]
    for j in range(len(sections)-1):
        for i in range(n):
            faces.append((j*n+i, j*n+(i+1) % n, (j+1)*n+(i+1) % n, (j+1)*n+i))
    ob = mesh(name, verts, faces, mat, parent)
    # Profiles are easiest to author without winding assumptions.
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.select_set(False)
    return ob


# One smooth moulded dash: a rolled upper crash pad and sloping undercut fascia.
profile = catmull([(1.025, -1.26), (1.075, -1.10), (1.065, -.86),
                   (1.015, -.67), (.94, -.60), (.79, -.64), (.72, -.87), (.83, -1.20)], 6)
sections = []
for x in [-.795, -.785, -.76, -.70, -.60, -.45, -.3, -.15, 0, .15, .3, .45, .6, .7, .76, .785, .795]:
    end = (abs(x)/.8)**5
    sections.append([(x, .91+(p[0]-.91)*(1-.30*end), p[1]-.10*end) for p in profile])
loft('Continuous dashboard moulding', sections, grain)
for side in [-1, 1]:
    # Door cards are lofted from the sill into a narrow, curved window belt.
    door_sections = []
    for z in [-.98, -.88, -.65, -.35, 0, .3, .6, .83, .92]:
        shape = catmull([(.80,.37),(.80,1.04),(.735,1.04),(.71,.96),(.72,.84),(.665,.75),(.69,.67),(.73,.42)], 4)
        taper = .025 * ((z+.05)/1.02)**4
        door_sections.append([(side*(p[0]+taper), p[1], z) for p in shape])
    loft('Sculpted door card', door_sections, lower)
    path('Door belt seal', [(side*.76,1.065,z) for z in [-1.02,-.65,0,.65,.96]], .017, rubber)
    path('Door shoulder trim', [(side*.707,.91,-.79),(side*.704,.9,-.35),(side*.704,.86,.23),(side*.73,.86,.8)], .007, copper)
    box('Padded door insert', (.027,.18,.81), (side*.704,.81,.14), cloth, .012)
    box('Armrest', (.15,.07,.66), (side*.667,.728,.05), leather, .032)
    box('Handle recess', (.023,.092,.22), (side*.701,.94,-.48), rubber, .01)
    path('Satin door pull', [(side*.687,.956,-.565),(side*.667,.95,-.50),(side*.684,.946,-.405)], .010, satin)
    for z in [-.15,-.075]:
        box('Window switch', (.036,.014,.052), (side*.64,.768,z), piano, .005)
        box('Window switch marking', (.019,.001,.002), (side*.64,.776,z), white, .0004)
    # Properly tapered pillars and rubber glazing border, not cylindrical rods.
    pillar = []
    for t in [0,.08,.25,.5,.75,.94,1]:
        x = side*(.77-.10*t)
        y = 1.035+.80*t
        z = -1.25+.68*t
        w = .047-.015*t
        pillar.append([(x+side*w*math.cos(a), y+.034*math.sin(a), z-.045*math.sin(a))
                       for a in [i*math.tau/16 for i in range(16)]])
    loft('Upholstered A pillar', pillar, headliner)
    path('Windscreen rubber seal', [(side*.725,1.08,-1.275),(side*.685,1.44,-.965),(side*.628,1.82,-.61)], .010, rubber)
    path('Roof side rail', [(side*.67,1.83,-.57),(side*.74,1.85,.2),(side*.73,1.83,.95)], .035, headliner)
    path('B pillar', [(side*.76,1.0,.95),(side*.74,1.45,.95),(side*.73,1.83,.95)], .045, headliner)
    path('C pillar', [(side*.77,1.03,1.68),(side*.73,1.45,1.37),(side*.68,1.8,1.12)], .05, headliner)

# Roof panel and sun visors, with a short mirror stalk beneath the console.
box('Headliner', (1.43,.07,1.73), (0,1.89,.27), headliner, .033)
path('Windscreen header', [(-.67,1.83,-.57),(0,1.87,-.59),(.67,1.83,-.57)], .041, headliner)
for side in [-1,1]:
    box('Sun visor', (.44,.035,.20), (side*.36,1.825,-.42), headliner, .016, rot=(.15,0,0))
    box('Visor vanity cover', (.25,.008,.13), (side*.36,1.804,-.42), lower, .004, rot=(.15,0,0))
box('Overhead console', (.20,.035,.25), (.03,1.83,-.39), lower, .016)
for x in [-.026,.076]:
    box('Reading lamp lens', (.061,.009,.09), (x,1.808,-.40), white, .004)
path('Mirror stalk', [(.1,1.75,-.66),(.1,1.71,-.69),(.1,1.67,-.71)], .012, rubber)
box('Mirror windscreen mount',(.072,.12,.035),(.1,1.77,-.65),rubber,.012,rot=(-.65,0,0))
box('Mirror surround', (.298,.112,.042), (0,0,0), rubber, .021, mirror_mount)
box('Mirror anti glare tab', (.036,.012,.025), (0,-.058,.005), rubber, .005, mirror_mount)

# Passenger fascia follows the dash's convexity; delicate trim, glovebox seam.
for y, radius, mat in [(.947,.006,copper),(.926,.003,satin)]:
    path('Sweeping fascia trim', [(-.76,y-.02,-.68),(-.65,y,-.598),(-.2,y,-.586),(.20,y,-.586),(.57,y,-.612),(.76,y-.02,-.69)], radius, mat)
path('Glovebox seam', [(.30,.87,-.623),(.68,.86,-.659),(.69,.76,-.724),(.30,.75,-.684)], .0015, rubber)
box('Glovebox pull', (.105,.014,.017), (.48,.852,-.633), lower, .005)
for x in [-.57,-.30,.3,.57]:
    box('Demister vent', (.18,.006,.038), (x,1.066,-1.135), rubber, .003)
    for i in [-2,-1,0,1,2]:
        box('Demister ribs', (.002,.004,.031), (x+i*.028,1.07,-1.135), grain, .0005)

for x in [-.665,.665]:
    z = -.59
    disc('Outer vent cavity', (x,1.015,z), .067,.035,rubber)
    ellipse('Vent satin bezel', (x,1.015,z+.023), .067,.067,.003,satin)
    ellipse('Vent black inner lip', (x,1.015,z+.02), .061,.061,.004,piano)
    for i in range(-3,4):
        width = 2*math.sqrt(max(0,.056**2-(i*.014)**2))
        box('Vent louvre', (width,.004,.016), (x,1.015+i*.014,z+.014), lower,.0015)
    box('Vent adjuster', (.026,.011,.014), (x,1.015,z+.026), satin,.003)

# Instrument coaming: an overhanging arch around the actual live display.
arch = [(-.264,-.105),(-.279,.015),(-.243,.103),(-.15,.134),(.15,.134),(.243,.103),(.279,.015),(.264,-.105)]
poly_extrude('Instrument backing', arch, -.012,.13,rubber,instrument_mount,.018)
path('Instrument hood rolled lip', [(x,y,.015) for x,y in arch], .018,grain,instrument_mount)
path('Instrument satin lower edge', [(-.25,-.104,.012),(0,-.108,.014),(.25,-.104,.012)], .0025,satin,instrument_mount)

# Slim infotainment screen, recessed center vents and physical climate controls.
box('Center screen bezel', (.322,.207,.035), (.17,1.125,-.635), piano,.016, rot=(-.12,0,0))
box('Center screen glass', (.291,.170,.004), (.17,1.127,-.612), screen,.0015, rot=(-.12,0,0))
# A quiet non-interactive navigation drawing, with road geometry under the glass.
for i in range(3):
    path('Map road', [(.04,1.08+i*.033,-.607),(.12,1.092+i*.033,-.607),(.29,1.07+i*.033,-.607)], .0008,lower)
path('Map route', [(.17,1.067,-.604),(.17,1.14,-.604),(.11,1.14,-.604)], .002,copper)
for x in [.072,.268]:
    box('Center vent cavity', (.166,.067,.022), (x,.981,-.591),rubber,.009)
    for i in [-1,0,1]:
        box('Center vent vane', (.148,.004,.015), (x,.981+i*.016,-.574), lower,.0015)
    box('Center vent slider', (.02,.009,.01), (x,.981,-.562), satin,.002)
box('Hazard key', (.029,.052,.016), (.17,.98,-.57),piano,.006)
path('Hazard triangle', [(.17,.994,-.560),(.16,.977,-.560),(.18,.977,-.560),(.17,.994,-.560)], .0013,red,linear=True)
box('Climate control surround', (.31,.10,.035), (.17,.858,-.611),piano,.014)
for x in [.065,.17,.275]:
    disc('Climate dial', (x,.858,-.58), .030,.028,rubber)
    ellipse('Climate dial knurled rim', (x,.858,-.563), .029,.029,.002,satin)
    for k in range(20):
        a = k*math.tau/20
        box('Knurl', (.0015,.003,.005), (x+.027*math.cos(a),.858+.027*math.sin(a),-.564),lower,.0005)
    box('Climate index', (.002,.01,.0015), (x,.874,-.561),white,.0004)

# Tunnel transitions from center stack to the selector and cup holders.
tunnel_sections = []
for z,w,h in [(-.72,.21,.72),(-.56,.205,.66),(-.35,.16,.49),(-.12,.15,.44),(.25,.15,.43),(.64,.145,.46)]:
    tunnel_sections.append([(x*w,y*h,z) for x,y in [(-1,.1),(-1,.83),(-.8,1),(.8,1),(1,.83),(1,.1)]])
loft('Center tunnel',tunnel_sections,lower)
box('Selector bezel',(.21,.018,.24),(.05,.48,-.19),satin,.008)
box('Selector leather boot',(.18,.052,.21),(.05,.50,-.19),leather,.025)
path('Gear selector shaft',[(.05,.51,-.18),(.05,.62,-.21)],.021,rubber)
box('Automatic selector grip',(.065,.06,.10),(.05,.64,-.22),leather,.028)
box('Selector cap',(.044,.009,.065),(.05,.669,-.22),satin,.004)
for z in [.13,.33]:
    # Cup recesses point upward, unlike the vertical front-panel circular vents.
    ob=disc('Cup holder', (0,.448,z),.065,.012,rubber)
    ob.rotation_euler.x=0
box('Center armrest',(.23,.09,.31),(0,.60,.65),leather,.035)
box('Footwell bulkhead', (1.51,.53,.12),(0,.53,-.99),rubber,.035)
lower_profile=catmull([(.88,-.68),(.81,-.60),(.70,-.635),(.61,-.72),(.61,-.92),(.79,-1.0)],6)
loft('Continuous lower fascia', [[(x,p[0],p[1]-.06*(abs(x)/.78)**4) for p in lower_profile]
                                for x in [-.78,-.75,-.6,-.4,-.2,0,.2,.4,.6,.75,.78]], lower)
for side in [-1,1]:
    box('Carpeted sill',(.15,.15,2.4),(side*.725,.36,.18),rubber,.025)
box('Carpet', (1.47,.035,2.8),(0,.31,.16),rubber,.015)
for x,w in [(-.46,.085),(-.29,.05)]:
    box('Pedal', (w,.11,.018),(x,.49,-.81),rubber,.007,rot=(-.38,0,0))
    for i in [-2,-1,0,1,2]:
        box('Pedal grip',(w*.8,.004,.008),(x,.49+i*.016,-.797),lower,.001)

# Sculpted upholstered seat cushions and bolsters, plus a rear cabin for the mirror.
for x in [-.38,.38]:
    box('Seat cushion',(.46,.12,.53),(x,.48,.42),cloth,.055)
    box('Seat back',(.44,.56,.13),(x,.83,.82),cloth,.055,rot=(-.10,0,0))
    for side in [-1,1]:
        path('Seat cushion bolster',[(x+side*.19,.52,.22),(x+side*.21,.56,.40),(x+side*.20,.54,.64)],.045,leather)
        path('Seat back bolster',[(x+side*.19,.61,.73),(x+side*.20,.86,.71),(x+side*.17,1.07,.75)],.043,leather)
        path('Seat piping',[(x+side*.145,.55,.22),(x+side*.15,.56,.61),(x+side*.145,1.08,.75)],.0013,stitch)
    for offset in [-.065,.065]:
        path('Headrest post',[(x+offset,1.07,.83),(x+offset,1.19,.85)],.007,satin)
    box('Front headrest',(.25,.19,.12),(x,1.25,.85),leather,.05)
box('Rear bench cushion',(1.39,.15,.48),(0,.57,1.36),cloth,.06)
box('Rear bench back',(1.39,.48,.14),(0,.89,1.61),cloth,.05)
for x in [-.46,0,.46]:
    box('Rear headrest',(.23,.16,.11),(x,1.20,1.63),leather,.045)
box('Parcel shelf',(1.43,.05,.34),(0,1.10,1.86),grain,.022)

# Wheel: non-circular leather grip with thickened thumb pads, recessed spokes,
# a sculpted airbag and an inset lower Y spoke. All pieces rotate as one node.
verts=[]
segments,sides=128,12
for i in range(segments):
    a=i*math.tau/segments
    r=.180
    cx,cy=r*math.cos(a),max(-.166,r*math.sin(a))
    thumb=math.exp(-((a-.56)/.22)**2)+math.exp(-((a-(math.pi-.56))/.22)**2)
    thick=.0225+.006*thumb
    for j in range(sides):
        b=j*math.tau/sides
        verts.append((cx+thick*math.cos(b)*math.cos(a),cy+thick*math.cos(b)*math.sin(a),thick*.88*math.sin(b)))
faces=[]
for i in range(segments):
    for j in range(sides):
        faces.append((i*sides+j,((i+1)%segments)*sides+j,((i+1)%segments)*sides+(j+1)%sides,i*sides+(j+1)%sides))
mesh('Contoured leather wheel rim',verts,faces,leather,wheel)
for i in range(100):
    a=i*math.tau/100
    b=a+.022
    path('Wheel hand stitching',[(.163*math.cos(a),max(-.15,.163*math.sin(a)),.013),(.162*math.cos(b),max(-.149,.162*math.sin(b)),.014)],.0007,stitch,wheel,1)
for side in [-1,1]:
    outline=[(side*.045,.027),(side*.168,.036),(side*.168,-.012),(side*.065,-.064)]
    if side<0: outline.reverse()
    poly_extrude('Wheel horizontal spoke',outline,.008,.037,grain,wheel,.008)
    outline=[(side*.078,.024),(side*.15,.029),(side*.15,-.002),(side*.079,-.021)]
    if side<0: outline.reverse()
    poly_extrude('Wheel button pod',outline,.018,.012,piano,wheel,.004)
    for x in [.10,.133]:
        path('Steering button icon',[(side*x-.004,.012,.025),(side*x+.004,.012,.025)],.0007,white,wheel,1)
    path('Spoke satin edge',[(side*.064,-.055,.015),(side*.13,-.025,.015),(side*.166,-.012,.012)],.003,satin,wheel)
poly_extrude('Lower spoke',[(-.065,-.036),(-.035,-.161),(.035,-.161),(.065,-.036)],.002,.032,grain,wheel,.009)
path('Lower spoke satin fork',[(-.06,-.049,.015),(-.024,-.149,.015),(0,-.156,.015),(.024,-.149,.015),(.06,-.049,.015)],.0045,satin,wheel)
poly_extrude('Airbag cover',[(-.068,.052),(-.08,.02),(-.07,-.044),(-.038,-.066),(.038,-.066),(.07,-.044),(.08,.02),(.068,.052)],.038,.043,leather,wheel,.016)
ellipse('Wheel emblem',(0,.009,.054),.017,.017,.0014,satin,wheel,32)
path('Airbag seam',[(-.04,-.044,.050),(0,-.048,.050),(.04,-.044,.050)],.0008,rubber,wheel)
box('Column shroud',(.16,.13,.22),(-.38,.995,-.60),grain,.034)
for side in [-1,1]:
    path('Control stalk',[(-.38+side*.065,1.035,-.54),(-.38+side*.19,1.055,-.53),(-.38+side*.235,1.065,-.51)],.010,rubber)
    box('Stalk grip',(.057,.027,.035),(-.38+side*.235,1.065,-.51),grain,.012)
    for i in [-1,0,1]:
        box('Stalk markings',(.002,.003,.001),(-.38+side*.235+i*.01,1.074,-.491),white,.0004)

# Barely visible bonnet falls away from the windscreen.
bonnet=[]
for z,y in [(-1.25,1.015),(-1.5,.99),(-1.85,.91),(-2.10,.82)]:
    bonnet.append([(x,y-.04*(abs(x)/.76)**3,z) for x in [-.76,-.65,-.4,0,.4,.65,.76]])
verts=[p for section in bonnet for p in section]
faces=[(j*7+i,(j+1)*7+i,(j+1)*7+i+1,j*7+i+1) for j in range(3) for i in range(6)]
mesh('Bonnet',verts,faces,paint)

# Apply source modifiers and batch by material AND articulated parent.
bpy.ops.object.select_all(action='DESELECT')
for ob in list(bpy.context.scene.objects):
    if ob.type not in {'MESH','CURVE'}: continue
    bpy.context.view_layer.objects.active=ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.select_set(False)
groups={}
for ob in list(bpy.context.scene.objects):
    if ob.type=='MESH':
        groups.setdefault((ob.parent,ob.data.materials[0]),[]).append(ob)
for (parent,mat),objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects: ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:
        bpy.ops.object.join()
    objects[0].name=f'{parent.name} - {mat.name}'

# Bake short-range contact shading into vertex colours. This keeps recesses
# grounded under Three's broad daylight without a per-frame SSAO pass or maps.
bpy.context.view_layer.update()
verts,polys=[],[]
meshes=[ob for ob in bpy.context.scene.objects if ob.type=='MESH']
for ob in meshes:
    offset=len(verts)
    verts.extend(ob.matrix_world @ v.co for v in ob.data.vertices)
    polys.extend(tuple(offset+i for i in p.vertices) for p in ob.data.polygons)
bvh=BVHTree.FromPolygons(verts,polys)
for ob in meshes:
    attr=ob.data.color_attributes.new(name='Contact shading',type='BYTE_COLOR',domain='POINT')
    ob.data.color_attributes.active_color=attr
    normal_matrix=ob.matrix_world.to_3x3().inverted().transposed()
    for v in ob.data.vertices:
        normal=(normal_matrix @ v.normal).normalized()
        rotation=Vector((0,0,1)).rotation_difference(normal)
        origin=ob.matrix_world @ v.co+normal*.001
        occlusion=0
        for i in range(16):
            r=math.sqrt((i+.5)/16)
            a=i*2.3999632297
            direction=rotation @ Vector((r*math.cos(a),r*math.sin(a),math.sqrt(1-r*r)))
            _,_,_,distance=bvh.ray_cast(origin,direction,.12)
            if distance is not None:
                occlusion+=1-distance/.12
        ao=1-.45*occlusion/16
        attr.data[v.index].color=(ao,ao,ao,1)

out=ROOT/'src/scene/assets/cockpit/interior.glb'
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_cameras=False,export_lights=False,
                          export_animations=False,export_yup=True,export_extras=False,
                          export_vertex_color='ACTIVE',export_all_vertex_colors=False)
print(f'Cockpit exported: {out.stat().st_size:,} bytes; {len(groups)} material batches')

if opts.render:
    # Offline material preview, not a claim of browser/WebGL validation.
    for mat,scale,strength in [(grain,900,.13),(leather,1100,.20),(cloth,1500,.3),(headliner,1300,.1)]:
        nodes=mat.node_tree.nodes
        noise=nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value=scale
        bump=nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=strength
        bump.inputs['Distance'].default_value=.001
        mat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
    # Driver eye, pitch, vertical FOV exactly match the application.
    bpy.ops.object.camera_add(location=xyz((-.38,1.46,.42)))
    cam=bpy.context.object
    direction=xyz((0,math.sin(-.14),-math.cos(-.14)))
    cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    cam.data.sensor_fit='VERTICAL'
    cam.data.angle=math.radians(68)
    cam.data.clip_start=.025
    bpy.context.scene.camera=cam
    # Display proxy for the live runtime texture, deliberately added after export.
    gauge=material('Preview instrument illumination',(.015,.023,.029),.8)
    poly_extrude('Preview display',[(-.245,-.095),(.245,-.095),(.245,.095),(-.245,.095)],.022,.001,gauge,instrument_mount,.001)
    for x in [-.13,.13]:
        ellipse('Preview dial',(x,0,.025),.075,.075,.0018,white,instrument_mount)
        path('Preview needle',[(x,0,.027),(x-.05,-.04,.027)],.0013,red,instrument_mount)
    preview_mirror=material('Preview mirror',(.8,.85,.87),.035,1)
    box('Preview mirror glass',(.273,.09,.001),(0,0,.023),preview_mirror,.0004,mirror_mount)
    world=bpy.context.scene.world
    world.use_nodes=True
    world.node_tree.nodes.get('Background').inputs[0].default_value=(.62,.70,.77,1)
    world.node_tree.nodes.get('Background').inputs[1].default_value=.45
    def area(pos,energy,size):
        bpy.ops.object.light_add(type='AREA',location=xyz(pos))
        ob=bpy.context.object
        ob.data.energy=energy
        ob.data.shape='DISK'
        ob.data.size=size
        ob.rotation_euler=(xyz((0,1,0))-ob.location).to_track_quat('-Z','Y').to_euler()
    area((0,3,-3),180,4)
    area((-3,2,0),90,3)
    area((3,2,0),60,3)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1485
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=opts.render
    bpy.ops.wm.save_as_mainfile(filepath='/tmp/simulatura-cockpit.blend')
    bpy.ops.render.render(write_still=True)
