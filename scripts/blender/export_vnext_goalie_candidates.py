import argparse
import json
import sys
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def export_variant(output, source, equipment, armature):
    bpy.ops.object.select_all(action='DESELECT')
    selected = []
    for obj in list(source.all_objects) + list(equipment.all_objects):
        if obj is None or obj.name == 'GS_SourceReview_Floor':
            continue
        if obj.type in {'ARMATURE', 'MESH'}:
            obj.hide_set(False)
            obj.select_set(True)
            selected.append(obj)
    armature.select_set(True)
    if armature not in selected:
        selected.append(armature)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
        export_morph=False, export_skins=True, export_yup=True, export_apply=False,
    )
    return sorted(set(obj.name for obj in selected))


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    source = bpy.data.collections.get('GS_FieldPlayer_Source')
    home = bpy.data.collections.get('GS_Goalie_Home')
    away = bpy.data.collections.get('GS_Goalie_Away')
    armature = bpy.data.objects.get('GS_Goalie_Rig')
    if source is None or home is None or away is None or armature is None:
        raise RuntimeError('The authored vNext goalie workfile is incomplete.')
    action_names = sorted(action.name for action in bpy.data.actions if action.name.startswith('goalie-'))
    variants = {}
    for side, collection in [('home', home), ('away', away)]:
        output = output_dir / f'goon-goalie-{side}-v1.glb'
        objects = export_variant(output, source, collection, armature)
        variants[side] = {
            'file': str(output), 'bytes': output.stat().st_size,
            'objectCount': len(objects), 'objects': objects,
            'goalieEquipmentObjects': [name for name in objects if name.startswith(f'GS_Goalie_{side.title()}_')],
        }
    report = {
        'status': 'goalie-candidates-exported',
        'decision': 'not-public-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'actionNames': action_names,
        'actionCount': len(action_names),
        'variants': variants,
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_GOALIE_EXPORTED ' + str(output_report))


if __name__ == '__main__':
    main()
