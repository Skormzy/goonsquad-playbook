import argparse
import importlib.util
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
AUTHOR_PATH = SCRIPT_DIR / 'refine_vnext_production_glove_articulation.py'
AUTHOR_SPEC = importlib.util.spec_from_file_location('vnext_glove_articulation_author', AUTHOR_PATH)
author = importlib.util.module_from_spec(AUTHOR_SPEC)
AUTHOR_SPEC.loader.exec_module(author)

ACTION_FRAMES = {
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


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--author-report', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def weight_metrics(obj):
    unweighted = 0
    maximum_error = 0.0
    for vertex in obj.data.vertices:
        total = sum(group.weight for group in vertex.groups)
        if total <= 1e-8:
            unweighted += 1
        maximum_error = max(maximum_error, abs(1.0 - total))
    return {
        'unweightedVertices': unweighted,
        'maximumWeightSumError': round(maximum_error, 7),
    }


def glove_objects(variant, side_label):
    prefix = f'GS_{variant}_Glove_{side_label}_'
    return [
        obj
        for obj in bpy.data.objects
        if obj.type == 'MESH'
        and obj.name.startswith(prefix)
        and (
            obj.get('production_glove_fit_revision') == author.FIT_REVISION
            or obj.get('production_glove_finish_revision') == author.FINISH_REVISION
            or obj.get('production_glove_articulation_revision') == author.ARTICULATION_REVISION
        )
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
    amount = max(0.0, min(1.0, (point - start).dot(axis) / length_squared))
    return (point - (start + axis * amount)).length


def shaft_segment(shaft, armature):
    vertices = evaluated_world_vertices(shaft)
    control = armature.pose.bones.get('GS_Stick_Control')
    if control is None:
        raise RuntimeError('Missing stick control for palm-channel audit.')
    head = armature.matrix_world @ control.head
    tail = armature.matrix_world @ control.tail
    direction = (tail - head).normalized()
    origin = sum(vertices, Vector()) / len(vertices)
    projections = [(vertex - origin).dot(direction) for vertex in vertices]
    start = origin + direction * min(projections)
    end = origin + direction * max(projections)
    radii = sorted(distance_to_segment(vertex, start, end) for vertex in vertices)
    return start, end, radii[len(radii) // 2]


def shaft_clearance_mm(obj, shaft, armature):
    start, end, radius = shaft_segment(shaft, armature)
    signed = [
        (distance_to_segment(vertex, start, end) - radius) * 1000.0
        for vertex in evaluated_world_vertices(obj)
    ]
    absolute = sorted(abs(value) for value in signed)
    percentile = absolute[min(len(absolute) - 1, math.ceil(len(absolute) * 0.02) - 1)]
    return {
        'minimumSignedMm': round(min(signed), 3),
        'minimumAbsoluteMm': round(absolute[0], 3),
        'p02AbsoluteMm': round(percentile, 3),
        'verticesWithin10Mm': sum(value <= 10.0 for value in absolute),
        'verticesWithin20Mm': sum(value <= 20.0 for value in absolute),
        'sampleCount': len(absolute),
        'shaftRadiusMm': round(radius * 1000.0, 3),
    }


def main():
    args = parse_args()
    author_report_path = Path(args.author_report).resolve()
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)
    author_report = json.loads(author_report_path.read_text(encoding='utf-8'))
    if author_report.get('status') != 'private-production-glove-articulation-authored':
        raise RuntimeError('The articulation author report is not a private authored candidate.')

    armature = bpy.data.objects.get(author.ARMATURE_NAME)
    shaft = bpy.data.objects.get('GS_Home_Stick_Shaft')
    if armature is None or shaft is None:
        raise RuntimeError('The articulation audit is missing the rig or home stick shaft.')
    armature.animation_data_create()

    inventories = {}
    topology = {}
    unweighted = 0
    maximum_weight_error = 0.0
    for variant in author.VARIANTS:
        inventories[variant.lower()] = {}
        for side_label, side_token in author.SIDES:
            objects = glove_objects(variant, side_label)
            armor_name = (
                f'GS_{variant}_Glove_{side_label}_Production_Articulated_Finger_Armor'
            )
            palm_name = (
                f'GS_{variant}_Glove_{side_label}_Production_Layered_Palm_Channel'
            )
            armor = bpy.data.objects.get(armor_name)
            palm = bpy.data.objects.get(palm_name)
            if armor is None or palm is None:
                raise RuntimeError(f'Missing articulated glove objects for {variant} {side_label}.')
            inherited_pads = [
                obj.name
                for obj in objects
                if remainders_old_pad(obj.name)
            ]
            metrics = [weight_metrics(obj) for obj in objects]
            unweighted += sum(item['unweightedVertices'] for item in metrics)
            maximum_weight_error = max(
                maximum_weight_error,
                *(item['maximumWeightSumError'] for item in metrics),
            )
            inventories[variant.lower()][side_label.lower()] = {
                'objectCount': len(objects),
                'retainedFittedObjectCount': sum(
                    obj.get('production_glove_fit_revision') == author.FIT_REVISION
                    for obj in objects
                ),
                'articulatedObjectCount': sum(
                    obj.get('production_glove_articulation_revision')
                    == author.ARTICULATION_REVISION
                    for obj in objects
                ),
                'uvReadyObjects': sum(bool(obj.data.uv_layers) for obj in objects),
                'inheritedFingerPadObjects': inherited_pads,
                'objects': sorted(obj.name for obj in objects),
            }
            topology[f'{variant.lower()}-{side_label.lower()}'] = {
                'armorVertices': len(armor.data.vertices),
                'armorPolygons': len(armor.data.polygons),
                'armorComponents': armor.get('component_count'),
                'armorVertexGroups': sorted(group.name for group in armor.vertex_groups),
                'armorMaterialSlots': [
                    material.name for material in armor.data.materials if material
                ],
                'palmVertices': len(palm.data.vertices),
                'palmPolygons': len(palm.data.polygons),
                'palmComponents': palm.get('component_count'),
                'palmVertexGroups': sorted(group.name for group in palm.vertex_groups),
                'palmMaterialSlots': [
                    material.name for material in palm.data.materials if material
                ],
                'sideToken': side_token,
            }

    contact_by_action = {}
    for action_name, frame in ACTION_FRAMES.items():
        action_value = bpy.data.actions.get(action_name)
        if action_value is None:
            raise RuntimeError(f'Missing review action: {action_name}')
        armature.animation_data.action = action_value
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        contact_by_action[action_name] = {}
        for side_label, _ in author.SIDES:
            palm = bpy.data.objects[
                f'GS_Home_Glove_{side_label}_Production_Layered_Palm_Channel'
            ]
            contact_by_action[action_name][side_label.lower()] = shaft_clearance_mm(
                palm,
                shaft,
                armature,
            )

    contact_records = [
        record
        for action in contact_by_action.values()
        for record in action.values()
    ]
    maximum_minimum_absolute = max(record['minimumAbsoluteMm'] for record in contact_records)
    minimum_nearby_vertices = min(record['verticesWithin20Mm'] for record in contact_records)
    minimum_signed_clearance = min(record['minimumSignedMm'] for record in contact_records)

    checks = {
        'fourCompleteArticulatedFits': all(
            side['objectCount'] == 22
            and side['retainedFittedObjectCount'] == 20
            and side['articulatedObjectCount'] == 2
            for variant in inventories.values()
            for side in variant.values()
        ),
        'inheritedTubePadsRemoved': all(
            not side['inheritedFingerPadObjects']
            for variant in inventories.values()
            for side in variant.values()
        ),
        'allObjectsUvReady': all(
            side['uvReadyObjects'] == side['objectCount']
            for variant in inventories.values()
            for side in variant.values()
        ),
        'allVerticesWeighted': unweighted == 0 and maximum_weight_error <= 1e-5,
        'twelveAsymmetricArmorComponents': all(
            item['armorComponents'] == 12
            and item['armorVertices'] == 204
            and item['armorPolygons'] == 204
            and len(item['armorVertexGroups']) == 12
            and len(item['armorMaterialSlots']) == 2
            for item in topology.values()
        ),
        'layeredPalmCompressionTopology': all(
            item['palmComponents'] == 9
            and item['palmVertices'] == 153
            and item['palmPolygons'] == 153
            and len(item['palmVertexGroups']) == 5
            and len(item['palmMaterialSlots']) == 2
            for item in topology.values()
        ),
        'palmChannelTracksShaftAcrossNineActions': (
            len(contact_by_action) == 9
            and maximum_minimum_absolute <= 15.0
            and minimum_nearby_vertices >= 4
            and minimum_signed_clearance >= -6.0
        ),
        'privateFailClosed': (
            author_report['publicRuntimeAllowed'] is False
            and author_report['acceptedRuntimeAssetsChanged'] is False
            and author_report['runtimeSelectorAdded'] is False
            and author_report['glbExported'] is False
        ),
    }
    report = {
        'status': 'private-production-glove-articulation-audited',
        'automatedPass': all(checks.values()),
        'humanVisualApproval': False,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'articulationRevision': author.ARTICULATION_REVISION,
        'sourceWorkfile': bpy.data.filepath,
        'authorReport': str(author_report_path),
        'inventories': inventories,
        'topology': topology,
        'unweightedVertices': unweighted,
        'maximumWeightSumError': maximum_weight_error,
        'shaftContactByAction': contact_by_action,
        'summary': {
            'maximumMinimumAbsoluteShaftClearanceMm': round(maximum_minimum_absolute, 3),
            'minimumVerticesWithin20Mm': minimum_nearby_vertices,
            'minimumSignedShaftClearanceMm': round(minimum_signed_clearance, 3),
        },
        'checks': checks,
        'reviewRule': (
            'Automated component, weight, UV, inventory, and shaft-proximity checks cannot approve '
            'appearance. Hidden close and all-action review must still reject floating plates, '
            'tube-like rhythm, visible palm holes, rigid compression, or unstable stick contact.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_ARTICULATION_AUDITED ' + str(output_report))
    if not report['automatedPass']:
        raise RuntimeError('The private production glove articulation failed its automated audit.')


def remainders_old_pad(name):
    return bool(re.search(r'Production_(Index|Middle|Ring|Pinky)_Pad_[123]$', name))


if __name__ == '__main__':
    main()
