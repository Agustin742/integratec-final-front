"""Run with Blender --background --python-exit-code 1 --python this_file.

Checks decoded sleeve triangle winding on School Sweatshirt and Hoodie GLBs,
independently of shading and double-sided flags.
"""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]


def check():
    failures = []
    for asset_id, prefix in (('school-sweatshirt', 'SchoolSweatshirt'), ('hoodie', 'Hoodie')):
        for gender in ('male', 'female'):
            scene = bpy.data.scenes.new(f'WindingTest_{prefix}_{gender}')
            previous = bpy.context.window.scene
            try:
                bpy.context.window.scene = scene
                bpy.ops.import_scene.gltf(filepath=str(
                    ROOT / 'public/models/avatars' / gender / f'top-{asset_id}.glb'))
                shells = [o for o in scene.objects if o.type == 'MESH'
                          and f'{prefix}_' in o.name and '_Shell' in o.name]
                assert len(shells) == 1, (asset_id, gender, 'semantic shell', len(shells))
                mesh = shells[0].data
                mesh.calc_loop_triangles()
                coverage = []
                for sign, side in ((1, 'left'), (-1, 'right')):
                    dots = []
                    pivot = Vector((sign * 0.31209, -0.023599, 0.680165))
                    for tri in mesh.loop_triangles:
                        points = [mesh.vertices[i].co for i in tri.vertices]
                        center = sum(points, Vector()) / 3
                        if (all(sign * p.x >= .2249 for p in points)
                                and .225 < sign * center.x < .49
                                and .59 < center.z < .76
                                and abs(center.y + .03) < .09):
                            normal = (points[1] - points[0]).cross(points[2] - points[0])
                            assert normal.length > 0
                            if (center - pivot).length <= 0.048:
                                radial = center - pivot
                            else:
                                radial = Vector((0, center.y + .03, center.z - .675))
                            assert radial.length > 0
                            dots.append(normal.normalized().dot(radial.normalized()))
                    coverage.append(len(dots))
                    inward = sum(d <= 0 for d in dots)
                    print(f'{asset_id} {gender} {side}: triangles={len(dots)} inward={inward} '
                          f'min_dot={min(dots) if dots else None}', flush=True)
                    if not dots or inward:
                        failures.append(f'{asset_id} {gender} {side}: {inward}/{len(dots)} inward triangles')
                assert coverage[0] == coverage[1] and coverage[0] >= 400, (
                    asset_id, gender, 'extension coverage', coverage
                )
            finally:
                bpy.context.window.scene = previous
                for obj in list(scene.objects):
                    bpy.data.objects.remove(obj, do_unlink=True)
                bpy.data.scenes.remove(scene)
    assert not failures, '; '.join(failures)
    print('PASS: all decoded sleeve extensions face outward')


if __name__ == '__main__':
    check()
