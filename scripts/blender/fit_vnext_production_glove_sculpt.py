import importlib.util
import json
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
MANUFACTURED_FIT_PATH = SCRIPT_DIR / 'fit_vnext_production_glove_manufactured.py'
MANUFACTURED_FIT_SPEC = importlib.util.spec_from_file_location(
    'vnext_glove_manufactured_fit',
    MANUFACTURED_FIT_PATH,
)
manufactured_fit = importlib.util.module_from_spec(MANUFACTURED_FIT_SPEC)
MANUFACTURED_FIT_SPEC.loader.exec_module(manufactured_fit)
topology_fit = manufactured_fit.topology_fit
fit = manufactured_fit.fit

FIT_REVISION = 'production-integrated-sewn-volume-fit-v5'
SCULPT_REVISION = 'integrated-sewn-volume-glove-v4'
MANUFACTURED_REVISION = 'anatomical-sewn-glove-shell-v3'
_manufactured_weights = manufactured_fit.manufactured_weights


def ensure_sculpt_palm_material():
    name = 'GS_Production_Glove_Palm_Leather_Light'
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    source = bpy.data.materials['GS_Production_Glove_Palm_Leather']
    material = source.copy()
    material.name = name
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = next(node for node in nodes if node.bl_idname == 'ShaderNodeBsdfPrincipled')
    base_color = shader.inputs['Base Color']
    incoming = base_color.links[0] if base_color.links else None
    if incoming is not None:
        source_socket = incoming.from_socket
        value = nodes.new('ShaderNodeHueSaturation')
        value.name = 'GS_Palm_Leather_Value_Lift'
        value.inputs['Saturation'].default_value = 0.58
        value.inputs['Value'].default_value = 1.62
        links.remove(incoming)
        links.new(source_socket, value.inputs['Color'])
        links.new(value.outputs['Color'], base_color)
    return material


def sculpt_material(source_material, _legacy_materials):
    name = source_material.name if source_material else ''
    if 'Red' in name:
        return bpy.data.materials['GS_Production_Glove_Leather_Red']
    if 'Binding' in name or 'Thread' in name:
        return bpy.data.materials['GS_Production_Glove_Thread']
    if 'Palm' in name:
        return ensure_sculpt_palm_material()
    return bpy.data.materials['GS_Production_Glove_Leather_Black']


def hand_weight(side_token):
    return {f'CC_Base_{side_token}_Hand': 1.0}


def sculpt_weights(object_name, coordinate, side_token, fingers, thumb):
    if 'Palm_Saddle' in object_name:
        if coordinate.x <= -0.035:
            return hand_weight(side_token)
        _, source_name, _ = manufactured_fit.nearest_finger(coordinate, fingers)
        family = manufactured_fit.finger_family(source_name)
        progress = manufactured_fit.smoothstep((coordinate.x + 0.020) / 0.061)
        finger_weights = topology_fit.blend_root_to_finger(side_token, family, progress)
        amount = manufactured_fit.smoothstep((coordinate.x + 0.035) / 0.068)
        return manufactured_fit.blend_hand_to_weights(
            f'CC_Base_{side_token}_Hand',
            finger_weights,
            amount,
        )

    if 'Finger_Root_Yoke' in object_name or 'Finger_Root_Binding' in object_name:
        _, source_name, _ = manufactured_fit.nearest_finger(coordinate, fingers)
        family = manufactured_fit.finger_family(source_name)
        amount = manufactured_fit.smoothstep((coordinate.x + 0.044) / 0.052)
        return manufactured_fit.blend_hand_to_weights(
            f'CC_Base_{side_token}_Hand',
            {f'CC_Base_{side_token}_{family}1': 1.0},
            amount,
        )

    if 'Thumb_Saddle' in object_name:
        _, progress = fit.nearest_path_progress(coordinate, thumb)
        thumb_weights = fit.segment_blend(side_token, 'Thumb', progress)
        amount = manufactured_fit.smoothstep((progress - 0.03) / 0.38)
        return manufactured_fit.blend_hand_to_weights(
            f'CC_Base_{side_token}_Hand',
            thumb_weights,
            amount,
        )

    return _manufactured_weights(object_name, coordinate, side_token, fingers, thumb)


def main():
    manufactured_fit.FIT_REVISION = FIT_REVISION
    manufactured_fit.MANUFACTURED_REVISION = SCULPT_REVISION
    manufactured_fit.manufactured_weights = sculpt_weights
    fit.mapped_material = sculpt_material
    manufactured_fit.main()

    args = fit.parse_args()
    report_path = Path(args.output_report).resolve()
    report = json.loads(report_path.read_text(encoding='utf-8'))
    report.update({
        'status': 'private-production-glove-sculpt-fit-authored',
        'fitRevision': FIT_REVISION,
        'sculptRevision': SCULPT_REVISION,
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
        'jointSpecificFoamArmorPanelsPerHand': 12,
        'formedPalmUsesHandToFingerBlend': True,
        'metacarpalYokeUsesFourHandToFingerRootBlends': True,
        'thumbHingeUsesHandToThumbChainBlend': True,
        'productionFinishMaterials': [
            'GS_Production_Glove_Leather_Black',
            'GS_Production_Glove_Leather_Red',
            'GS_Production_Glove_Palm_Leather_Light',
            'GS_Production_Glove_Thread',
        ],
        'inverseBoundAtFitPose': True,
        'linearSkinning': True,
    }
    report['reviewBoundary'] = (
        'The integrated sewn-volume source remains private until close and all-action evidence approves '
        'formed palm flow, metacarpal articulation, foam thickness, thumb hinging, and edge finish.'
    )
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    bpy.context.scene['vnext_production_glove_fit_revision'] = FIT_REVISION
    bpy.context.scene['vnext_production_glove_sculpt_revision'] = SCULPT_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.output_workfile).resolve()))
    print('GOON_VNEXT_PRODUCTION_GLOVE_SCULPT_FIT_AUTHORED ' + str(report_path))


if __name__ == '__main__':
    main()
