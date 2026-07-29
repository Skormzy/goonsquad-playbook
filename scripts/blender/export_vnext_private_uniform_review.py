import argparse
import json
import sys
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--output-tag', default='cmu16-ik-uniform')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def remove_conversion_sources():
    removed_actions = []
    for action in list(bpy.data.actions):
        if action.name.startswith('cmu-run-jog-') or action.name.endswith('-audition'):
            removed_actions.append(action.name)
            bpy.data.actions.remove(action)
    removed_objects = []
    for obj in list(bpy.data.objects):
        if obj.name.startswith('CMU35_') or obj.name.startswith('CMU16_'):
            removed_objects.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    return removed_actions, removed_objects


def export_variant(output, source, equipment, contact, armature):
    bpy.ops.object.select_all(action='DESELECT')
    selected = []
    for obj in list(source.all_objects) + list(equipment.all_objects) + list(contact.all_objects):
        if obj is None or obj.name == 'GS_SourceReview_Floor':
            continue
        if obj.type not in {'ARMATURE', 'MESH'}:
            continue
        obj.hide_set(False)
        obj.select_set(True)
        selected.append(obj)
    armature.hide_set(False)
    armature.select_set(True)
    if armature not in selected:
        selected.append(armature)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_morph=False,
        export_skins=True,
        export_yup=True,
        export_apply=False,
    )
    return sorted(obj.name for obj in selected)


def attachment_summary(obj):
    return {
        'object': obj.name,
        'armatureModifiers': [
            modifier.object.name if modifier.object else None
            for modifier in obj.modifiers
            if modifier.type == 'ARMATURE'
        ],
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
    }


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    source = bpy.data.collections.get('GS_FieldPlayer_Source')
    home = bpy.data.collections.get('GS_Equipment_Home')
    away = bpy.data.collections.get('GS_Equipment_Away')
    contact = bpy.data.collections.get('GS_Contact_Review')
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if source is None or home is None or away is None or contact is None or armature is None:
        raise RuntimeError('The private uniform refinement workfile is incomplete.')

    removed_actions, removed_objects = remove_conversion_sources()
    required_actions = {'ready', 'jog', 'jog-to-sprint-ik', 'sprint', 'turn', 'stop', 'receive', 'pass', 'shot'}
    action_names = {action.name for action in bpy.data.actions if action.name}
    missing_actions = sorted(required_actions - action_names)
    if missing_actions:
        raise RuntimeError(f'Missing runtime actions: {missing_actions}')

    variants = {}
    for side, collection in (('home', home), ('away', away)):
        title_side = side.title()
        jersey = bpy.data.objects.get(f'GS_{title_side}_Jersey')
        front = bpy.data.objects.get(f'GS_{title_side}_Jersey_Front_Mark')
        back = bpy.data.objects.get(f'GS_{title_side}_Jersey_Back_Number_17')
        sleeves = sorted(
            obj.name for obj in collection.all_objects
            if obj.name.startswith(f'GS_{title_side}_Jersey_Sleeve_')
            and '_Stripe_' not in obj.name
        )
        continuous_garment = bool(jersey and jersey.get('continuous_garment'))
        valid_sleeves = len(sleeves) == 0 if continuous_garment else len(sleeves) == 2
        if jersey is None or front is None or back is None or not valid_sleeves:
            raise RuntimeError(f'The refined {side} uniform is incomplete.')
        output = output_dir / f'goon-field-player-{side}-{args.output_tag}-review.glb'
        objects = export_variant(output, source, collection, contact, armature)
        variants[side] = {
            'file': str(output),
            'bytes': output.stat().st_size,
            'objectCount': len(objects),
            'objects': objects,
            'jersey': attachment_summary(jersey),
            'continuousGarment': continuous_garment,
            'frontMark': attachment_summary(front),
            'backNumber': attachment_summary(back),
            'sleeveObjects': sleeves,
            'detachedBackNumberObjects': [
                name for name in objects
                if 'Back_Number' in name and name != back.name
            ],
        }

    report = {
        'status': 'private-uniform-runtime-review-exported',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'removedConversionActions': removed_actions,
        'removedConversionObjects': removed_objects,
        'requiredActions': sorted(required_actions),
        'actionNames': sorted(action_names),
        'variants': variants,
        'reviewRule': 'These GLBs remain private until shoulder seams, sleeve openings, marks, numbering, motion contact, and complete runtime views pass human review.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_PRIVATE_UNIFORM_REVIEW_EXPORTED ' + str(output_report))


if __name__ == '__main__':
    main()
