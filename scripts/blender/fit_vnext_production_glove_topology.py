import importlib.util
import json
import re
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
FIT_PATH = SCRIPT_DIR / 'fit_vnext_production_glove.py'
FIT_SPEC = importlib.util.spec_from_file_location('vnext_glove_fit', FIT_PATH)
fit = importlib.util.module_from_spec(FIT_SPEC)
FIT_SPEC.loader.exec_module(fit)

AUTHOR_PATH = SCRIPT_DIR / 'author_vnext_production_glove_topology.py'
AUTHOR_SPEC = importlib.util.spec_from_file_location('vnext_glove_topology_author', AUTHOR_PATH)
topology = importlib.util.module_from_spec(AUTHOR_SPEC)
AUTHOR_SPEC.loader.exec_module(topology)

FIT_REVISION = 'production-segmented-source-fit-v3'


def blend_root_to_finger(side_token, family, progress):
    weights = fit.segment_blend(side_token, family, progress)
    if progress >= 0.22:
        return weights
    amount = max(0.0, min(1.0, progress / 0.22))
    amount = amount * amount * (3.0 - 2.0 * amount)
    result = {name: weight * amount for name, weight in weights.items()}
    result[f'CC_Base_{side_token}_Hand'] = 1.0 - amount
    return {name: weight for name, weight in result.items() if weight > 1e-7}


def topology_weights(object_name, coordinate, side_token, fingers, thumb):
    body_match = re.fullmatch(
        r'GS_Glove_(Index|Middle|Ring|Pinky)_Finger_Body',
        object_name,
    )
    if body_match:
        source_name = body_match.group(1)
        family = 'Mid' if source_name == 'Middle' else source_name
        _, progress = fit.nearest_path_progress(coordinate, fingers[source_name])
        return blend_root_to_finger(side_token, family, progress)

    armor_match = re.fullmatch(
        r'GS_Glove_(Index|Middle|Ring|Pinky)_Armor_([123])',
        object_name,
    )
    if armor_match:
        family = 'Mid' if armor_match.group(1) == 'Middle' else armor_match.group(1)
        return {f'CC_Base_{side_token}_{family}{armor_match.group(2)}': 1.0}

    if object_name == 'GS_Glove_Palm_Channel':
        candidates = []
        for source_name, path in fingers.items():
            distance, progress = fit.nearest_path_progress(coordinate, path)
            candidates.append((distance, source_name, progress))
        _, source_name, progress = min(candidates)
        family = 'Mid' if source_name == 'Middle' else source_name
        return blend_root_to_finger(side_token, family, progress)

    return fit._legacy_object_weight_override(
        object_name,
        coordinate,
        side_token,
        fingers,
        thumb,
    )


def main():
    fit.FIT_REVISION = FIT_REVISION
    fit._legacy_object_weight_override = fit.object_weight_override
    fit.object_weight_override = topology_weights
    if bpy.data.materials.get('GS_PBR_Leather_Red') is None:
        source_red = bpy.data.materials.get('GS_Production_Glove_Leather_Red')
        if source_red is None:
            raise RuntimeError('The approved red glove leather material is missing.')
        red_alias = source_red.copy()
        red_alias.name = 'GS_PBR_Leather_Red'
    args = fit.parse_args()
    fit.main()

    report_path = Path(args.output_report).resolve()
    report = json.loads(report_path.read_text(encoding='utf-8'))
    report.update({
        'status': 'private-production-glove-topology-fit-authored',
        'fitRevision': FIT_REVISION,
        'sourceTopologyRevision': 'segmented-source-finger-shell-v2',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
    })
    report['weighting'] = {
        'fingerFreeShellRegions': ['cuff', 'hand', 'thumb'],
        'cuffBlend': ['ForearmTwist02', 'Hand'],
        'independentFingerBodiesPerHand': 4,
        'smoothFingerChainsPerHand': 4,
        'rigidArmorZonesPerHand': 12,
        'fingerWeightedPalmStallsPerHand': 4,
        'inverseBoundAtFitPose': True,
        'linearSkinning': True,
        'continuousFingerRootBlend': True,
    }
    report['reviewBoundary'] = (
        'The source-level topology remains private until close and all-action evidence proves '
        'credible palm closure, finger deformation, armor attachment, and stick contact.'
    )
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    bpy.context.scene['vnext_production_glove_fit_revision'] = FIT_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.output_workfile).resolve()))
    print('GOON_VNEXT_PRODUCTION_GLOVE_TOPOLOGY_FIT_AUTHORED ' + str(report_path))


if __name__ == '__main__':
    main()
