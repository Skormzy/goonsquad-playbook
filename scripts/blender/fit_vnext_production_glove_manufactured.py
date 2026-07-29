import importlib.util
import json
import re
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
TOPOLOGY_FIT_PATH = SCRIPT_DIR / 'fit_vnext_production_glove_topology.py'
TOPOLOGY_FIT_SPEC = importlib.util.spec_from_file_location('vnext_glove_topology_fit', TOPOLOGY_FIT_PATH)
topology_fit = importlib.util.module_from_spec(TOPOLOGY_FIT_SPEC)
TOPOLOGY_FIT_SPEC.loader.exec_module(topology_fit)
fit = topology_fit.fit

FIT_REVISION = 'production-anatomical-sewn-fit-v4'
MANUFACTURED_REVISION = 'anatomical-sewn-glove-shell-v3'


def nearest_finger(coordinate, fingers):
    candidates = []
    for source_name, path in fingers.items():
        distance, progress = fit.nearest_path_progress(coordinate, path)
        candidates.append((distance, source_name, progress))
    return min(candidates)


def finger_family(source_name):
    return 'Mid' if source_name == 'Middle' else source_name


def smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def blend_hand_to_weights(hand_name, weights, amount):
    amount = max(0.0, min(1.0, amount))
    result = {name: weight * amount for name, weight in weights.items()}
    result[hand_name] = result.get(hand_name, 0.0) + 1.0 - amount
    return {name: weight for name, weight in result.items() if weight > 1e-7}


def manufactured_weights(object_name, coordinate, side_token, fingers, thumb):
    if re.search(r'GS_Glove_(Index|Middle|Ring|Pinky)_(?:Finger_Body|Armor_[123])$', object_name):
        return topology_fit.topology_weights(object_name, coordinate, side_token, fingers, thumb)

    if 'Palm_Saddle' in object_name:
        _, source_name, progress = nearest_finger(coordinate, fingers)
        return topology_fit.blend_root_to_finger(side_token, finger_family(source_name), progress)

    if 'Finger_Root_Yoke' in object_name or 'Finger_Root_Binding' in object_name:
        _, source_name, _ = nearest_finger(coordinate, fingers)
        family = finger_family(source_name)
        amount = smoothstep((coordinate.x + 0.037) / 0.045)
        return blend_hand_to_weights(
            f'CC_Base_{side_token}_Hand',
            {f'CC_Base_{side_token}_{family}1': 1.0},
            amount,
        )

    if 'Thumb_Saddle' in object_name:
        return {
            f'CC_Base_{side_token}_Hand': 0.35,
            f'CC_Base_{side_token}_Thumb1': 0.65,
        }

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
    fit.object_weight_override = manufactured_weights
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
        'status': 'private-production-glove-manufactured-fit-authored',
        'fitRevision': FIT_REVISION,
        'manufacturedRevision': MANUFACTURED_REVISION,
        'sourceTopologyRevision': 'segmented-source-finger-shell-v2',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
    })
    report['weighting'] = {
        'fingerFreeShellRegions': ['cuff', 'hand', 'thumb'],
        'independentFingerBodiesPerHand': 4,
        'smoothFingerChainsPerHand': 4,
        'rigidContouredArmorPanelsPerHand': 12,
        'continuousPalmSaddlePerHand': 1,
        'handToFingerRootYokeBlend': True,
        'handToThumbSaddleBlend': True,
        'inverseBoundAtFitPose': True,
        'linearSkinning': True,
    }
    report['reviewBoundary'] = (
        'The anatomical sewn source remains private until close and all-action evidence approves '
        'finger-root continuity, palm closure, thumb construction, armor rhythm, and edge finish.'
    )
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    bpy.context.scene['vnext_production_glove_fit_revision'] = FIT_REVISION
    bpy.context.scene['vnext_production_glove_manufactured_revision'] = MANUFACTURED_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.output_workfile).resolve()))
    print('GOON_VNEXT_PRODUCTION_GLOVE_MANUFACTURED_FIT_AUTHORED ' + str(report_path))


if __name__ == '__main__':
    main()
