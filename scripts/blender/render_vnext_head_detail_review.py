import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ACTION_FRAMES = {'ready': 1, 'sprint': 15}
VIEWS = {
    'front': Vector((0.0, -1.0, 0.02)),
    'three-quarter': Vector((0.72, -0.72, 0.04)),
    'side': Vector((1.0, 0.0, 0.03)),
    'rear': Vector((0.0, 1.0, 0.04)),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    camera = bpy.data.objects.get('GS_SourceReview_Camera')
    collections = {
        'home': bpy.data.collections.get('GS_Equipment_Home'),
        'away': bpy.data.collections.get('GS_Equipment_Away'),
    }
    if armature is None or camera is None or any(collection is None for collection in collections.values()):
        raise RuntimeError('The private head-detail review workfile is incomplete.')
    if armature.pose.bones.get('CC_Base_Head') is None:
        raise RuntimeError('The field-player rig is missing CC_Base_Head.')
    missing_actions = [name for name in ACTION_FRAMES if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing review actions: ' + ', '.join(missing_actions))

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.lens = 76
    camera.data.dof.use_dof = False
    armature.animation_data_create()

    outputs = []
    for variant, visible_collection in collections.items():
        for collection in collections.values():
            collection.hide_render = collection != visible_collection
        for action_name, frame in ACTION_FRAMES.items():
            armature.animation_data.action = bpy.data.actions[action_name]
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            head = armature.matrix_world @ armature.pose.bones['CC_Base_Head'].head
            target = head + Vector((0.0, 0.0, 0.015))
            for view_name, offset in VIEWS.items():
                camera.location = target + offset
                point_camera(camera, target)
                output = output_dir / f'head-{variant}-{action_name}-{view_name}-frame-{frame:03d}.png'
                scene.render.filepath = str(output)
                bpy.ops.render.render(write_still=True)
                outputs.append({
                    'variant': variant,
                    'action': action_name,
                    'frame': frame,
                    'view': view_name,
                    'path': str(output),
                })

    report = {
        'status': 'rendered-for-private-human-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'actionFrames': ACTION_FRAMES,
        'views': list(VIEWS),
        'outputs': outputs,
        'reviewBoundary': (
            'The helmet and face must pass close front, three-quarter, side, and rear review in '
            'both uniforms before any production promotion decision.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_HEAD_DETAIL_REVIEW_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
