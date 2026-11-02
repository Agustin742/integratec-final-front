"""Continuous school garments; run inside Blender, without opening/resetting a file.

build(source_checkout, destination_checkout, sex, level, bottom) creates an
isolated scene, preserves sources, and writes only the designated asset trees.
All topology is new. The canonical runtime body/rig is inspection reference.
"""
import hashlib
import json
import math
from pathlib import Path
import struct

import bmesh
import bpy
from mathutils import Vector, kdtree


def material(name, color, roughness=.86):
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = (*linear, 1)
    node.inputs['Roughness'].default_value = roughness
    return mat


def mesh(name, vertices, faces, mat):
    # Armhole construction leaves two unused pattern points; never publish them.
    used = sorted({i for face in faces for i in face})
    index = {old:new for new,old in enumerate(used)}
    vertices = [vertices[i] for i in used]
    faces = [tuple(index[i] for i in face) for face in faces]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(mat)
    for p in data.polygons:
        p.use_smooth = True
    return obj


def select(objects):
    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def apply(obj, kind, name, **settings):
    mod = obj.modifiers.new(name, kind)
    for key, value in settings.items():
        setattr(mod, key, value)
    select([obj])
    bpy.ops.object.modifier_apply(modifier=mod.name)


def box(name, center, size, mat):
    vertices = [(center[0] + x * size[0] / 2, center[1] + y * size[1] / 2,
                 center[2] + z * size[2] / 2) for x, y, z in
                [(-1,-1,-1), (1,-1,-1), (1,1,-1), (-1,1,-1),
                 (-1,-1,1), (1,-1,1), (1,1,1), (-1,1,1)]]
    obj = mesh(name, vertices, [(0,1,2,3), (4,5,6,7), (0,1,5,4),
                               (1,2,6,5), (2,3,7,6), (3,0,4,7)], mat)
    apply(obj, 'BEVEL', 'Rounded construction detail', width=min(size) * .3, segments=3)
    return obj


def rings(name, rows, mat, pleat=0, cap=False):
    vertices, faces, n = [], [], 48
    for z, cx, rx, front, back in rows:
        for j in range(n):
            t = math.tau * j / n
            scale = 1 + pleat * math.cos(12 * t)
            vertices.append((cx + rx * math.cos(t) * scale,
                             (front if math.sin(t) < 0 else back) * math.sin(t) * scale, z))
    for row in range(len(rows) - 1):
        for j in range(n):
            a, b = row * n + j, row * n + (j + 1) % n
            faces.append((a, b, b + n, a + n))
    if cap:
        faces += [tuple(range(n)), tuple(range(len(vertices) - n, len(vertices)))]
    return mesh(name, vertices, faces, mat)


def coat_surface(female, primary):
    front = .278 if female else .202
    hem = .365 if primary else .465
    return [(hem, .325 if primary else .275, .31 if primary else .232, .235 if primary else .21),
            (hem + .025, .321 if primary else .273, .306 if primary else .229, .232 if primary else .207),
            (.53, .235, front, .155), (.60, .211, front, .125),
            (.69, .205, front, .119), (.735, .18, front * .82, .099),
            (.752, .075, .073, .065)]


def continuous_top(female, primary, cloth):
    rows = coat_surface(female, primary)
    vertices, faces, n = [], [], 16
    for row, (z, rx, front, back) in enumerate(rows):
        power = .6 if row < 2 else (.75 if row == 2 else 1)
        for j in range(n):
            t = j * math.tau / n
            c, s = math.cos(t), math.sin(t)
            vertices.append((rx * math.copysign(abs(c)**power,c),
                (front if s < 0 else back) * math.copysign(abs(s)**power,s), z))
    # Two eight-vertex armholes, each stitched directly into the sleeve loops.
    for row in range(len(rows) - 1):
        for j in range(n):
            if row in (3, 4) and j in (0, 7, 8, 15):
                continue
            a, b = row * n + j, row * n + (j + 1) % n
            faces.append((a, b, b + n, a + n))
    right = [3*n+15, 3*n, 3*n+1, 4*n+1, 5*n+1, 5*n, 5*n+15, 4*n+15]
    left = [3*n+9, 3*n+8, 3*n+7, 4*n+7, 5*n+7, 5*n+8, 5*n+9, 4*n+9]
    for sign, previous in [(1, right), (-1, left)]:
        for x, radius in [(.245,.070), (.32,.065), (.40,.057), (.475,.047), (.485,.047)]:
            current = []
            for j in range(8):
                a = math.radians(-135 + j * 45)
                current.append(len(vertices))
                vertices.append((sign*x, -.025 + radius*math.cos(a),
                                 .69 - .06*(x-.20) + radius*math.sin(a)))
            for j in range(8):
                faces.append((previous[j], previous[(j+1)%8], current[(j+1)%8], current[j]))
            previous = current
    obj = mesh('Continuous guardapolvo' if primary else 'Continuous sweater', vertices, faces, cloth)
    apply(obj, 'SUBSURF', 'Continuous tailored smoothing', levels=2)
    return obj, rows


def front_at(rows, x, z):
    for index, (low, high) in enumerate(zip(rows, rows[1:])):
        if low[0] <= z <= high[0]:
            t = (z-low[0]) / (high[0]-low[0])
            rx = low[1]*(1-t)+high[1]*t
            depth = low[2]*(1-t)+high[2]*t
            powers = [.6,.6,.75,1,1,1,1]
            power = powers[index]*(1-t)+powers[index+1]*t
            return -depth*max(.02,1-abs(x/rx)**(2/power))**(power/2) - .006
    return -.08


def detail(name, xz, rows, mat, surface=None):
    # Lower construction uses the analytic pattern. Neck folds instead sample
    # the sole continuous, already-smoothed front surface: no overlapping donors.
    vertices = [(x,front_at(rows,x,z)-.006,z) for x,z in xz]
    obj = mesh(name, vertices, [tuple(range(len(xz)))], mat)
    if surface is not None:
        # Corner-only seating leaves chords inside the convex neckline. Refine
        # the entire patch before seating; this remains one coherent surface.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=5,use_grid_fill=True)
        for vertex in bm.verts:
            x,z = vertex.co.x,vertex.co.z
            hit,point,normal,index = surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
            assert hit, 'Collar pattern must stay on the continuous garment'
            vertex.co.y = point.y-.009
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    apply(obj, 'SOLIDIFY', 'Folded fabric thickness', thickness=.003)
    return obj


def patch(name, x0, x1, low, high, rows, mat):
    vertices, faces = [], []
    for j in range(5):
        z = low + (high-low)*j/4
        for x in [x0,(x0+x1)/2,x1]:
            vertices.append((x,front_at(rows,x,z)-.006,z))
    for j in range(4):
        for i in range(2):
            a = j*3+i
            faces.append((a,a+1,a+4,a+3))
    obj = mesh(name,vertices,faces,mat)
    apply(obj,'SOLIDIFY','Patch fabric thickness',thickness=.003)
    return obj


def garments(sex, level, bottom, body, rig, donors):
    primary, female = level == 'primary', sex == 'female'
    cream = material('Warm ivory fabric', '#F4E6D2')
    navy = material('Institutional navy', '#34466E')
    indigo = material('Secondary indigo', '#5B4F96')
    ink = material('School leather', '#353849', .65)
    sole = material('Soft charcoal soles', '#382F3F')
    top, rows = continuous_top(female, primary, cream if primary else indigo)
    tops = [top]
    for sign in [-1, 1]:
        tops.append(detail('Folded collar', [(sign*.012,.744),(sign*.078,.744),
            (sign*.12,.702),(sign*.045,.712)], rows, cream, surface=top))
    if primary:
        tops.append(patch('Continuous coat placket',-.009,.009,.402,.652,rows,cream))
        for z in [.426,.477,.528,.579,.63]:
            tops.append(box('Coat button', (0,front_at(rows,0,z)-.013,z), (.01,.009,.01), navy))
        for sign in [-1,1]:
            tops.append(patch('Continuous patch pocket',sign*.07,sign*.16,.428,.503,rows,cream))
        tops.append(detail('Navy tie', [(-.016,.706),(.016,.706),(.02,.66),
            (.026,.612),(0,.59),(-.026,.612),(-.02,.66)], rows, navy))
        for vertex in tops[-1].data.vertices:
            vertex.co.y -= .016
        tops.append(box('Tie knot', (0,front_at(rows,0,.716)-.025,.716), (.03,.018,.026), navy))
    else:
        tops.append(detail('Polo beneath V-neck', [(-.058,.735),(.058,.735),(0,.666)], rows, cream, surface=top))
        tops.append(box('Polo button', (0,front_at(rows,0,.713)-.012,.713), (.009,.008,.009), navy))
    if bottom == 'skirt':
        bottoms = [rings('Institutional pleated skirt', [(.507,0,.225,.19,.18),
            (.45,0,.255,.205,.20),(.30,0,.295,.229,.222),(.17,0,.335,.246,.24)], navy, .025)]
    else:
        volumes = [rings('New trouser yoke', [(.508,0,.20,.16,.15),
            (.45,0,.255,.185,.18),(.325,0,.235,.17,.16)], navy, cap=True)]
        for sign in [-1,1]:
            volumes.append(rings('New pressed trouser leg', [(.42,sign*.127,.13,.177,.17),
                (.32,sign*.15,.118,.151,.14),(.225,sign*.15,.10,.115,.103),
                (.166,sign*.15,.094,.10,.095)], navy, cap=True))
        select(volumes)
        bpy.ops.object.join()
        pants = bpy.context.object
        pants.name = 'Navy dress trousers'
        apply(pants, 'REMESH', 'Continuous new trouser seams', mode='VOXEL', voxel_size=.008)
        apply(pants, 'SMOOTH', 'Soft pressed tailoring', factor=.5, iterations=3)
        for p in pants.data.polygons:
            p.use_smooth = True
        bottoms = [pants]
    shoes = []
    for sign in [-1,1]:
        last = rings('School shoe', [(.008,sign*.207,.121,.237,.12),
            (.036,sign*.207,.121,.237,.12),(.07,sign*.207,.116,.226,.117),
            (.13,sign*.20,.108,.204,.108),(.19,sign*.166,.077,.096,.082),
            (.215,sign*.151,.070,.073,.073)], ink, cap=True)
        last.data.materials.append(sole)
        for p in last.data.polygons:
            if p.center.z < .038:
                p.material_index = 1
        shoes.append(last)

    for objects, donor in [(tops,body),(bottoms,donors['Pants']),(shoes,donors['boots'])]:
        bind(objects, donor, rig)
    if bottom == 'trousers':
        for v in bottoms[0].data.vertices:
            z = v.co.z
            left = .5+.5*math.tanh(v.co.x/.055)
            hip = min(1,max(0,(.49-z)/.10))
            anchors = [(.43,'thigh'),(.32,'thigh.001'),(.24,'shin'),(.165,'shin.001')]
            pair = [(anchors[-1][1],1)]
            for (za,ba),(zb,bb) in zip(anchors,anchors[1:]):
                if zb <= z <= za:
                    t = (za-z)/(za-zb)
                    pair = [(ba,1-t),(bb,t)]
            if z > .43:
                pair = [('thigh',1)]
            weights = {'DEF-spine':1-hip}
            for bone,w in pair:
                for side,fraction in [('L',left),('R',1-left)]:
                    part = bone.split('.')
                    name = f'DEF-{part[0]}.{side}'+('.'+part[1] if len(part)>1 else '')
                    weights[name] = hip*w*fraction
            set_weights(bottoms[0],v,weights)
    # Limited thigh rotation prevents the lower hem inverting above the waist.
    for obj in tops + (bottoms if bottom == 'skirt' else []):
        for v in obj.data.vertices:
            if v.co.z >= .52:
                continue
            blend = min(.18,max(0,(.52-v.co.z)/.14)*.18)
            left = .5 + .5*math.tanh(v.co.x/.09)
            weights = {'DEF-spine':1-blend,'DEF-thigh.L':blend*left,'DEF-thigh.R':blend*(1-left)}
            set_weights(obj,v,weights)
    return {'coat-tie' if primary else 'polo-sweater':tops, bottom:bottoms, 'shoes':shoes}


def set_weights(obj, vertex, weights):
    for group in obj.vertex_groups:
        group.remove([vertex.index])
    chosen = sorted([(name,w) for name,w in weights.items() if w>0],key=lambda item:-item[1])[:4]
    total = sum(w for name,w in chosen)
    for name,weight in chosen:
        group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
        group.add([vertex.index],weight/total,'REPLACE')


def bind(objects, donor, rig):
    tree = kdtree.KDTree(len(donor.data.vertices))
    for v in donor.data.vertices:
        tree.insert(donor.matrix_world@v.co,v.index)
    tree.balance()
    for obj in objects:
        groups = {b.name:obj.vertex_groups.new(name=b.name) for b in rig.data.bones}
        for v in obj.data.vertices:
            weights = {}
            for point,index,distance in tree.find_n(obj.matrix_world@v.co,8):
                for entry in donor.data.vertices[index].groups:
                    name = donor.vertex_groups[entry.group].name
                    weights[name] = weights.get(name,0) + entry.weight/max(distance,.003)**2
            chosen = sorted(weights.items(),key=lambda item:-item[1])[:4]
            total = sum(w for name,w in chosen)
            for name,w in chosen:
                groups[name].add([v.index],w/total,'REPLACE')
        world = obj.matrix_world.copy()
        obj.parent = rig
        obj.matrix_world = world
        mod = obj.modifiers.new('Canonical body rig','ARMATURE')
        mod.object = rig


def snapshot(objects):
    return hashlib.sha256(repr([(o.name,tuple(tuple(r) for r in o.matrix_world),
        tuple(tuple(r) for r in o.matrix_parent_inverse),
        [(tuple(v.co),tuple((g.group,g.weight) for g in v.groups)) for v in o.data.vertices]
        if o.type == 'MESH' else [(b.name,tuple(tuple(r) for r in b.matrix_local)) for b in o.data.bones])
        for o in objects]).encode()).hexdigest()


def stage(scene):
    world = bpy.data.worlds.new('Uniform studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.45,.50,.60,1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .7
    scene.world = world
    camera = bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera'))
    scene.collection.objects.link(camera)
    camera.location = (2,-4,2.05)
    camera.rotation_euler = (Vector((0,0,.63))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type, camera.data.ortho_scale = 'ORTHO',1.65
    scene.camera = camera
    for location,energy in [((1,-3,4),250),((-3,-1,2),120)]:
        light = bpy.data.objects.new('Studio area',bpy.data.lights.new('Studio area','AREA'))
        scene.collection.objects.link(light)
        light.data.energy, light.data.size = energy,3
        light.location = location
        light.rotation_euler = (Vector((0,0,.6))-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 720,800
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.render.image_settings.file_format = 'PNG'


def render_poses(scene, rig, preview):
    ad = rig.animation_data
    saved = (ad.action,ad.action_slot,[t.mute for t in ad.nla_tracks],scene.frame_current)
    coverage = {}
    try:
        rig.data.pose_position = 'POSE'
        for track in ad.nla_tracks:
            track.mute = True
        for clip,frames in [('Idle',[1,25,49]),('Walk',[1,13,25]),('Sit',[1,49,97])]:
            strip = next(t for t in ad.nla_tracks if t.name == clip).strips[0]
            ad.action, ad.action_slot = strip.action,strip.action_slot
            for frame in frames:
                scene.frame_set(frame)
                deps = bpy.context.evaluated_depsgraph_get()
                for obj in scene.objects:
                    if obj.type != 'MESH' or obj.hide_render:
                        continue
                    evaluated = obj.evaluated_get(deps)
                    data = evaluated.to_mesh()
                    assert data.vertices and all(math.isfinite(c) for v in data.vertices for c in v.co)
                    evaluated.to_mesh_clear()
                if frame == frames[1]:
                    scene.render.filepath = str(preview/f'{clip.lower()}-{frame}.png')
                    bpy.ops.render.render(write_still=True)
            coverage[clip] = frames
    finally:
        ad.action, ad.action_slot = saved[0],saved[1]
        for track,mute in zip(ad.nla_tracks,saved[2]):
            track.mute = mute
        rig.data.pose_position = 'REST'
        scene.frame_set(saved[3])
    return coverage


def build(source, destination, sex, level, bottom):
    source, destination = Path(source),Path(destination)
    variant = f'{level}-{bottom}'
    preview = destination/f'odd/previews/student-uniforms/{sex}/{variant}'
    folder = destination/f'assets/blender/avatars/student-uniforms/{sex}/{variant}'
    out = destination/f'public/models/avatars/{sex}/uniforms/{variant}'
    # Revise only our own manifested outputs or the explicitly authorized male study.
    if any(p.exists() for p in [preview,folder,out]) and (sex,variant) != ('male','primary-trousers'):
        manifest = preview/'checks.json'
        if not manifest.exists() or json.loads(manifest.read_text()).get('variant') != f'{sex}/{variant}':
            raise FileExistsError('Only this task\'s own manifested variants may be revised')
    for p in [preview,folder,out]:
        p.mkdir(parents=True,exist_ok=True)
    inputs = [source/f'public/models/avatars/{sex}/body.glb',source/f'assets/blender/avatars/{sex}-editable.blend']
    hashes = {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
    original = bpy.context.window.scene
    scene = bpy.data.scenes.new(f'Continuous uniform {sex} {variant}')
    try:
        bpy.context.window.scene = scene
        bpy.ops.import_scene.gltf(filepath=str(inputs[0]))
        rig = next(o for o in scene.objects if o.type == 'ARMATURE')
        base = [o for o in scene.objects if o.type == 'MESH']
        donors = {key:next(o for o in base if o.name.startswith(key)) for key in ['Body','Pants','boots']}
        rig.data.pose_position = 'REST'
        scene.frame_set(0)
        bpy.context.view_layer.update()
        before = snapshot(base+[rig])
        modules = garments(sex,level,bottom,donors['Body'],rig,donors)
        anatomy = [o for o in base if o not in [donors['Pants'],donors['boots']]]
        for obj in [donors['Pants'],donors['boots']]:
            obj.hide_render = True
            obj.hide_set(True)
        all_garments = [o for objects in modules.values() for o in objects]
        for obj in all_garments:
            assert obj.data.vertices and obj.data.polygons
            assert all(math.isfinite(c) for v in obj.data.vertices for c in v.co)
            assert all(abs(sum(g.weight for g in v.groups)-1)<1e-5 for v in obj.data.vertices)
            assert any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers)
        stage(scene)
        scene.render.filepath = str(preview/'rest.png')
        bpy.ops.render.render(write_still=True)
        camera_location = scene.camera.location.copy()
        scene.camera.location = (0,-4,1.1)
        scene.camera.rotation_euler = (Vector((0,0,.63))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath = str(preview/'front.png')
        bpy.ops.render.render(write_still=True)
        scene.camera.location = camera_location
        scene.camera.rotation_euler = (Vector((0,0,.63))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        # S8: static design stage only. Do not rerun the known failed seated fit.
        assert snapshot(base+[rig]) == before
        assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in hashes.items())
        for name,objects in list(modules.items())+[('dressed',anatomy+all_garments)]:
            path = preview/'dressed.glb' if name=='dressed' else out/f'{name}.glb'
            select([rig]+objects)
            bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
                use_active_scene=True,export_animations=False,export_skins=True)
        bpy.data.libraries.write(str(folder/'uniform.blend'),{scene},fake_user=True)
        report = {'scene':scene.name,'variant':f'{sex}/{variant}','source_sha256':hashes,
            'base_geometry_weights_and_binds_unchanged':True,'source_hashes_unchanged':True,
            'garment_meshes':len(all_garments),'motion_acceptance':'Deferred by S8; not checked in this stage.',
            'static_views':['rest.png','front.png'],
            'visual_acceptance':'Pending static rendered inspection, not implied by structural checks.'}
        (preview/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
        return report
    finally:
        bpy.context.window.scene = original
