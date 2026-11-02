"""Bounded Blender motion study; never opens/resets the user's main file.

Load this module with exec inside Blender MCP, then call revise() and verify().
All appended scenes are retained. Existing scenes and read-only sources survive.
"""
import hashlib
import json
import math
from pathlib import Path
import struct
import types

import bpy
from mathutils import Vector


VARIANTS = [('male', 'primary-trousers'), ('male', 'secondary-trousers'),
            ('female', 'primary-trousers'), ('female', 'secondary-trousers'),
            ('female', 'primary-skirt'), ('female', 'secondary-skirt')]


def authoring(root):
    module = types.ModuleType('student_uniforms')
    path = Path(root) / 'scripts/blender/student_uniforms.py'
    exec(compile(path.read_text(), str(path), 'exec'), module.__dict__)
    return module


def modules(scene, level, bottom):
    prefixes = ('Continuous guardapolvo', 'Continuous sweater', 'Folded collar',
                'Continuous coat placket', 'Coat button', 'Continuous patch pocket',
                'Navy tie', 'Tie knot', 'Polo beneath V-neck', 'Polo button')
    return {
        'coat-tie' if level == 'primary' else 'polo-sweater':
            [o for o in scene.objects if o.type == 'MESH' and o.name.startswith(prefixes)],
        bottom: [o for o in scene.objects if o.type == 'MESH' and
                 o.name.startswith('Institutional pleated skirt' if bottom == 'skirt' else 'Navy dress trousers')],
        'shoes': [o for o in scene.objects if o.type == 'MESH' and o.name.startswith('School shoe')],
    }


def revise(root, sex, variant):
    root = Path(root)
    folder = root / f'assets/blender/avatars/student-uniforms/{sex}/{variant}'
    report = json.loads((folder / 'checks.json').read_text())
    assert report['variant'] == f'{sex}/{variant}'
    source_hashes = report['source_sha256']
    assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == h
               for p, h in source_hashes.items())
    original = bpy.context.window.scene
    try:
        with bpy.data.libraries.load(str(folder / 'uniform.blend'), link=False) as (src, dst):
            dst.scenes = src.scenes
        scene = dst.scenes[0]
        scene.name = f'Motion revised {sex} {variant}'
        bpy.context.window.scene = scene
        rig = next(o for o in scene.objects if o.type == 'ARMATURE')
        level, bottom = variant.split('-')
        grouped = modules(scene, level, bottom)
        assert all(grouped.values())
        garments = [o for group in grouped.values() for o in group]
        base = [o for o in scene.objects if o.type == 'MESH' and o not in garments]
        u = authoring(root)
        before = u.snapshot(base + [rig])
        knee = None
        if bottom == 'skirt':
            knee = u.shorten_skirt(grouped[bottom][0], rig)
            assert abs(min(v.co.z for v in grouped[bottom][0].data.vertices) - knee) < .002
        u.fit_lower_panels(grouped['coat-tie' if level == 'primary' else 'polo-sweater'] +
                           (grouped[bottom] if bottom == 'skirt' else []))
        scene['motion_base_snapshot'] = before
        scene['motion_source_hashes'] = json.dumps(source_hashes)
        scene['motion_knee_height'] = knee if knee is not None else -1
        assert before == u.snapshot(base + [rig])
        return {'scene': scene.name, 'knee_height': knee, 'base_preserved': True}
    finally:
        bpy.context.window.scene = original


def render_view(scene, directory, label, view):
    positions = {'front': (0, -4, 1.1), 'side': (4, 0, 1.1),
                 'three-quarter': (2, -4, 2.05)}
    scene.camera.location = positions[view]
    scene.camera.rotation_euler = (Vector((0, 0, .63)) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_percentage = 60
    scene.render.filepath = str(directory / f'{label}-{view}.png')
    bpy.ops.render.render(write_still=True)


def verify(root, sex, variant, export=False):
    root = Path(root)
    scene = bpy.data.scenes[f'Motion revised {sex} {variant}']
    folder = root / f'assets/blender/avatars/student-uniforms/{sex}/{variant}'
    evidence = folder / 'motion-after'
    evidence.mkdir(exist_ok=True)
    original = bpy.context.window.scene
    bpy.context.window.scene = scene
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    ad = rig.animation_data
    saved = (ad.action, ad.action_slot, [t.mute for t in ad.nla_tracks], scene.frame_current)
    level, bottom = variant.split('-')
    grouped = modules(scene, level, bottom)
    garments = [o for group in grouped.values() for o in group]
    base = [o for o in scene.objects if o.type == 'MESH' and o not in garments]
    u = authoring(root)
    coverage = {}
    try:
        for o in garments:
            assert any(m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)
            for v in o.data.vertices:
                assert abs(sum(g.weight for g in v.groups) - 1) < 1e-5
                assert all(o.vertex_groups[g.group].name in rig.data.bones for g in v.groups)
        rig.data.pose_position = 'REST'
        scene.frame_set(0)
        for view in ('front', 'three-quarter', 'side'):
            render_view(scene, evidence, 'rest', view)
        rig.data.pose_position = 'POSE'
        for track in ad.nla_tracks:
            track.mute = True
        for clip in ('Idle', 'Walk', 'Sit'):
            strip = next(t for t in ad.nla_tracks if t.name == clip).strips[0]
            ad.action, ad.action_slot = strip.action, strip.action_slot
            first, last = map(round, strip.action.frame_range)
            frames = list(range(first, last + 1))
            for frame in frames:
                scene.frame_set(frame)
                deps = bpy.context.evaluated_depsgraph_get()
                for obj in garments + [o for o in base if not o.hide_render]:
                    evaluated = obj.evaluated_get(deps)
                    data = evaluated.to_mesh()
                    try:
                        assert data.vertices and all(math.isfinite(c) for v in data.vertices for c in v.co)
                    finally:
                        evaluated.to_mesh_clear()
            mid = (first + last) // 2
            scene.frame_set(mid)
            for view in ('front', 'side', 'three-quarter'):
                render_view(scene, evidence, f'{clip.lower()}-{mid}', view)
            for frame in (first, last):
                scene.frame_set(frame)
                render_view(scene, evidence, f'{clip.lower()}-{frame}', 'three-quarter')
            coverage[clip] = {'finite_integer_frames': frames, 'rendered_frames': [first, mid, last]}
    finally:
        ad.action, ad.action_slot = saved[0], saved[1]
        for track, mute in zip(ad.nla_tracks, saved[2]):
            track.mute = mute
        rig.data.pose_position = 'REST'
        scene.frame_set(saved[3])
        bpy.context.window.scene = original
    assert u.snapshot(base + [rig]) == scene['motion_base_snapshot']
    hashes = json.loads(scene['motion_source_hashes'])
    assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == h for p, h in hashes.items())
    result = {'variant': f'{sex}/{variant}', 'scene': scene.name, 'coverage': coverage,
              'base_geometry_weights_rest_binds_unchanged': True, 'source_sha256': hashes,
              'normalized_canonical_weights': True, 'knee_height': scene['motion_knee_height'],
              'visual_fit': 'Requires image inspection; finite coordinates are not fit acceptance.'}
    if export:
        bpy.context.window.scene = scene
        try:
            out = root / f'public/models/avatars/{sex}/uniforms/{variant}'
            preview = root / f'odd/previews/student-uniforms/{sex}/{variant}'
            anatomy = [o for o in base if not o.hide_render]
            for name, objects in list(grouped.items()) + [('dressed', anatomy + garments)]:
                path = preview / 'dressed.glb' if name == 'dressed' else out / f'{name}.glb'
                u.select([rig] + objects)
                bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                    use_active_scene=True, export_animations=False, export_skins=True)
            bpy.data.libraries.write(str(folder / 'uniform.blend'), {scene}, fake_user=True)
            # Refresh the existing static inspection images without changing their paths.
            for view, name in [('front', 'front.png'), ('three-quarter', 'rest.png')]:
                image = evidence / f'rest-{view}.png'
                (folder / name).write_bytes(image.read_bytes())
                (preview / name).write_bytes(image.read_bytes())
        finally:
            bpy.context.window.scene = original
    (folder / 'motion-checks.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def regression_checks(root, source):
    """Exercise the public garment builder, including unchanged trousers/shoes."""
    root, source = Path(root), Path(source)
    original = bpy.context.window.scene
    u = authoring(root)
    results = []
    try:
        for sex, level, bottom in [('male', 'primary', 'trousers'),
                                   ('female', 'secondary', 'skirt')]:
            scene = bpy.data.scenes.new(f'Motion builder regression {sex}')
            bpy.context.window.scene = scene
            bpy.ops.import_scene.gltf(filepath=str(source / f'public/models/avatars/{sex}/body.glb'))
            rig = next(o for o in scene.objects if o.type == 'ARMATURE')
            rig.data.pose_position = 'REST'
            scene.frame_set(0)
            bpy.context.view_layer.update()
            donors = {key: next(o for o in scene.objects if o.type == 'MESH' and o.name.startswith(key))
                      for key in ('Body', 'Pants', 'boots')}
            base = list(donors.values()) + [rig]
            before = u.snapshot(base)
            grouped = u.garments(sex, level, bottom, donors['Body'], rig, donors)
            assert u.snapshot(base) == before
            reference = modules(bpy.data.scenes[f'Motion revised {sex} {level}-{bottom}'], level, bottom)
            for key in grouped:
                assert len(grouped[key]) == len(reference[key])
                # Names acquire Blender suffixes; compare component geometry, not suffixes.
                actual = sorted([tuple(tuple(v.co) for v in o.data.vertices) for o in grouped[key]])
                expected = sorted([tuple(tuple(v.co) for v in o.data.vertices) for o in reference[key]])
                assert actual == expected, f'{sex}/{key}: rest geometry regression'
            for obj in [o for group in grouped.values() for o in group]:
                assert all(abs(sum(g.weight for g in v.groups) - 1) < 1e-5 for v in obj.data.vertices)
            panels = grouped['coat-tie' if level == 'primary' else 'polo-sweater']
            for obj in panels + (grouped[bottom] if bottom == 'skirt' else []):
                upper = [(v.index, tuple((g.group, g.weight) for g in v.groups))
                         for v in obj.data.vertices if v.co.z >= .52]
                u.fit_lower_panels([obj])
                assert upper == [(i, tuple((g.group, g.weight) for g in obj.data.vertices[i].groups)) for i, _ in upper]
            if bottom == 'skirt':
                skirt = grouped[bottom][0]
                coords = [tuple(v.co) for v in skirt.data.vertices]
                assert abs(min(v.co.z for v in skirt.data.vertices) - u.knee_height(rig)) < .002
                u.shorten_skirt(skirt, rig)
                assert coords == [tuple(v.co) for v in skirt.data.vertices], 'Shortening must be idempotent'
            results.append({'variant': f'{sex}/{level}-{bottom}', 'rest_geometry_regression': 'pass',
                            'base_preserved': True, 'weights_normalized': True, 'upper_weights_preserved': True})
    finally:
        bpy.context.window.scene = original
    (root / 'assets/blender/avatars/student-uniforms/motion-regressions.json').write_text(json.dumps(results, indent=2) + '\n')
    return results


def glb_data(path):
    data = Path(path).read_bytes()
    assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 4)[0] == 2
    assert struct.unpack_from('<I', data, 8)[0] == len(data)
    length = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + length])
    binary = data[28 + length:]
    return document, binary


def accessor(document, binary, index):
    a = document['accessors'][index]
    view = document['bufferViews'][a['bufferView']]
    code, size = {5126: ('f', 4), 5123: ('H', 2), 5121: ('B', 1), 5125: ('I', 4)}[a['componentType']]
    count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = view.get('byteStride', size * count)
    return [struct.unpack_from('<' + code * count, binary, offset + i * stride) for i in range(a['count'])]


def audit_exports(root, source, sex, variant):
    root, source = Path(root), Path(source)
    canonical, cb = glb_data(source / f'public/models/avatars/{sex}/body.glb')
    cs = canonical['skins'][0]
    names = [canonical['nodes'][j]['name'] for j in cs['joints']]
    binds = dict(zip(names, accessor(canonical, cb, cs['inverseBindMatrices'])))
    paths = list((root / f'public/models/avatars/{sex}/uniforms/{variant}').glob('*.glb'))
    paths.append(root / f'odd/previews/student-uniforms/{sex}/{variant}/dressed.glb')
    reports = []
    for path in paths:
        doc, binary = glb_data(path)
        error = 0
        weight_error = 0
        for skin in doc['skins']:
            joints = [doc['nodes'][j]['name'] for j in skin['joints']]
            assert set(joints) == set(names)
            for name, matrix in zip(joints, accessor(doc, binary, skin['inverseBindMatrices'])):
                error = max(error, max(abs(a - b) for a, b in zip(matrix, binds[name])))
            assert error < 2e-5
        for mesh in doc['meshes']:
            for primitive in mesh['primitives']:
                attributes = primitive['attributes']
                for attribute, index in attributes.items():
                    assert all(math.isfinite(c) for row in accessor(doc, binary, index) for c in row)
                if 'WEIGHTS_0' in attributes:
                    for row in accessor(doc, binary, attributes['WEIGHTS_0']):
                        weight_error = max(weight_error, abs(sum(row) - 1))
                    assert weight_error < 1e-5
                    assert all(0 <= c < len(names) for row in accessor(doc, binary, attributes['JOINTS_0']) for c in row)
                elif path.name != 'dressed.glb':
                    raise AssertionError('Every garment primitive must be skinned')
        reports.append({'path': str(path.relative_to(root)), 'bytes': path.stat().st_size,
                        'canonical_joints': len(names), 'inverse_bind_max_error': error,
                        'weight_sum_max_error': weight_error})
    folder = root / f'assets/blender/avatars/student-uniforms/{sex}/{variant}'
    (folder / 'export-checks.json').write_text(json.dumps(reports, indent=2) + '\n')
    return reports
