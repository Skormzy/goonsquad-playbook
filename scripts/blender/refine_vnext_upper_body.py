import argparse
import json
import math
import sys
from collections import Counter, deque
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
REVIEW_ACTION = 'jog-to-sprint-ik'
REVIEW_FRAME = 4


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def round_vector(vector):
    return [round(value, 4) for value in vector]


def local_bounds(obj):
    minimum = Vector((min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    return {
        'minimum': round_vector(minimum),
        'maximum': round_vector(maximum),
        'dimensions': round_vector(maximum - minimum),
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
    return {
        'vertices': len(mesh.vertices),
        'faces': len(mesh.polygons),
        'connectedComponents': components,
        'boundaryEdges': sum(count == 1 for count in edge_faces.values()),
        'nonManifoldEdges': sum(count != 2 for count in edge_faces.values()),
        'unweightedVertices': sum(not vertex.groups for vertex in mesh.vertices),
        'bounds': local_bounds(obj),
    }


def arm_chain(armature, prefix):
    names = (
        f'CC_Base_{prefix}_Upperarm',
        f'CC_Base_{prefix}_UpperarmTwist01',
        f'CC_Base_{prefix}_UpperarmTwist02',
        f'CC_Base_{prefix}_ForearmTwist01',
        f'CC_Base_{prefix}_ForearmTwist02',
    )
    bones = {name: armature.data.bones.get(name) for name in names}
    if any(bone is None for bone in bones.values()):
        raise RuntimeError(f'Missing arm chain for {prefix}.')
    clavicle_name = f'CC_Base_{prefix}_Clavicle'
    return {
        'points': [
            bones[names[0]].head_local.copy(),
            bones[names[1]].tail_local.copy(),
            bones[names[2]].tail_local.copy(),
            bones[names[3]].tail_local.copy(),
            bones[names[4]].tail_local.copy(),
        ],
        'weights': [
            {clavicle_name: 0.35, names[1]: 0.65},
            {names[1]: 0.68, names[2]: 0.32},
            {names[2]: 0.68, names[3]: 0.32},
            {names[3]: 0.70, names[4]: 0.30},
            {names[4]: 1.0},
        ],
        'profileVerticalRadii': [4.8, 4.5, 4.2, 3.9, 3.6],
        'profileDepthRadii': [4.2, 3.9, 3.7, 3.4, 3.1],
    }


def closest_chain_sample(coordinate, chain):
    best = None
    points = chain['points']
    for segment_index in range(len(points) - 1):
        start = points[segment_index]
        end = points[segment_index + 1]
        segment = end - start
        length_squared = segment.length_squared
        factor = 0.0 if length_squared <= 1e-8 else (coordinate - start).dot(segment) / length_squared
        factor = max(0.0, min(1.0, factor))
        point = start + segment * factor
        distance = (coordinate - point).length
        if best is None or distance < best['distance']:
            best = {
                'distance': distance,
                'segment': segment_index,
                'factor': factor,
                'point': point,
                'tangent': segment.normalized(),
            }
    return best


def interpolate_number(values, segment, factor):
    return values[segment] * (1.0 - factor) + values[segment + 1] * factor


def interpolate_weights(weight_maps, segment, factor):
    combined = Counter()
    for name, weight in weight_maps[segment].items():
        combined[name] += weight * (1.0 - factor)
    for name, weight in weight_maps[segment + 1].items():
        combined[name] += weight * factor
    total = sum(combined.values())
    return {name: weight / total for name, weight in combined.items() if weight > 1e-6}


def vertex_weights(obj, vertex):
    return {
        obj.vertex_groups[membership.group].name: membership.weight
        for membership in vertex.groups
        if membership.weight > 1e-6
    }


def assign_weights(obj, vertex_index, weights):
    for group in obj.vertex_groups:
        group.remove([vertex_index])
    for name, weight in weights.items():
        group = obj.vertex_groups.get(name)
        if group is None:
            group = obj.vertex_groups.new(name=name)
        group.add([vertex_index], weight, 'REPLACE')


def blend_weights(original, target, factor):
    combined = Counter()
    for name, weight in original.items():
        combined[name] += weight * (1.0 - factor)
    for name, weight in target.items():
        combined[name] += weight * factor
    total = sum(combined.values())
    if total <= 1e-8:
        return target
    return {name: weight / total for name, weight in combined.items() if weight > 0.001}


def sleeve_vertices(obj):
    indices = set()
    for polygon in obj.data.polygons:
        center = polygon.center
        if 108.0 < center.z < 154.0 and abs(center.x) > 15.0:
            indices.update(polygon.vertices)
    return indices


def refine_sleeve_material_boundary(obj):
    torso_material_index = next(
        index
        for index, material in enumerate(obj.data.materials)
        if material and not material.name.endswith('Accent_Red')
    )
    sleeve_material_index = next(
        index
        for index, material in enumerate(obj.data.materials)
        if material and material.name.endswith('Accent_Red')
    )
    changed = 0
    for polygon in obj.data.polygons:
        center = polygon.center
        arm_distance = abs(center.x)
        red_sleeve = 110.0 < center.z < 149.0 and arm_distance >= 31.5
        target_index = sleeve_material_index if red_sleeve else torso_material_index
        if polygon.material_index != target_index:
            polygon.material_index = target_index
            changed += 1
    obj.data.update()
    obj['uniform_color_block'] = 'shoulder-yoke-with-fitted-sleeve-v1'
    return {
        'method': obj.get('uniform_color_block'),
        'changedFaces': changed,
        'sleeveStartFromCenterCm': 31.5,
    }


def covered_body_face(center):
    torso = 88.0 < center.z < 158.5 and abs(center.x) < 30.0
    arm = 110.0 < center.z < 153.0 and 16.0 < abs(center.x) < 66.5
    return torso or arm


def mask_body_under_uniform(body):
    before_faces = len(body.data.polygons)
    mesh = bmesh.new()
    mesh.from_mesh(body.data)
    covered = [face for face in mesh.faces if covered_body_face(face.calc_center_median())]
    bmesh.ops.delete(mesh, geom=covered, context='FACES')
    mesh.to_mesh(body.data)
    mesh.free()
    body.data.update()
    body['uniform_body_mask'] = 'jersey-covered-faces-v1'
    return {
        'method': body.get('uniform_body_mask'),
        'facesBefore': before_faces,
        'facesAfter': len(body.data.polygons),
        'facesRemoved': before_faces - len(body.data.polygons),
    }


def shape_and_reweight_jersey(obj, armature):
    chains = {
        'L': arm_chain(armature, 'L'),
        'R': arm_chain(armature, 'R'),
    }
    indices = sleeve_vertices(obj)
    moved = 0
    maximum_shift = 0.0
    radius_before = []
    radius_after = []
    pending_weights = {}
    for index in sorted(indices):
        vertex = obj.data.vertices[index]
        prefix = 'L' if vertex.co.x >= 0.0 else 'R'
        chain = chains[prefix]
        sample = closest_chain_sample(vertex.co, chain)
        if sample['distance'] > 12.0:
            continue
        radial = vertex.co - sample['point']
        radial -= sample['tangent'] * radial.dot(sample['tangent'])
        if radial.length <= 1e-5:
            continue
        target_vertical_radius = interpolate_number(
            chain['profileVerticalRadii'],
            sample['segment'],
            sample['factor'],
        )
        target_depth_radius = interpolate_number(
            chain['profileDepthRadii'],
            sample['segment'],
            sample['factor'],
        )
        shoulder_factor = smoothstep((abs(vertex.co.x) - 10.0) / 12.0)
        depth_axis = Vector((0.0, 1.0, 0.0))
        depth_axis -= sample['tangent'] * depth_axis.dot(sample['tangent'])
        depth_axis.normalize()
        vertical_axis = sample['tangent'].cross(depth_axis).normalized()
        angle = math.atan2(radial.dot(vertical_axis), radial.dot(depth_axis))
        target_radial = (
            depth_axis * math.cos(angle) * target_depth_radius
            + vertical_axis * math.sin(angle) * target_vertical_radius
        )
        target = sample['point'] + target_radial
        updated = vertex.co.lerp(target, shoulder_factor)
        shift = (updated - vertex.co).length
        radius_before.append(radial.length)
        updated_radial = updated - sample['point']
        updated_radial -= sample['tangent'] * updated_radial.dot(sample['tangent'])
        radius_after.append(updated_radial.length)
        vertex.co = updated
        if shift > 1e-5:
            moved += 1
            maximum_shift = max(maximum_shift, shift)
        target_weights = interpolate_weights(
            chain['weights'],
            sample['segment'],
            sample['factor'],
        )
        pending_weights[index] = blend_weights(
            vertex_weights(obj, vertex),
            target_weights,
            shoulder_factor,
        )
    for index, weights in pending_weights.items():
        assign_weights(obj, index, weights)
    obj.data.update()
    for modifier in obj.modifiers:
        if modifier.type == 'SMOOTH':
            modifier.factor = 0.08
            modifier.iterations = 1
    obj['uniform_refinement'] = 'continuous-arm-axis-tailored-v2'
    obj['upper_body_refinement'] = 'explicit-arm-chain-weights-v1'
    return {
        'sleeveVertices': len(indices),
        'movedVertices': moved,
        'maximumRestShiftCm': round(maximum_shift, 4),
        'maximumRadiusBeforeCm': round(max(radius_before), 4),
        'maximumRadiusAfterCm': round(max(radius_after), 4),
        'materialBoundary': refine_sleeve_material_boundary(obj),
        'topology': topology_summary(obj),
    }


def move_cages(side):
    moved = []
    for obj in bpy.data.objects:
        if not obj.name.startswith(f'GS_{side}_Helmet_Cage_') or obj.type != 'MESH':
            continue
        before = local_bounds(obj)
        for vertex in obj.data.vertices:
            vertex.co.y += 13.0
        obj.data.update()
        obj['helmet_refinement'] = 'face-fitted-cage-v2'
        moved.append({
            'name': obj.name,
            'localForwardShiftCm': 13.0,
            'before': before,
            'after': local_bounds(obj),
        })
    if len(moved) != 6:
        raise RuntimeError(f'Expected six {side} cage segments, found {len(moved)}.')
    return moved


def main():
    args = parse_args()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    source_workfile = bpy.data.filepath
    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing armature: {ARMATURE_NAME}')
    armature.data.pose_position = 'REST'
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()

    body = bpy.data.objects.get('CC_Base_Body')
    if body is None:
        raise RuntimeError('Missing licensed body mesh.')
    body_mask = mask_body_under_uniform(body)

    variants = {}
    for side in ('Home', 'Away'):
        jersey = bpy.data.objects.get(f'GS_{side}_Jersey')
        if jersey is None:
            raise RuntimeError(f'Missing {side} jersey.')
        variants[side.lower()] = {
            'jersey': shape_and_reweight_jersey(jersey, armature),
            'helmetCage': move_cages(side),
        }

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = bpy.data.actions.get(REVIEW_ACTION)
    bpy.context.scene.frame_set(REVIEW_FRAME)
    bpy.context.view_layer.update()
    bpy.context.scene['vnext_upper_body_status'] = 'private-human-review'
    bpy.context.scene['vnext_upper_body_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    report = {
        'status': 'refined-for-private-human-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_blend),
        'armature': ARMATURE_NAME,
        'reviewAction': REVIEW_ACTION,
        'reviewFrame': REVIEW_FRAME,
        'bodyMask': body_mask,
        'variants': variants,
        'motionActionsChanged': [],
        'handOrStickTransformsChanged': False,
        'reviewRule': (
            'The shaped sleeve, explicit arm weights, fitted cage, every field-player action, '
            'and private runtime require close human review before promotion.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_UPPER_BODY_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
