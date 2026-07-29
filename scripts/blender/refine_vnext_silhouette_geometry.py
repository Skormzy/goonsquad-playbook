import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
SIDES = ('Home', 'Away')
REQUIRED_ACTIONS = (
    'ready',
    'jog',
    'jog-to-sprint-ik',
    'sprint',
    'turn',
    'stop',
    'receive',
    'pass',
    'shot',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--wordmark', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def round_vector(vector):
    return [round(value, 4) for value in vector]


def local_bounds(obj):
    minimum = Vector((min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    return {
        'minimumCm': round_vector(minimum),
        'maximumCm': round_vector(maximum),
        'dimensionsCm': round_vector(maximum - minimum),
    }


def action_key_counts():
    def fcurves(action):
        legacy = list(getattr(action, 'fcurves', []))
        if legacy:
            return legacy
        return [
            fcurve
            for layer in getattr(action, 'layers', [])
            for strip in getattr(layer, 'strips', [])
            for channelbag in getattr(strip, 'channelbags', [])
            for fcurve in channelbag.fcurves
        ]

    return {
        action.name: sum(len(fcurve.keyframe_points) for fcurve in fcurves(action))
        for action in bpy.data.actions
        if action.name in REQUIRED_ACTIONS
    }


def set_smooth(mesh):
    for polygon in mesh.polygons:
        polygon.use_smooth = True


def ensure_uv(mesh):
    if mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    layer = mesh.uv_layers.new(name='UVMap')
    minimum = Vector((min(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3)))
    extent = maximum - minimum
    for polygon in mesh.polygons:
        normal = polygon.normal
        for loop_index in polygon.loop_indices:
            coordinate = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if abs(normal.z) >= max(abs(normal.x), abs(normal.y)):
                u = (coordinate.x - minimum.x) / max(extent.x, 1e-6)
                v = (coordinate.y - minimum.y) / max(extent.y, 1e-6)
            elif abs(normal.y) >= abs(normal.x):
                u = (coordinate.x - minimum.x) / max(extent.x, 1e-6)
                v = (coordinate.z - minimum.z) / max(extent.z, 1e-6)
            else:
                u = (coordinate.y - minimum.y) / max(extent.y, 1e-6)
                v = (coordinate.z - minimum.z) / max(extent.z, 1e-6)
            layer.data[loop_index].uv = (u, v)


def clear_skinning(obj):
    for modifier in list(obj.modifiers):
        obj.modifiers.remove(modifier)
    for group in list(obj.vertex_groups):
        obj.vertex_groups.remove(group)


def skin_rigid(obj, armature, bone_name, bevel=0.0):
    clear_skinning(obj)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(range(len(obj.data.vertices)), 1.0, 'REPLACE')
    armature_modifier = obj.modifiers.new('GS_Armature', 'ARMATURE')
    armature_modifier.object = armature
    armature_modifier.use_deform_preserve_volume = True
    if bevel > 0.0:
        bevel_modifier = obj.modifiers.new('GS_SilhouetteBevel', 'BEVEL')
        bevel_modifier.width = bevel
        bevel_modifier.segments = 3


def replace_mesh(obj, vertices, faces, armature, bone_name, bevel, material_indices=None):
    old_mesh = obj.data
    materials = [material for material in old_mesh.materials if material]
    mesh = bpy.data.meshes.new(f'{obj.name}_Silhouette_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    for material in materials:
        mesh.materials.append(material)
    obj.data = mesh
    bpy.data.meshes.remove(old_mesh)
    if material_indices:
        for polygon, index in zip(mesh.polygons, material_indices):
            polygon.material_index = min(index, max(0, len(mesh.materials) - 1))
    ensure_uv(mesh)
    skin_rigid(obj, armature, bone_name, bevel)
    obj['silhouette_revision'] = 'production-form-v1'


def upper_geometry(sign):
    stations = (
        (5.2, 4.4, 2.0, 10.6, 7.65),
        (2.3, 4.8, 2.0, 11.2, 7.78),
        (-1.8, 5.1, 1.9, 10.0, 7.95),
        (-6.5, 5.3, 1.8, 8.2, 8.18),
        (-11.5, 5.1, 1.7, 6.7, 8.45),
        (-16.5, 4.5, 1.6, 5.3, 8.75),
        (-20.2, 3.2, 1.5, 4.3, 9.05),
    )
    ring_size = 16
    vertices = []
    for y, half_width, bottom, top, center_x in stations:
        center_x *= sign
        for index in range(ring_size):
            angle = math.tau * index / ring_size
            x = center_x + math.cos(angle) * half_width
            z = bottom + (math.sin(angle) + 1.0) * 0.5 * (top - bottom)
            vertices.append((x, y, z))
    faces = []
    material_indices = []
    for station in range(len(stations) - 1):
        start = station * ring_size
        next_start = (station + 1) * ring_size
        for index in range(ring_size):
            next_index = (index + 1) % ring_size
            faces.append((start + index, start + next_index, next_start + next_index, next_start + index))
            material_indices.append(0)
    faces.append(tuple(range(ring_size))[::-1])
    material_indices.append(0)
    last = (len(stations) - 1) * ring_size
    faces.append(tuple(last + index for index in range(ring_size)))
    material_indices.append(0)
    return vertices, faces, material_indices


def sole_geometry(sign):
    stations = (
        (5.5, 4.7, 7.62),
        (2.4, 5.0, 7.76),
        (-2.0, 5.3, 7.96),
        (-7.0, 5.5, 8.20),
        (-12.0, 5.3, 8.48),
        (-17.0, 4.7, 8.78),
        (-20.6, 3.5, 9.08),
    )
    ring = (
        (-0.72, 0.25),
        (0.72, 0.25),
        (1.0, 0.68),
        (0.92, 2.15),
        (0.68, 2.55),
        (-0.68, 2.55),
        (-0.92, 2.15),
        (-1.0, 0.68),
    )
    ring_size = len(ring)
    vertices = []
    for y, half_width, center_x in stations:
        center_x *= sign
        vertices.extend((center_x + x * half_width, y, z) for x, z in ring)
    faces = []
    for station in range(len(stations) - 1):
        start = station * ring_size
        next_start = (station + 1) * ring_size
        for index in range(ring_size):
            next_index = (index + 1) % ring_size
            faces.append((start + index, start + next_index, next_start + next_index, next_start + index))
    faces.append(tuple(range(ring_size))[::-1])
    last = (len(stations) - 1) * ring_size
    faces.append(tuple(last + index for index in range(ring_size)))
    return vertices, faces


BOX_FACES = (
    (0, 1, 2, 3),
    (4, 7, 6, 5),
    (0, 4, 5, 1),
    (1, 5, 6, 2),
    (2, 6, 7, 3),
    (4, 0, 3, 7),
)


def append_box(vertices, faces, center, axes, size):
    base = len(vertices)
    half = [value * 0.5 for value in size]
    for sx, sy, sz in (
        (-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
        (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1),
    ):
        point = center + axes[0] * half[0] * sx + axes[1] * half[1] * sy + axes[2] * half[2] * sz
        vertices.append(tuple(point))
    faces.extend(tuple(base + index for index in face) for face in BOX_FACES)


def create_rigid_detail(name, collection, armature, bone_name, vertices, faces, material, bevel):
    existing = bpy.data.objects.get(name)
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    mesh.materials.append(material)
    ensure_uv(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    skin_rigid(obj, armature, bone_name, bevel)
    obj['equipment_group'] = 'silhouette-detail'
    obj['silhouette_revision'] = 'production-form-v1'
    return obj


def refine_shoes(side, collection, armature):
    results = {}
    for label, sign, bone_name in (
        ('Left', 1.0, 'CC_Base_L_Foot'),
        ('Right', -1.0, 'CC_Base_R_Foot'),
    ):
        upper = bpy.data.objects.get(f'GS_{side}_Shoe_{label}_Upper')
        sole = bpy.data.objects.get(f'GS_{side}_Shoe_{label}_Sole')
        if upper is None or sole is None:
            raise RuntimeError(f'Missing {side} {label} shoe.')
        before = {'upper': local_bounds(upper), 'sole': local_bounds(sole)}
        accent = sole.data.materials[0]
        if len(upper.data.materials) < 2:
            upper.data.materials.append(accent)
        vertices, faces, material_indices = upper_geometry(sign)
        replace_mesh(upper, vertices, faces, armature, bone_name, 0.32, material_indices)
        vertices, faces = sole_geometry(sign)
        replace_mesh(sole, vertices, faces, armature, bone_name, 0.24)

        lace_vertices = []
        lace_faces = []
        for index, y in enumerate((-0.8, -3.6, -6.4, -9.2, -12.0)):
            progress = (5.2 - y) / 25.4
            center = Vector((sign * (7.65 + 1.4 * progress), y, 8.65 - 3.4 * progress))
            append_box(
                lace_vertices,
                lace_faces,
                center,
                (Vector((1.0, 0.0, 0.0)), Vector((0.0, 1.0, 0.0)), Vector((0.0, 0.0, 1.0))),
                (6.6 - index * 0.18, 0.72, 0.38),
            )
        laces = create_rigid_detail(
            f'GS_{side}_Shoe_{label}_Laces',
            collection,
            armature,
            bone_name,
            lace_vertices,
            lace_faces,
            accent,
            0.18,
        )
        results[label] = {
            'before': before,
            'after': {
                'upper': local_bounds(upper),
                'sole': local_bounds(sole),
                'laces': local_bounds(laces),
            },
            'upperVertices': len(upper.data.vertices),
            'soleVertices': len(sole.data.vertices),
            'laceVertices': len(laces.data.vertices),
        }
    return results


def hand_basis(bone):
    longitudinal = (bone.tail_local - bone.head_local).normalized()
    depth = Vector((0.0, 1.0, 0.0))
    depth -= longitudinal * depth.dot(longitudinal)
    depth.normalize()
    vertical = longitudinal.cross(depth).normalized()
    if vertical.z < 0.0:
        vertical.negate()
    return longitudinal, depth, vertical


def scale_mesh_in_basis(obj, anchor, axes, scales):
    before = local_bounds(obj)
    for vertex in obj.data.vertices:
        offset = vertex.co - anchor
        vertex.co = (
            anchor
            + axes[0] * offset.dot(axes[0]) * scales[0]
            + axes[1] * offset.dot(axes[1]) * scales[1]
            + axes[2] * offset.dot(axes[2]) * scales[2]
        )
    obj.data.update()
    obj['silhouette_revision'] = 'production-form-v1'
    return {'before': before, 'after': local_bounds(obj), 'scales': list(scales)}


def refine_gloves(side, collection, armature):
    results = {}
    for label, bone_name in (
        ('Left', 'CC_Base_L_Hand'),
        ('Right', 'CC_Base_R_Hand'),
    ):
        bone = armature.data.bones.get(bone_name)
        glove = bpy.data.objects.get(f'GS_{side}_Glove_{label}')
        cuff = bpy.data.objects.get(f'GS_{side}_Glove_{label}_Cuff')
        if bone is None or glove is None or cuff is None:
            raise RuntimeError(f'Missing {side} {label} glove rig.')
        axes = hand_basis(bone)
        glove_report = scale_mesh_in_basis(glove, bone.head_local, axes, (0.90, 0.80, 0.78))
        cuff_report = scale_mesh_in_basis(cuff, bone.head_local, axes, (1.12, 1.04, 1.04))

        guard_vertices = []
        guard_faces = []
        for index, factor in enumerate((0.25, 0.48, 0.70)):
            center = (
                bone.head_local
                + axes[0] * (bone.length * factor)
                - axes[1] * 4.8
                + axes[2] * 0.4
            )
            append_box(
                guard_vertices,
                guard_faces,
                center,
                axes,
                (2.0, 1.25, 7.6 - index * 0.35),
            )
        guard = create_rigid_detail(
            f'GS_{side}_Glove_{label}_Backhand_Guards',
            collection,
            armature,
            bone_name,
            guard_vertices,
            guard_faces,
            cuff.data.materials[0],
            0.32,
        )
        results[label] = {
            'glove': glove_report,
            'cuff': cuff_report,
            'guards': {
                'bounds': local_bounds(guard),
                'vertices': len(guard.data.vertices),
                'segments': 3,
            },
        }
    return results


def ellipsoid_geometry(center, radii, longitude_segments=20, latitude_segments=12):
    vertices = [(center.x, center.y, center.z + radii.z)]
    for latitude in range(1, latitude_segments):
        phi = math.pi * latitude / latitude_segments
        for longitude in range(longitude_segments):
            theta = math.tau * longitude / longitude_segments
            vertices.append((
                center.x + radii.x * math.sin(phi) * math.cos(theta),
                center.y + radii.y * math.sin(phi) * math.sin(theta),
                center.z + radii.z * math.cos(phi),
            ))
    bottom_index = len(vertices)
    vertices.append((center.x, center.y, center.z - radii.z))
    faces = []
    first_ring = 1
    for longitude in range(longitude_segments):
        next_longitude = (longitude + 1) % longitude_segments
        faces.append((0, first_ring + next_longitude, first_ring + longitude))
    for latitude in range(latitude_segments - 2):
        ring_start = 1 + latitude * longitude_segments
        next_start = ring_start + longitude_segments
        for longitude in range(longitude_segments):
            next_longitude = (longitude + 1) % longitude_segments
            faces.append((
                ring_start + longitude,
                ring_start + next_longitude,
                next_start + next_longitude,
                next_start + longitude,
            ))
    last_ring = 1 + (latitude_segments - 2) * longitude_segments
    for longitude in range(longitude_segments):
        next_longitude = (longitude + 1) % longitude_segments
        faces.append((last_ring + longitude, last_ring + next_longitude, bottom_index))
    return vertices, faces


def refine_helmet(side, collection, armature):
    stripe = bpy.data.objects.get(f'GS_{side}_Helmet_Center_Stripe')
    shell = bpy.data.objects.get(f'GS_{side}_Helmet_Shell')
    if stripe is None or shell is None:
        raise RuntimeError(f'Missing {side} open-face helmet.')
    stripe_before = local_bounds(stripe)
    for vertex in stripe.data.vertices:
        vertex.co.x *= 0.58
    stripe.data.update()
    stripe['silhouette_revision'] = 'narrow-center-stripe-v1'

    ear_cups = {}
    for label, sign in (('Left', 1.0), ('Right', -1.0)):
        vertices, faces = ellipsoid_geometry(
            Vector((sign * 9.75, 2.3, 169.0)),
            Vector((0.72, 2.45, 2.8)),
        )
        cup = create_rigid_detail(
            f'GS_{side}_Helmet_EarCup_{label}',
            collection,
            armature,
            'CC_Base_Head',
            vertices,
            faces,
            shell.data.materials[0],
            0.15,
        )
        ear_cups[label] = local_bounds(cup)
    shell['silhouette_revision'] = 'open-face-shell-with-ear-cups-v1'
    return {
        'shell': local_bounds(shell),
        'stripeBefore': stripe_before,
        'stripeAfter': local_bounds(stripe),
        'earCups': ear_cups,
        'cageObjectCount': len([obj for obj in bpy.data.objects if '_Helmet_Cage_' in obj.name]),
    }


def elliptical_band(center, outer, inner, height, segments=48):
    loops = []
    for z, radii in (
        (center.z - height * 0.5, outer),
        (center.z + height * 0.5, outer),
        (center.z - height * 0.5, inner),
        (center.z + height * 0.5, inner),
    ):
        loops.append([
            (
                center.x + math.cos(index * math.tau / segments) * radii.x,
                center.y + math.sin(index * math.tau / segments) * radii.y,
                z,
            )
            for index in range(segments)
        ])
    vertices = [vertex for loop in loops for vertex in loop]
    faces = []
    for index in range(segments):
        next_index = (index + 1) % segments
        outer_bottom = index
        outer_top = segments + index
        inner_bottom = segments * 2 + index
        inner_top = segments * 3 + index
        faces.extend((
            (outer_bottom, next_index, segments + next_index, outer_top),
            (inner_bottom, inner_top, segments * 3 + next_index, segments * 2 + next_index),
            (outer_top, segments + next_index, segments * 3 + next_index, inner_top),
            (outer_bottom, inner_bottom, segments * 2 + next_index, next_index),
        ))
    return vertices, faces


def create_wordmark_material(path):
    name = 'GS_PBR_GoonSquad_Wordmark'
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    texture = nodes.new('ShaderNodeTexImage')
    image = bpy.data.images.load(str(path), check_existing=True)
    image.pack()
    texture.image = image
    links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    links.new(texture.outputs['Alpha'], shader.inputs['Alpha'])
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    shader.inputs['Roughness'].default_value = 0.46
    if hasattr(material, 'surface_render_method'):
        material.surface_render_method = 'DITHERED'
    return material


def replace_front_wordmark(side, collection, armature, material):
    name = f'GS_{side}_Jersey_Front_Mark'
    existing = bpy.data.objects.get(name)
    if existing is None:
        raise RuntimeError(f'Missing existing {side} front mark.')
    before = local_bounds(existing)
    bpy.data.objects.remove(existing, do_unlink=True)
    width = 27.5
    height = 4.7
    y = -14.15
    z = 137.7
    vertices = (
        (-width * 0.5, y, z - height * 0.5),
        (width * 0.5, y, z - height * 0.5),
        (width * 0.5, y, z + height * 0.5),
        (-width * 0.5, y, z + height * 0.5),
    )
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], ((0, 1, 2, 3),))
    mesh.update()
    mesh.materials.append(material)
    uv = mesh.uv_layers.new(name='UVMap')
    for loop_index, coordinate in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[loop_index].uv = coordinate
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    skin_rigid(obj, armature, 'CC_Base_Spine02', 0.0)
    obj['equipment_group'] = 'uniform-mark'
    obj['silhouette_revision'] = 'licensed-wordmark-v1'
    return {'before': before, 'after': local_bounds(obj)}


def add_collar(side, collection, armature, material):
    vertices, faces = elliptical_band(
        Vector((0.0, 2.0, 156.9)),
        Vector((7.7, 5.8, 0.0)),
        Vector((6.5, 4.7, 0.0)),
        1.2,
    )
    collar = create_rigid_detail(
        f'GS_{side}_Jersey_Collar',
        collection,
        armature,
        'CC_Base_NeckTwist01',
        vertices,
        faces,
        material,
        0.18,
    )
    collar['equipment_group'] = 'jersey'
    return {'bounds': local_bounds(collar), 'vertices': len(collar.data.vertices)}


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    wordmark_path = Path(args.wordmark).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    if not wordmark_path.exists():
        raise RuntimeError(f'Missing wordmark: {wordmark_path}')
    source_workfile = bpy.data.filepath

    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing {ARMATURE_NAME}.')
    missing_actions = [name for name in REQUIRED_ACTIONS if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing actions: ' + ', '.join(missing_actions))
    action_counts_before = action_key_counts()
    wordmark_material = create_wordmark_material(wordmark_path)

    report_sides = {}
    for side in SIDES:
        collection = bpy.data.collections.get(f'GS_Equipment_{side}')
        if collection is None:
            raise RuntimeError(f'Missing {side} equipment collection.')
        sole_material = bpy.data.materials.get(
            'GS_PBR_Rubber_Red' if side == 'Home' else 'GS_PBR_Rubber_White'
        )
        collar_material = bpy.data.materials.get('GS_PBR_Fabric_Red')
        if sole_material is None or collar_material is None:
            raise RuntimeError(f'Missing {side} silhouette material.')
        report_sides[side.lower()] = {
            'shoes': refine_shoes(side, collection, armature),
            'gloves': refine_gloves(side, collection, armature),
            'helmet': refine_helmet(side, collection, armature),
            'wordmark': replace_front_wordmark(side, collection, armature, wordmark_material),
            'collar': add_collar(side, collection, armature, collar_material),
        }

    action_counts_after = action_key_counts()
    if action_counts_after != action_counts_before:
        raise RuntimeError('Silhouette authoring changed animation key counts.')

    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))
    report = {
        'status': 'silhouette-geometry-authored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'wordmark': str(wordmark_path),
        'sides': report_sides,
        'actionKeyCounts': {
            name: {'before': action_counts_before[name], 'after': action_counts_after[name]}
            for name in sorted(action_counts_before)
        },
        'reviewBoundary': (
            'The rebuilt silhouette remains private until front, side, rear, three-quarter, '
            'broadcast, deformation, grounding, runtime performance, and explicit human visual review pass.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_SILHOUETTE_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
