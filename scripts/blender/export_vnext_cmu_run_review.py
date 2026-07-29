import argparse
import json
import sys
from pathlib import Path

import bpy


RUNTIME_ACTIONS = (
    ('jog-cmu-lower-body-audition', 'jog'),
    ('sprint-cmu-lower-body-audition', 'sprint'),
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--jog-audition', default='jog-cmu-lower-body-audition')
    parser.add_argument('--output-tag', default='cmu-run')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def prepare_runtime_actions(armature, jog_audition):
    prepared = {}
    runtime_actions = ((jog_audition, 'jog'), RUNTIME_ACTIONS[1])
    for audition_name, runtime_name in runtime_actions:
        audition = bpy.data.actions.get(audition_name)
        if audition is None:
            raise RuntimeError(f'Missing captured locomotion audition: {audition_name}')
        previous = bpy.data.actions.get(runtime_name)
        if previous is not None and previous != audition:
            bpy.data.actions.remove(previous)
        audition.name = runtime_name
        audition.use_fake_user = True
        prepared[runtime_name] = audition
    armature.animation_data_create()
    armature.animation_data.action = prepared['jog']
    return prepared


def remove_conversion_sources():
    removed_actions = []
    for action in list(bpy.data.actions):
        if action.name.startswith('cmu-run-jog-') or any(
            'CMU35_' in fcurve.data_path or 'CMU16_' in fcurve.data_path
            for fcurve in getattr(action, 'fcurves', [])
        ):
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


def action_summary(action, fps):
    return {
        'name': action.name,
        'frameRange': [int(value) for value in action.frame_range],
        'durationSeconds': round((action.frame_range[1] - action.frame_range[0]) / fps, 4),
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
        raise RuntimeError('The captured jog and sprint review workfile is incomplete.')

    removed_source_actions, removed_source_objects = remove_conversion_sources()
    runtime_actions = prepare_runtime_actions(armature, args.jog_audition)
    variants = {}
    for side, collection in (('home', home), ('away', away)):
        output = output_dir / f'goon-field-player-{side}-{args.output_tag}-review.glb'
        objects = export_variant(output, source, collection, contact, armature)
        variants[side] = {
            'file': str(output),
            'bytes': output.stat().st_size,
            'objectCount': len(objects),
            'objects': objects,
            'includesContactBall': 'GS_Contact_Ball' in objects,
            'detachedBackNumberObjects': [name for name in objects if 'Back_Number' in name],
        }

    fps = bpy.context.scene.render.fps
    report = {
        'status': 'private-runtime-review-exported',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'runtimeActions': {
            name: action_summary(action, fps) for name, action in runtime_actions.items()
        },
        'removedConversionActions': removed_source_actions,
        'removedConversionObjects': removed_source_objects,
        'actionNames': sorted(action.name for action in bpy.data.actions if action.name),
        'variants': variants,
        'reviewRule': 'These GLBs are private captured-locomotion review inputs only. Complete-play desktop and mobile telemetry plus human deformation review must pass before promotion.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CMU_RUN_REVIEW_EXPORTED ' + str(output_report))


if __name__ == '__main__':
    main()
