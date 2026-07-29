import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
CHEST_BONE = 'CC_Base_Spine02'


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def set_smooth(mesh):
    for polygon in mesh.polygons:
        polygon.use_smooth = True


def local_bounds(obj):
    minimum = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    maximum = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    return {
        'minimum': [round(value, 4) for value in minimum],
        'maximum': [round(value, 4) for value in maximum],
        'dimensions': [round(maximum[index] - minimum[index], 4) for index in range(3)],
    }


def add_armature_modifier(obj, armature):
    modifier = obj.modifiers.new('GS_Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_deform_preserve_volume = True


def copy_groups(source, target, index_map):
    target_groups = {
        group.index: target.vertex_groups.new(name=group.name)
        for group in source.vertex_groups
    }
    for old_index, new_index in index_map.items():
        for membership in source.data.vertices[old_index].groups:
            target_groups[membership.group].add([new_index], membership.weight, 'REPLACE')


def build_surface(source, name, predicate, transform, material, armature, offset=0.0):
    selected = []
    used_vertices = set()
    for polygon in source.data.polygons:
        coordinates = [source.data.vertices[index].co for index in polygon.vertices]
        if predicate(coordinates):
            selected.append(polygon)
            used_vertices.update(polygon.vertices)
    if not selected:
        raise RuntimeError(f'No faces selected for {name}.')

    old_indices = sorted(used_vertices)
    index_map = {old_index: new_index for new_index, old_index in enumerate(old_indices)}
    vertices = []
    for old_index in old_indices:
        source_vertex = source.data.vertices[old_index]
        coordinate = transform(source_vertex.co.copy())
        if offset:
            coordinate += source_vertex.normal * offset
        vertices.append(tuple(coordinate))
    faces = [[index_map[index] for index in polygon.vertices] for polygon in selected]

    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    collection = source.users_collection[0]
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    copy_groups(source, obj, index_map)
    add_armature_modifier(obj, armature)
    obj.data.materials.append(material)
    return obj


def replace_jersey(side, armature):
    name = f'GS_{side}_Jersey'
    source = bpy.data.objects.get(name)
    if source is None or source.type != 'MESH':
        raise RuntimeError(f'Missing source jersey: {name}')
    material = source.data.materials[0]
    before = local_bounds(source)

    def keep_torso(coordinates):
        return max(abs(coordinate.x) for coordinate in coordinates) <= 22.5

    def tailor(coordinate):
        return coordinate

    replacement = build_surface(
        source,
        f'{name}_Refined',
        keep_torso,
        tailor,
        material,
        armature,
    )
    smooth = replacement.modifiers.new('GS_ClothRelax', 'SMOOTH')
    smooth.factor = 0.22
    smooth.iterations = 2
    solidify = replacement.modifiers.new('GS_ClothThickness', 'SOLIDIFY')
    solidify.thickness = 0.18
    solidify.offset = 0.0
    solidify.use_rim = True
    replacement['equipment_group'] = 'jersey'
    replacement['uniform_refinement'] = 'fitted-torso-shell-v3'
    bpy.data.objects.remove(source, do_unlink=True)
    replacement.name = name
    replacement.data.name = f'{name}_Mesh'
    return replacement, before, local_bounds(replacement)


def ring_basis(axis):
    reference = Vector((0.0, 1.0, 0.0))
    if abs(axis.dot(reference)) > 0.95:
        reference = Vector((0.0, 0.0, 1.0))
    first = axis.cross(reference).normalized()
    second = axis.cross(first).normalized()
    return first, second


def build_weighted_frustum(
    name,
    start,
    end,
    start_radius,
    end_radius,
    armature,
    collection,
    material,
    start_weights,
    end_weights,
    segments=24,
):
    start = Vector(start)
    end = Vector(end)
    axis = (end - start).normalized()
    first, second = ring_basis(axis)
    vertices = []
    for center, radius in ((start, start_radius), (end, end_radius)):
        for index in range(segments):
            angle = math.tau * index / segments
            point = center + first * math.cos(angle) * radius + second * math.sin(angle) * radius
            vertices.append(tuple(point))
    faces = []
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.append((index, next_index, segments + next_index, segments + index))
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    obj.data.materials.append(material)
    groups = {}
    for bone_name in set(start_weights) | set(end_weights):
        groups[bone_name] = obj.vertex_groups.new(name=bone_name)
    for index in range(segments):
        for bone_name, weight in start_weights.items():
            groups[bone_name].add([index], weight, 'REPLACE')
        for bone_name, weight in end_weights.items():
            groups[bone_name].add([segments + index], weight, 'REPLACE')
    add_armature_modifier(obj, armature)
    solidify = obj.modifiers.new('GS_ClothThickness', 'SOLIDIFY')
    solidify.thickness = 0.18
    solidify.offset = 0.0
    solidify.use_rim = True
    return obj


def build_weighted_sleeve_loft(
    name,
    rings,
    armature,
    collection,
    material,
    segments=32,
):
    centers = [Vector(ring['center']) for ring in rings]
    axis = (centers[-1] - centers[0]).normalized()
    vertical, depth = ring_basis(axis)
    vertices = []
    for ring in rings:
        center = Vector(ring['center'])
        for index in range(segments):
            angle = math.tau * index / segments
            point = (
                center
                + vertical * math.cos(angle) * ring['vertical_radius']
                + depth * math.sin(angle) * ring['depth_radius']
            )
            vertices.append(tuple(point))
    faces = []
    for ring_index in range(len(rings) - 1):
        start = ring_index * segments
        end = (ring_index + 1) * segments
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.append((start + index, start + next_index, end + next_index, end + index))
    vertices.append(tuple(centers[0]))
    cap_index = len(vertices) - 1
    for index in range(segments):
        faces.append((cap_index, (index + 1) % segments, index))

    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    obj.data.materials.append(material)
    groups = {
        bone_name: obj.vertex_groups.new(name=bone_name)
        for bone_name in sorted({bone for ring in rings for bone in ring['weights']})
    }
    for ring_index, ring in enumerate(rings):
        for index in range(segments):
            vertex_index = ring_index * segments + index
            for bone_name, weight in ring['weights'].items():
                groups[bone_name].add([vertex_index], weight, 'REPLACE')
    for bone_name, weight in rings[0]['weights'].items():
        groups[bone_name].add([cap_index], weight, 'REPLACE')
    add_armature_modifier(obj, armature)
    smooth = obj.modifiers.new('GS_SleeveRelax', 'SMOOTH')
    smooth.factor = 0.14
    smooth.iterations = 2
    solidify = obj.modifiers.new('GS_ClothThickness', 'SOLIDIFY')
    solidify.thickness = 0.18
    solidify.offset = 0.0
    solidify.use_rim = True
    return obj


def replace_sleeves(side, jersey, armature, jersey_material, accent_material):
    for obj in list(bpy.data.objects):
        if obj.name.startswith(f'GS_{side}_Jersey_Sleeve'):
            bpy.data.objects.remove(obj, do_unlink=True)
    collection = jersey.users_collection[0]
    sleeves = []
    stripes = []
    for label in ('Left', 'Right'):
        prefix = 'L' if label == 'Left' else 'R'
        upperarm_name = f'CC_Base_{prefix}_Upperarm'
        upperarm_twist_01_name = f'CC_Base_{prefix}_UpperarmTwist01'
        upperarm_twist_02_name = f'CC_Base_{prefix}_UpperarmTwist02'
        forearm_twist_01_name = f'CC_Base_{prefix}_ForearmTwist01'
        forearm_twist_02_name = f'CC_Base_{prefix}_ForearmTwist02'
        clavicle_name = f'CC_Base_{prefix}_Clavicle'
        upperarm = armature.data.bones.get(upperarm_name)
        clavicle = armature.data.bones.get(clavicle_name)
        upperarm_twist_01 = armature.data.bones.get(upperarm_twist_01_name)
        upperarm_twist_02 = armature.data.bones.get(upperarm_twist_02_name)
        forearm_twist_01 = armature.data.bones.get(forearm_twist_01_name)
        forearm_twist_02 = armature.data.bones.get(forearm_twist_02_name)
        if any(bone is None for bone in (
            upperarm,
            clavicle,
            upperarm_twist_01,
            upperarm_twist_02,
            forearm_twist_01,
            forearm_twist_02,
        )):
            raise RuntimeError(f'Missing sleeve bones for {label}.')
        head = upperarm.head_local.copy()
        axis = (upperarm.tail_local - head).normalized()
        clavicle_axis = clavicle.tail_local - clavicle.head_local
        sleeve = build_weighted_sleeve_loft(
            f'GS_{side}_Jersey_Sleeve_{label}',
            [
                {
                    'center': clavicle.head_local + clavicle_axis * 0.58,
                    'vertical_radius': 6.25,
                    'depth_radius': 5.35,
                    'weights': {CHEST_BONE: 0.28, clavicle_name: 0.72},
                },
                {
                    'center': head + axis * (upperarm.length * 0.12),
                    'vertical_radius': 7.0,
                    'depth_radius': 6.1,
                    'weights': {clavicle_name: 0.48, upperarm_twist_01_name: 0.52},
                },
                {
                    'center': upperarm_twist_01.tail_local,
                    'vertical_radius': 6.15,
                    'depth_radius': 5.35,
                    'weights': {upperarm_twist_01_name: 0.72, upperarm_twist_02_name: 0.28},
                },
                {
                    'center': upperarm_twist_02.tail_local,
                    'vertical_radius': 4.65,
                    'depth_radius': 3.95,
                    'weights': {upperarm_twist_02_name: 0.68, forearm_twist_01_name: 0.32},
                },
                {
                    'center': forearm_twist_01.tail_local,
                    'vertical_radius': 4.15,
                    'depth_radius': 3.55,
                    'weights': {forearm_twist_01_name: 0.72, forearm_twist_02_name: 0.28},
                },
                {
                    'center': forearm_twist_02.head_local + (forearm_twist_02.tail_local - forearm_twist_02.head_local) * 0.9,
                    'vertical_radius': 3.55,
                    'depth_radius': 3.05,
                    'weights': {forearm_twist_02_name: 1.0},
                },
            ],
            armature,
            collection,
            accent_material,
        )
        sleeve['equipment_group'] = 'jersey'
        sleeve['uniform_refinement'] = 'fitted-long-sleeve-v4'
        sleeves.append(sleeve)

    return sleeves, stripes


def remove_uniform_marks(side):
    removed = []
    prefix = f'GS_{side}_Jersey_'
    for obj in list(bpy.data.objects):
        if obj.name == f'{prefix}Front_Mark' or obj.name.startswith(f'{prefix}Back_Number'):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    return removed


def add_text_mark(name, text, location, rotation, size, armature, collection, material, curve_offset=0.0):
    curve = bpy.data.curves.new(f'{name}_Curve', 'FONT')
    curve.body = text
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = size
    curve.offset = curve_offset
    curve.extrude = 0.10
    curve.bevel_depth = 0.025
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.rotation_euler = rotation
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    local_matrix = Matrix.Translation(Vector(location)) @ Euler(rotation, 'XYZ').to_matrix().to_4x4()
    world_matrix = armature.matrix_world @ local_matrix
    obj.parent = armature
    obj.parent_type = 'BONE'
    obj.parent_bone = CHEST_BONE
    obj.matrix_world = world_matrix
    obj['equipment_group'] = 'uniform-mark'
    obj['uniform_refinement'] = 'upper-spine-rigid-attachment-v2'
    return obj


def add_weighted_surface_text(name, text, center_z, source, armature, material, size=11.5):
    collection = source.users_collection[0]
    curve = bpy.data.curves.new(f'{name}_Curve', 'FONT')
    curve.body = text
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = size
    curve.extrude = 0.08
    curve.bevel_depth = 0.02
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)

    candidates = [vertex for vertex in source.data.vertices if vertex.co.y >= 16.0]
    if not candidates:
        raise RuntimeError(f'No back-surface vertices available for {name}.')
    groups = {
        group.index: obj.vertex_groups.new(name=group.name)
        for group in source.vertex_groups
    }
    anchor_vertices = [
        vertex
        for vertex in candidates
        if abs(vertex.co.x) <= 4.0 and 133.0 <= vertex.co.z <= 141.0
    ]
    if not anchor_vertices:
        raise RuntimeError(f'No upper-back weight anchors available for {name}.')
    averaged_weights = {}
    for anchor in anchor_vertices:
        for membership in anchor.groups:
            averaged_weights[membership.group] = (
                averaged_weights.get(membership.group, 0.0) + membership.weight
            )
    total_weight = sum(averaged_weights.values())
    averaged_weights = {
        group_index: weight / total_weight
        for group_index, weight in averaged_weights.items()
        if weight / total_weight >= 0.01
    }
    normalized_total = sum(averaged_weights.values())
    averaged_weights = {
        group_index: weight / normalized_total
        for group_index, weight in averaged_weights.items()
    }
    for vertex in obj.data.vertices:
        target_x = -vertex.co.x
        target_z = center_z + vertex.co.y
        depth = vertex.co.z
        nearest = min(
            candidates,
            key=lambda candidate: (candidate.co.x - target_x) ** 2 + (candidate.co.z - target_z) ** 2,
        )
        vertex.co = Vector((target_x, nearest.co.y + 0.5 + depth, target_z))
        for group_index, weight in averaged_weights.items():
            groups[group_index].add([vertex.index], weight, 'REPLACE')
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    add_armature_modifier(obj, armature)
    obj['equipment_group'] = 'uniform-mark'
    obj['uniform_refinement'] = 'weighted-jersey-surface-text-v2'
    return obj


def rebuild_marks(side, jersey, armature, material, accent_material):
    bounds = local_bounds(jersey)
    collection = jersey.users_collection[0]
    front_y = bounds['minimum'][1] - 0.35
    front = add_text_mark(
        f'GS_{side}_Jersey_Front_Mark',
        'GS',
        (0.0, front_y, 137.0),
        (math.pi / 2, 0.0, 0.0),
        10.5,
        armature,
        collection,
        material,
    )
    back = add_weighted_surface_text(
        f'GS_{side}_Jersey_Back_Number_17',
        '17',
        137.0,
        jersey,
        armature,
        accent_material,
    )
    return front, back, front_y


def main():
    args = parse_args()
    source_workfile = bpy.data.filepath
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing {ARMATURE_NAME}.')
    if armature.data.bones.get(CHEST_BONE) is None:
        raise RuntimeError(f'Missing {CHEST_BONE}.')

    armature.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    variants = {}
    for side in ('Home', 'Away'):
        old_stripe = bpy.data.objects.get(f'GS_{side}_Jersey_Sleeve_Stripes')
        old_front = bpy.data.objects.get(f'GS_{side}_Jersey_Front_Mark')
        if old_stripe is None or old_front is None:
            raise RuntimeError(f'Missing source uniform detail for {side}.')
        accent_material = old_stripe.data.materials[0]
        mark_material = old_front.data.materials[0]
        jersey, before, after = replace_jersey(side, armature)
        sleeves, stripes = replace_sleeves(
            side,
            jersey,
            armature,
            jersey.data.materials[0],
            accent_material,
        )
        removed_marks = remove_uniform_marks(side)
        front, back, front_y = rebuild_marks(
            side,
            jersey,
            armature,
            mark_material,
            accent_material,
        )
        variants[side.lower()] = {
            'jerseyBoundsBefore': before,
            'jerseyBoundsAfter': after,
            'restWidthReductionPercent': round((1.0 - after['dimensions'][0] / before['dimensions'][0]) * 100, 2),
            'restDepthReductionPercent': round((1.0 - after['dimensions'][1] / before['dimensions'][1]) * 100, 2),
            'sleeveObjects': [obj.name for obj in sleeves],
            'sleeveMaterials': [obj.data.materials[0].name for obj in sleeves],
            'stripeObjects': [obj.name for obj in stripes],
            'removedMarks': removed_marks,
            'frontMark': front.name,
            'frontOffsetFromClothCm': 0.35,
            'frontSurfaceY': front_y,
            'backNumber': back.name,
            'backNumberMethod': back.get('uniform_refinement'),
            'backOffsetFromClothCm': 0.5,
            'markBone': CHEST_BONE,
        }

    armature.data.pose_position = 'POSE'
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    report = {
        'status': 'refined-for-private-human-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_blend),
        'armature': ARMATURE_NAME,
        'chestBone': CHEST_BONE,
        'variants': variants,
        'actionNames': sorted(action.name for action in bpy.data.actions if action.name),
        'reviewRule': 'Close front, side, rear, three-quarter, runtime, and motion-contact review must pass before accepted-asset promotion.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_FIELD_PLAYER_UNIFORM_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
