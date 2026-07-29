import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


REQUIRED_ACTIONS = {
    'ready': 1,
    'jog': 17,
    'jog-to-sprint-ik': 4,
    'sprint': 15,
    'turn': 16,
    'stop': 16,
    'receive': 16,
    'pass': 16,
    'shot': 20,
}
REQUIRED_PARTS = (
    '',
    '_Cuff',
    '_Cuff_Roll',
    '_Backhand_Pads',
    '_Palm_Overlay',
    '_Finger_Rolls',
    '_Finger_Pads',
    '_Flex_Thumb',
    '_Thumb_Pads',
)
FINGER_TOKENS = ('Index', 'Mid', 'Ring', 'Pinky', 'Thumb')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--refinement-report', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def action_fcurves(action):
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


def evaluated_world_vertices(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        return [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    finally:
        evaluated.to_mesh_clear()


def distance_to_segment(point, start, end):
    axis = end - start
    length_squared = axis.length_squared
    if length_squared <= 1e-12:
        return (point - start).length
    factor = max(0.0, min(1.0, (point - start).dot(axis) / length_squared))
    return (point - (start + axis * factor)).length


def shaft_segment(target_object, armature):
    target_vertices = evaluated_world_vertices(target_object)
    control = armature.pose.bones.get('GS_Stick_Control')
    if control is None:
        raise RuntimeError('Missing GS_Stick_Control for shaft-axis measurement.')
    head = armature.matrix_world @ control.head
    tail = armature.matrix_world @ control.tail
    direction = (tail - head).normalized()
    origin = sum(target_vertices, Vector()) / len(target_vertices)
    projections = [(vertex - origin).dot(direction) for vertex in target_vertices]
    start = origin + direction * min(projections)
    end = origin + direction * max(projections)
    radii = sorted(distance_to_segment(vertex, start, end) for vertex in target_vertices)
    radius = radii[len(radii) // 2]
    return start, end, radius


def nearest_distances_mm(source_objects, target_object, armature):
    start, end, radius = shaft_segment(target_object, armature)
    distances = []
    for obj in source_objects:
        for vertex in evaluated_world_vertices(obj):
            centerline_distance = distance_to_segment(vertex, start, end)
            distances.append(abs(centerline_distance - radius) * 1000.0)
    distances.sort()
    if not distances:
        raise RuntimeError('No evaluated glove vertices were available for shaft contact audit.')
    percentile_index = min(len(distances) - 1, max(0, math.ceil(len(distances) * 0.01) - 1))
    return {
        'minimumMm': round(distances[0], 3),
        'p01Mm': round(distances[percentile_index], 3),
        'verticesWithin10Mm': sum(distance <= 10.0 for distance in distances),
        'verticesWithin20Mm': sum(distance <= 20.0 for distance in distances),
        'sampleCount': len(distances),
        'shaftRadiusMm': round(radius * 1000.0, 3),
    }


def mesh_record(obj):
    return {
        'vertices': len(obj.data.vertices),
        'polygons': len(obj.data.polygons),
        'uvLayers': [layer.name for layer in obj.data.uv_layers],
        'materials': [material.name for material in obj.data.materials if material],
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
        'unweightedVertices': sum(not vertex.groups for vertex in obj.data.vertices),
        'armatureModifiers': [
            modifier.object.name if modifier.object else None
            for modifier in obj.modifiers
            if modifier.type == 'ARMATURE'
        ],
        'gloveDetailRevision': obj.get('glove_detail_revision'),
    }


def main():
    args = parse_args()
    refinement_path = Path(args.refinement_report).resolve()
    output_path = Path(args.output_report).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    refinement = json.loads(refinement_path.read_text(encoding='utf-8'))
    if refinement.get('status') != 'private-segmented-glove-authored':
        raise RuntimeError('The glove refinement report is not an authored private candidate.')

    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    shaft = bpy.data.objects.get('GS_Home_Stick_Shaft')
    if armature is None or shaft is None:
        raise RuntimeError('The glove audit is missing the field-player rig or home stick shaft.')

    assemblies = {}
    all_objects = {}
    missing_parts = []
    for variant in ('Home', 'Away'):
        assemblies[variant.lower()] = {}
        for label in ('Left', 'Right'):
            prefix = f'GS_{variant}_Glove_{label}'
            names = [prefix + suffix for suffix in REQUIRED_PARTS]
            objects = []
            for name in names:
                obj = bpy.data.objects.get(name)
                if obj is None:
                    missing_parts.append(name)
                    continue
                objects.append(obj)
                all_objects[name] = mesh_record(obj)
            assemblies[variant.lower()][label.lower()] = {
                'partCount': len(objects),
                'parts': [obj.name for obj in objects],
            }
    if missing_parts:
        raise RuntimeError(f'Missing segmented glove parts: {missing_parts}')

    invalid_meshes = [
        name for name, record in all_objects.items()
        if record['unweightedVertices']
        or not record['uvLayers']
        or not record['materials']
        or record['armatureModifiers'] != ['GS_FieldPlayer_Rig']
        or record['gloveDetailRevision'] != 'segmented-closed-grip-v2'
    ]
    if invalid_meshes:
        raise RuntimeError(f'Invalid glove mesh contract: {invalid_meshes}')

    actions = {}
    contact = {}
    armature.animation_data_create()
    for action_name, frame in REQUIRED_ACTIONS.items():
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f'Missing required action: {action_name}')
        finger_curves = [
            fcurve for fcurve in action_fcurves(action)
            if any(token in fcurve.data_path for token in FINGER_TOKENS)
        ]
        actions[action_name] = {
            'fingerFcurveCount': len(finger_curves),
            'fingerKeyCount': sum(len(fcurve.keyframe_points) for fcurve in finger_curves),
            'gripRevision': action.get('glove_grip_revision'),
        }
        if len(finger_curves) < 120 or action.get('glove_grip_revision') != 'segmented-closed-flex-v2':
            raise RuntimeError(f'Action {action_name} does not contain the complete keyed glove grip.')

        armature.animation_data.action = action
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        contact[action_name] = {}
        for label in ('Left', 'Right'):
            prefix = f'GS_Home_Glove_{label}'
            contact_objects = [
                bpy.data.objects[f'{prefix}_Finger_Rolls'],
                bpy.data.objects[f'{prefix}_Flex_Thumb'],
                bpy.data.objects[f'{prefix}_Palm_Overlay'],
            ]
            contact[action_name][label.lower()] = nearest_distances_mm(
                contact_objects,
                shaft,
                armature,
            )

    maximum_minimum_distance = max(
        hand['minimumMm']
        for action in contact.values()
        for hand in action.values()
    )
    contact_samples_within_20 = min(
        hand['verticesWithin20Mm']
        for action in contact.values()
        for hand in action.values()
    )
    report = {
        'status': 'private-segmented-glove-audited',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': bpy.data.filepath,
        'refinementReport': str(refinement_path),
        'assemblies': assemblies,
        'objects': all_objects,
        'actions': actions,
        'shaftContact': contact,
        'maximumMinimumShaftDistanceMm': round(maximum_minimum_distance, 3),
        'minimumVerticesWithin20Mm': contact_samples_within_20,
        'contract': {
            'partsPerHand': 9,
            'fingerFcurvesPerAction': 120,
            'maximumMinimumShaftDistanceMm': 12.0,
            'minimumVerticesWithin20Mm': 4,
        },
        'automatedContactPass': (
            maximum_minimum_distance <= 12.0
            and contact_samples_within_20 >= 4
        ),
        'reviewRule': (
            'Automated shaft distance only proves proximity. Close and moving human review must '
            'still approve finger volume, grip wrap, cuff clearance, and action continuity.'
        ),
    }
    output_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    if not report['automatedContactPass']:
        raise RuntimeError(
            'Segmented glove shaft contact failed: '
            f'max minimum {maximum_minimum_distance:.3f} mm, '
            f'min nearby vertices {contact_samples_within_20}.'
        )
    print('GOON_VNEXT_GLOVE_DETAIL_AUDITED ' + str(output_path))


if __name__ == '__main__':
    main()
