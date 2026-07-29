import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
FIT_REVISION = 'production-integrated-source-fit-v2'
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
FINGER_TOKENS = ('Index', 'Mid', 'Ring', 'Pinky', 'Thumb')
SHAFT_RADIUS_M = 0.0115


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fit-report', required=True)
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


def deform_matrix(armature, bone_name):
    pose_bone = armature.pose.bones[bone_name]
    rest_bone = armature.data.bones[bone_name]
    return pose_bone.matrix @ rest_bone.matrix_local.inverted()


def stick_line_world(armature):
    deformation = deform_matrix(armature, 'GS_Stick_Control')
    return (
        armature.matrix_world @ (deformation @ Vector((0.0, 0.0, 6.0))),
        armature.matrix_world @ (deformation @ Vector((0.0, 0.0, 159.0))),
    )


def distance_to_segment(point, start, end):
    direction = end - start
    denominator = direction.length_squared
    if denominator <= 1e-12:
        return (point - start).length
    amount = max(0.0, min(1.0, (point - start).dot(direction) / denominator))
    return (point - (start + direction * amount)).length


def evaluated_points(obj, sample_limit=None):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        step = 1
        if sample_limit and len(mesh.vertices) > sample_limit:
            step = max(1, math.ceil(len(mesh.vertices) / sample_limit))
        return [
            evaluated.matrix_world @ mesh.vertices[index].co
            for index in range(0, len(mesh.vertices), step)
        ]
    finally:
        evaluated.to_mesh_clear()


def topology_metrics(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    components = 0
    remaining = set(bm.verts)
    while remaining:
        components += 1
        stack = [remaining.pop()]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other in remaining:
                    remaining.remove(other)
                    stack.append(other)
    non_manifold = sum(not edge.is_manifold for edge in bm.edges)
    bm.free()
    return {
        'vertices': len(obj.data.vertices),
        'polygons': len(obj.data.polygons),
        'connectedComponents': components,
        'nonManifoldEdges': non_manifold,
    }


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
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
    }


def percentile(values, amount):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * amount)))
    return ordered[index]


def glove_objects(variant, side):
    prefix = f'GS_{variant}_Glove_{side}_'
    return [
        obj
        for obj in bpy.data.objects
        if obj.type == 'MESH'
        and obj.name.startswith(prefix)
        and obj.get('production_glove_fit_revision') == FIT_REVISION
    ]


def bone_coverage(armature, side_token, shell_points):
    names = [f'CC_Base_{side_token}_Hand'] + [
        f'CC_Base_{side_token}_{family}{segment}'
        for family in FINGER_TOKENS
        for segment in (1, 2, 3)
    ]
    records = {}
    for bone_name in names:
        bone = armature.pose.bones[bone_name]
        point = armature.matrix_world @ ((bone.head + bone.tail) * 0.5)
        nearest = min((point - shell_point).length for shell_point in shell_points)
        records[bone_name] = round(nearest * 1000.0, 3)
    return {
        'nearestShellDistanceMmByBone': records,
        'maximumNearestShellDistanceMm': max(records.values()),
    }


def main():
    args = parse_args()
    fit_report_path = Path(args.fit_report).resolve()
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)
    fit_report = json.loads(fit_report_path.read_text(encoding='utf-8'))

    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing field-player armature: {ARMATURE_NAME}')
    armature.animation_data_create()

    inventories = {}
    all_objects = []
    for variant in ('Home', 'Away'):
        inventories[variant.lower()] = {}
        for side in ('Left', 'Right'):
            objects = glove_objects(variant, side)
            if len(objects) < 30:
                raise RuntimeError(f'Expected a complete {variant} {side} fit, found {len(objects)} objects.')
            all_objects.extend(objects)
            inventories[variant.lower()][side.lower()] = {
                'objectCount': len(objects),
                'vertices': sum(len(obj.data.vertices) for obj in objects),
                'polygons': sum(len(obj.data.polygons) for obj in objects),
                'objects': {
                    obj.name: weight_metrics(obj)
                    for obj in objects
                },
            }

    unweighted = sum(
        record['unweightedVertices']
        for variant in inventories.values()
        for side in variant.values()
        for record in side['objects'].values()
    )
    maximum_weight_error = max(
        record['maximumWeightSumError']
        for variant in inventories.values()
        for side in variant.values()
        for record in side['objects'].values()
    )

    topology = {}
    for side in ('Left', 'Right'):
        shell = bpy.data.objects[f'GS_Home_Glove_{side}_ProductionShell']
        topology[side.lower()] = topology_metrics(shell)

    action_contract = {}
    shaft_contact = {}
    coverage = {}
    home = bpy.data.collections['GS_Equipment_Home']
    away = bpy.data.collections['GS_Equipment_Away']
    home.hide_render = False
    away.hide_render = True
    for action_name, frame in ACTION_FRAMES.items():
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f'Missing review action: {action_name}')
        armature.animation_data.action = action
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        curves = [
            fcurve
            for fcurve in action_fcurves(action)
            if any(token in fcurve.data_path for token in FINGER_TOKENS)
        ]
        action_contract[action_name] = {
            'frame': frame,
            'fingerFcurves': len(curves),
            'fingerKeys': sum(len(fcurve.keyframe_points) for fcurve in curves),
            'gripRevision': action.get('production_glove_grip_revision'),
        }

        shaft_start, shaft_end = stick_line_world(armature)
        shaft_contact[action_name] = {}
        coverage[action_name] = {}
        for side, side_token in (('Left', 'L'), ('Right', 'R')):
            objects = glove_objects('Home', side)
            points = [
                point
                for obj in objects
                for point in evaluated_points(obj, sample_limit=18_000)
            ]
            clearances = [
                distance_to_segment(point, shaft_start, shaft_end) - SHAFT_RADIUS_M
                for point in points
            ]
            absolute = [abs(value) for value in clearances]
            shaft_contact[action_name][side.lower()] = {
                'sampleCount': len(points),
                'minimumAbsoluteClearanceMm': round(min(absolute) * 1000.0, 3),
                'p05AbsoluteClearanceMm': round(percentile(absolute, 0.05) * 1000.0, 3),
                'verticesWithin20Mm': sum(value <= 0.020 for value in absolute),
                'penetratingSamples': sum(value < -0.0015 for value in clearances),
                'penetratingPercent': round(
                    sum(value < -0.0015 for value in clearances) * 100.0 / len(clearances),
                    4,
                ),
            }
            coverage[action_name][side.lower()] = bone_coverage(
                armature,
                side_token,
                points,
            )

    fit_rms_maximum = max(
        fit_report['fits'][side]['rmsAnchorErrorCm']
        for side in ('left', 'right')
    )
    maximum_contact_minimum = max(
        side['minimumAbsoluteClearanceMm']
        for action in shaft_contact.values()
        for side in action.values()
    )
    minimum_contact_samples = min(
        side['verticesWithin20Mm']
        for action in shaft_contact.values()
        for side in action.values()
    )
    maximum_penetrating_percent = max(
        side['penetratingPercent']
        for action in shaft_contact.values()
        for side in action.values()
    )
    maximum_bone_distance = max(
        side['maximumNearestShellDistanceMm']
        for action in coverage.values()
        for side in action.values()
    )

    checks = {
        'fourCompleteFits': all(
            side['objectCount'] >= 30
            for variant in inventories.values()
            for side in variant.values()
        ),
        'allVerticesWeighted': unweighted == 0 and maximum_weight_error <= 1e-5,
        'continuousShellTopologyPreserved': all(
            item['connectedComponents'] == 1 and item['nonManifoldEdges'] == 0
            for item in topology.values()
        ),
        'closedGripOnAllActions': all(
            item['fingerFcurves'] == 120
            and item['fingerKeys'] == 240
            and item['gripRevision'] == 'closed-contact-v1'
            for item in action_contract.values()
        ),
        'anchorFitWithinTolerance': fit_rms_maximum <= 7.0,
        'shaftProximityAcrossActions': maximum_contact_minimum <= 6.0 and minimum_contact_samples >= 100,
        'shaftPenetrationBounded': maximum_penetrating_percent <= 4.0,
        'handSkeletonCovered': maximum_bone_distance <= 35.0,
    }
    automated_pass = all(checks.values())
    report = {
        'status': 'private-production-glove-fit-audited',
        'automatedPass': automated_pass,
        'humanVisualApproval': False,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'fitRevision': FIT_REVISION,
        'sourceWorkfile': bpy.data.filepath,
        'fitReport': str(fit_report_path),
        'inventories': inventories,
        'topology': topology,
        'unweightedVertices': unweighted,
        'maximumWeightSumError': maximum_weight_error,
        'actionContract': action_contract,
        'shaftContact': shaft_contact,
        'boneCoverage': coverage,
        'summary': {
            'maximumAnchorRmsErrorCm': fit_rms_maximum,
            'maximumMinimumShaftClearanceMm': maximum_contact_minimum,
            'minimumVerticesWithin20Mm': minimum_contact_samples,
            'maximumPenetratingPercent': maximum_penetrating_percent,
            'maximumBoneToShellDistanceMm': maximum_bone_distance,
        },
        'checks': checks,
        'reviewRule': (
            'Automated fit, weights, topology, and shaft proximity do not approve appearance. '
            'Close and all-action human review must still reject exposed hands, implausible volume, '
            'cuff clipping, rigid seams, or unreadable tactical-distance silhouettes.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_FIT_AUDITED ' + str(output_report))
    if not automated_pass:
        raise RuntimeError('The private production glove fit failed its automated audit.')


if __name__ == '__main__':
    main()
