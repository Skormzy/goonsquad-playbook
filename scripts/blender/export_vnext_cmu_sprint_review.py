import argparse
import json
import sys
from pathlib import Path

import bpy


AUDITION_ACTION = 'sprint-cmu-lower-body-audition'
RUNTIME_ACTION = 'sprint'


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def prepare_runtime_action(armature):
    audition = bpy.data.actions.get(AUDITION_ACTION)
    if audition is None:
        raise RuntimeError(f'Missing captured sprint audition: {AUDITION_ACTION}')
    previous = bpy.data.actions.get(RUNTIME_ACTION)
    if previous is not None and previous != audition:
        bpy.data.actions.remove(previous)
    audition.name = RUNTIME_ACTION
    audition.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = audition
    return audition


def remove_conversion_sources():
    removed_actions = []
    for action in list(bpy.data.actions):
        if action.name == 'cmu-run-jog-35-24' or any(
            'CMU35_' in fcurve.data_path for fcurve in getattr(action, 'fcurves', [])
        ):
            removed_actions.append(action.name)
            bpy.data.actions.remove(action)
    removed_objects = []
    for obj in list(bpy.data.objects):
        if obj.name.startswith('CMU35_'):
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
        raise RuntimeError('The captured sprint review workfile is incomplete.')

    removed_source_actions, removed_source_objects = remove_conversion_sources()
    sprint = prepare_runtime_action(armature)
    variants = {}
    for side, collection in (('home', home), ('away', away)):
        output = output_dir / f'goon-field-player-{side}-cmu-sprint-review.glb'
        objects = export_variant(output, source, collection, contact, armature)
        variants[side] = {
            'file': str(output),
            'bytes': output.stat().st_size,
            'objectCount': len(objects),
            'objects': objects,
            'includesContactBall': 'GS_Contact_Ball' in objects,
            'detachedBackNumberObjects': [name for name in objects if 'Back_Number' in name],
        }

    action_names = sorted(action.name for action in bpy.data.actions if action.name)
    report = {
        'status': 'private-runtime-review-exported',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'runtimeSprintAction': sprint.name,
        'runtimeSprintFrameRange': [int(value) for value in sprint.frame_range],
        'runtimeSprintDurationSeconds': round(
            (sprint.frame_range[1] - sprint.frame_range[0]) / bpy.context.scene.render.fps,
            4,
        ),
        'removedConversionActions': removed_source_actions,
        'removedConversionObjects': removed_source_objects,
        'actionNames': action_names,
        'variants': variants,
        'reviewRule': 'These GLBs are private review inputs only and cannot replace accepted runtime assets until desktop and mobile visual, contact, and performance gates pass.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CMU_SPRINT_REVIEW_EXPORTED ' + str(output_report))


if __name__ == '__main__':
    main()
