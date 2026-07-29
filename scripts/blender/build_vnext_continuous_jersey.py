import argparse
import json
import math
import sys
from collections import Counter, deque
from pathlib import Path

import bpy
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
BODY_NAME = 'CC_Base_Body'


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def set_smooth(mesh):
    for polygon in mesh.polygons:
        polygon.use_smooth = True


def add_armature_modifier(obj, armature):
    modifier = obj.modifiers.new('GS_Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_deform_preserve_volume = True


def copy_groups(source, target, index_map):
    groups = {
        group.index: target.vertex_groups.new(name=group.name)
        for group in source.vertex_groups
    }
    for old_index, new_index in index_map.items():
        for membership in source.data.vertices[old_index].groups:
            groups[membership.group].add([new_index], membership.weight, 'REPLACE')


def local_bounds(obj):
    minimum = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    maximum = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    return {
        'minimum': [round(value, 4) for value in minimum],
        'maximum': [round(value, 4) for value in maximum],
        'dimensions': [round(maximum[index] - minimum[index], 4) for index in range(3)],
    }


def topology_summary(obj):
    mesh = obj.data
    edge_faces = Counter()
    adjacency = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        left, right = edge.vertices
        adjacency[left].append(right)
        adjacency[right].append(left)
    for polygon in mesh.polygons:
        vertices = list(polygon.vertices)
        for index, start in enumerate(vertices):
            end = vertices[(index + 1) % len(vertices)]
            edge_faces[tuple(sorted((start, end)))] += 1

    remaining = set(range(len(mesh.vertices)))
    components = 0
    while remaining:
        components += 1
        seed = remaining.pop()
        queue = deque([seed])
        while queue:
            current = queue.popleft()
            for neighbour in adjacency[current]:
                if neighbour in remaining:
                    remaining.remove(neighbour)
                    queue.append(neighbour)

    material_faces = Counter(
        obj.data.materials[polygon.material_index].name
        for polygon in mesh.polygons
    )
    return {
        'vertices': len(mesh.vertices),
        'faces': len(mesh.polygons),
        'connectedComponents': components,
        'boundaryEdges': sum(count == 1 for count in edge_faces.values()),
        'nonManifoldEdges': sum(count != 2 for count in edge_faces.values()),
        'unweightedVertices': sum(not vertex.groups for vertex in mesh.vertices),
        'materialFaces': dict(sorted(material_faces.items())),
        'bounds': local_bounds(obj),
    }


def garment_face(center):
    torso = 91.0 < center.z < 157.0 and abs(center.x) < 29.0
    arm = 111.0 < center.z < 152.0 and 17.0 < abs(center.x) < 67.0
    return torso or arm


def sleeve_face(center):
    raglan_boundary = 17.0 + max(0.0, (145.0 - center.z) * 0.28)
    return center.z > 111.0 and abs(center.x) >= raglan_boundary


def tailor_vertex(source_vertex):
    coordinate = source_vertex.co + source_vertex.normal * 1.35
    shoulder_blend = min(1.0, max(0.0, (abs(coordinate.x) - 18.0) / 12.0))

    torso = coordinate.copy()
    torso.x *= 1.055
    torso.y *= 1.10

    arm = coordinate.copy()
    arm_center_y = 6.25
    arm.y = arm_center_y + (arm.y - arm_center_y) * 1.075

    smooth_blend = shoulder_blend * shoulder_blend * (3.0 - 2.0 * shoulder_blend)
    return torso.lerp(arm, smooth_blend)


def build_continuous_jersey(side, body, armature, collection, torso_material, sleeve_material):
    name = f'GS_{side}_Jersey'
    selected = []
    used_vertices = set()
    material_indices = []
    for polygon in body.data.polygons:
        if not garment_face(polygon.center):
            continue
        selected.append(polygon)
        used_vertices.update(polygon.vertices)
        material_indices.append(1 if sleeve_face(polygon.center) else 0)
    if not selected:
        raise RuntimeError(f'No body faces selected for {name}.')

    old_indices = sorted(used_vertices)
    index_map = {old_index: new_index for new_index, old_index in enumerate(old_indices)}
    vertices = [tuple(tailor_vertex(body.data.vertices[index])) for index in old_indices]
    faces = [[index_map[index] for index in polygon.vertices] for polygon in selected]

    mesh = bpy.data.meshes.new(f'{name}_Continuous_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    copy_groups(body, obj, index_map)
    add_armature_modifier(obj, armature)
    obj.data.materials.append(torso_material)
    obj.data.materials.append(sleeve_material)
    for polygon, material_index in zip(obj.data.polygons, material_indices):
        polygon.material_index = material_index

    smooth = obj.modifiers.new('GS_ClothRelax', 'SMOOTH')
    smooth.factor = 0.16
    smooth.iterations = 2
    solidify = obj.modifiers.new('GS_ClothThickness', 'SOLIDIFY')
    solidify.thickness = 0.20
    solidify.offset = 0.0
    solidify.use_rim = True
    obj['equipment_group'] = 'jersey'
    obj['uniform_refinement'] = 'continuous-body-derived-garment-v1'
    obj['continuous_garment'] = True
    return obj


def remove_old_uniform(side):
    removed = []
    prefix = f'GS_{side}_Jersey'
    for obj in list(bpy.data.objects):
        if obj.name == prefix or obj.name.startswith(f'{prefix}_'):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    return sorted(removed)


def project_text_to_jersey(
    name,
    text,
    center_z,
    jersey,
    armature,
    material,
    surface,
    size,
    offset=0.48,
):
    collection = jersey.users_collection[0]
    curve = bpy.data.curves.new(f'{name}_Curve', 'FONT')
    curve.body = text
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = size
    curve.extrude = 0.06
    curve.bevel_depth = 0.015
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)

    if surface == 'front':
        candidates = [vertex for vertex in jersey.data.vertices if vertex.co.y < -8.0]
        x_direction = 1.0
        depth_direction = -1.0
    elif surface == 'back':
        candidates = [vertex for vertex in jersey.data.vertices if vertex.co.y > 8.0]
        x_direction = -1.0
        depth_direction = 1.0
    else:
        raise ValueError(surface)
    if not candidates:
        raise RuntimeError(f'No {surface} cloth vertices available for {name}.')

    groups = {
        group.index: obj.vertex_groups.new(name=group.name)
        for group in jersey.vertex_groups
    }
    for vertex in obj.data.vertices:
        target_x = vertex.co.x * x_direction
        target_z = center_z + vertex.co.y
        depth = vertex.co.z
        nearest = min(
            candidates,
            key=lambda candidate: (
                (candidate.co.x - target_x) ** 2
                + (candidate.co.z - target_z) ** 2
            ),
        )
        vertex.co = Vector((
            target_x,
            nearest.co.y + depth_direction * (offset + depth),
            target_z,
        ))
        memberships = [
            (membership.group, membership.weight)
            for membership in nearest.groups
            if membership.weight >= 0.005
        ]
        total = sum(weight for _, weight in memberships)
        if total <= 0.0:
            raise RuntimeError(f'No cloth weights available for {name}.')
        for group_index, weight in memberships:
            groups[group_index].add([vertex.index], weight / total, 'REPLACE')

    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    add_armature_modifier(obj, armature)
    obj['equipment_group'] = 'uniform-mark'
    obj['uniform_refinement'] = f'cloth-projected-{surface}-text-v1'
    return obj


def main():
    args = parse_args()
    source_workfile = bpy.data.filepath
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get(ARMATURE_NAME)
    body = bpy.data.objects.get(BODY_NAME)
    if armature is None or body is None:
        raise RuntimeError('The private athlete source is incomplete.')

    armature.data.pose_position = 'REST'
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    variants = {}
    for side in ('Home', 'Away'):
        collection = bpy.data.collections.get(f'GS_Equipment_{side}')
        old_jersey = bpy.data.objects.get(f'GS_{side}_Jersey')
        old_sleeve = bpy.data.objects.get(f'GS_{side}_Jersey_Sleeve_Left')
        old_front = bpy.data.objects.get(f'GS_{side}_Jersey_Front_Mark')
        old_back = bpy.data.objects.get(f'GS_{side}_Jersey_Back_Number_17')
        if any(item is None for item in (collection, old_jersey, old_sleeve, old_front, old_back)):
            raise RuntimeError(f'The {side} source uniform is incomplete.')

        torso_material = old_jersey.data.materials[0]
        sleeve_material = old_sleeve.data.materials[0]
        front_material = old_front.data.materials[0]
        back_material = old_back.data.materials[0]
        removed = remove_old_uniform(side)
        jersey = build_continuous_jersey(
            side,
            body,
            armature,
            collection,
            torso_material,
            sleeve_material,
        )
        front = project_text_to_jersey(
            f'GS_{side}_Jersey_Front_Mark',
            'GS',
            137.0,
            jersey,
            armature,
            front_material,
            'front',
            10.5,
        )
        back = project_text_to_jersey(
            f'GS_{side}_Jersey_Back_Number_17',
            '17',
            137.0,
            jersey,
            armature,
            back_material,
            'back',
            11.5,
        )
        variants[side.lower()] = {
            'garment': jersey.name,
            'garmentMethod': jersey.get('uniform_refinement'),
            'continuousGarment': jersey.get('continuous_garment'),
            'separateSleeveObjects': [],
            'removedObjects': removed,
            'frontMark': front.name,
            'frontMarkMethod': front.get('uniform_refinement'),
            'backNumber': back.name,
            'backNumberMethod': back.get('uniform_refinement'),
            'topology': topology_summary(jersey),
        }

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = bpy.data.actions.get('jog-to-sprint-ik')
    bpy.context.scene.frame_set(4)
    bpy.context.view_layer.update()
    bpy.context.scene['vnext_uniform_status'] = 'continuous-private-human-review'
    bpy.context.scene['vnext_uniform_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    report = {
        'status': 'continuous-garment-built-for-private-human-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_blend),
        'armature': ARMATURE_NAME,
        'bodyWeightSource': BODY_NAME,
        'variants': variants,
        'actionNames': sorted(action.name for action in bpy.data.actions if action.name),
        'reviewRule': (
            'The one-piece garments require close shoulder, cuff, hem, mark, deformation, '
            'and private runtime review before any asset promotion.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CONTINUOUS_JERSEY_BUILT ' + str(output_report))


if __name__ == '__main__':
    main()
