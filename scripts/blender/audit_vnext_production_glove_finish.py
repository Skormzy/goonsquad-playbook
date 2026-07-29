import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
AUTHOR_PATH = SCRIPT_DIR / 'refine_vnext_production_glove_finish.py'
AUTHOR_SPEC = importlib.util.spec_from_file_location('vnext_glove_finish_author', AUTHOR_PATH)
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
        )
    ]


def raw_cuff_profile(obj, armature, side_token):
    frame = author.wrist_frame(armature, side_token)
    records = author.tucked_sleeve_vertices(obj, armature, side_token)
    points = [author.weighted_matrix(armature, weights) @ vertex.co for vertex, weights, _, _ in records]
    return author.pose_profile(points, frame)


def main():
    args = parse_args()
    author_report_path = Path(args.author_report).resolve()
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)
    author_report = json.loads(author_report_path.read_text(encoding='utf-8'))

    armature = bpy.data.objects.get(author.ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing field-player armature: {author.ARMATURE_NAME}')
    armature.animation_data_create()

    inventories = {}
    topology = {}
    materials = {}
    unweighted = 0
    maximum_weight_error = 0.0
    for variant in author.VARIANTS:
        inventories[variant.lower()] = {}
        for side_label, _ in author.SIDES:
            objects = glove_objects(variant, side_label)
            fitted = [
                obj for obj in objects
                if obj.get('production_glove_fit_revision') == author.FIT_REVISION
            ]
            panels = [
                obj for obj in objects
                if obj.get('production_glove_finish_revision') == author.FINISH_REVISION
                and obj.get('surface_role') == 'segmented-cuff-protection'
            ]
            object_weights = [weight_metrics(obj) for obj in objects]
            unweighted += sum(item['unweightedVertices'] for item in object_weights)
            maximum_weight_error = max(
                maximum_weight_error,
                *(item['maximumWeightSumError'] for item in object_weights),
            )
            inventories[variant.lower()][side_label.lower()] = {
                'objectCount': len(objects),
                'fittedObjectCount': len(fitted),
                'floatingCuffPanelCount': len(panels),
                'uvReadyObjects': sum(bool(obj.data.uv_layers) for obj in objects),
                'objects': sorted(obj.name for obj in objects),
            }
            shell = bpy.data.objects[f'GS_{variant}_Glove_{side_label}_ProductionShell']
            topology[f'{variant.lower()}-{side_label.lower()}'] = {
                'sleeveVertices': len(
                    bpy.data.objects[f'GS_{variant}_Jersey_Sleeve_{side_label}'].data.vertices
                ),
                'cuffPanelVertices': sum(len(obj.data.vertices) for obj in panels),
                'cuffPanelPolygons': sum(len(obj.data.polygons) for obj in panels),
                'integratedRedCuffPolygons': shell.get('integrated_cuff_panel_polygons', 0),
                'floatingCuffDetailGeometry': bool(shell.get('floating_cuff_detail_geometry')),
            }

    for material in bpy.data.materials:
        if material.get('production_glove_finish_revision') != author.FINISH_REVISION:
            continue
        node_names = {node.name for node in material.node_tree.nodes} if material.use_nodes else set()
        materials[material.name] = {
            'finish': material.get('manufactured_surface'),
            'hasMicroNormal': 'GS_Glove_Micro_Normal' in node_names,
            'hasLeatherGrain': 'GS_Glove_Leather_Grain' in node_names,
            'hasRoughnessVariation': 'GS_Glove_Roughness_Variation' in node_names,
        }

    overlap_by_action = {}
    for action_name, frame_number in ACTION_FRAMES.items():
        action_value = bpy.data.actions.get(action_name)
        if action_value is None:
            raise RuntimeError(f'Missing review action: {action_name}')
        armature.animation_data.action = action_value
        bpy.context.scene.frame_set(frame_number)
        bpy.context.view_layer.update()
        overlap_by_action[action_name] = {}
        for variant in author.VARIANTS:
            overlap_by_action[action_name][variant.lower()] = {}
            for side_label, side_token in author.SIDES:
                sleeve = bpy.data.objects[f'GS_{variant}_Jersey_Sleeve_{side_label}']
                overlap_by_action[action_name][variant.lower()][side_label.lower()] = raw_cuff_profile(
                    sleeve,
                    armature,
                    side_token,
                )

    profiles = [
        side
        for action_value in overlap_by_action.values()
        for variant in action_value.values()
        for side in variant.values()
    ]
    minimum_distance = min(profile['distanceMinimumCm'] for profile in profiles)
    maximum_radius = max(profile['radialMaximumCm'] for profile in profiles)
    checks = {
        'fourCompleteFinishedFits': all(
            side['fittedObjectCount'] == 32
            and side['floatingCuffPanelCount'] == 0
            and side['objectCount'] == 32
            for variant in inventories.values()
            for side in variant.values()
        ),
        'allFinishedObjectsHaveUvs': all(
            side['uvReadyObjects'] == side['objectCount']
            for variant in inventories.values()
            for side in variant.values()
        ),
        'allVerticesWeighted': unweighted == 0 and maximum_weight_error <= 1e-5,
        'fourManufacturedMaterials': len(materials) == 4 and all(
            value['hasMicroNormal']
            and value['hasLeatherGrain']
            and value['hasRoughnessVariation']
            for value in materials.values()
        ),
        'integratedCuffSegmentation': all(
            item['integratedRedCuffPolygons'] >= 50
            and item['floatingCuffDetailGeometry'] is False
            and item['cuffPanelVertices'] == 0
            for item in topology.values()
        ),
        'sleeveCuffTuckedAcrossActions': minimum_distance >= 3.5 and maximum_radius <= 4.85,
        'allNineActionsAudited': len(overlap_by_action) == 9,
        'privateFailClosed': (
            author_report['publicRuntimeAllowed'] is False
            and author_report['acceptedRuntimeAssetsChanged'] is False
            and author_report['runtimeSelectorAdded'] is False
            and author_report['glbExported'] is False
        ),
    }
    automated_pass = all(checks.values())
    report = {
        'status': 'private-production-glove-finish-audited',
        'automatedPass': automated_pass,
        'humanVisualApproval': False,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'finishRevision': author.FINISH_REVISION,
        'sourceWorkfile': bpy.data.filepath,
        'authorReport': str(author_report_path),
        'inventories': inventories,
        'topology': topology,
        'materials': materials,
        'unweightedVertices': unweighted,
        'maximumWeightSumError': maximum_weight_error,
        'overlapByAction': overlap_by_action,
        'summary': {
            'minimumSleeveCuffDistanceCm': round(minimum_distance, 5),
            'maximumSleeveCuffRadiusCm': round(maximum_radius, 5),
        },
        'checks': checks,
        'reviewRule': (
            'Automated overlap, UV, material-node, weight, and inventory gates do not approve '
            'appearance. Hidden close and all-action review must still reject exposed sleeve cuffs, '
            'floating pads, noisy micro normals, rigid fingers, or implausible hand volume.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_FINISH_AUDITED ' + str(output_report))
    if not automated_pass:
        raise RuntimeError('The private production glove finish failed its automated audit.')


if __name__ == '__main__':
    main()
