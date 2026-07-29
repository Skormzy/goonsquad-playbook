import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ACTION_FRAMES = {
    'ready': 1,
    'jog': 17,
    'sprint': 15,
    'turn': 16,
    'stop': 16,
    'receive': 16,
    'pass': 16,
    'shot': 20,
    'jog-to-sprint-ik': 4,
}

VIEWS = {
    'front': ((0.0, -4.8, 1.32), (0.0, 0.0, 1.0)),
    'rear': ((0.0, 4.8, 1.32), (0.0, 0.0, 1.0)),
    'side': ((4.8, 0.0, 1.32), (0.0, 0.0, 1.0)),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    camera = bpy.data.objects.get('GS_SourceReview_Camera')
    home = bpy.data.collections.get('GS_Equipment_Home')
    away = bpy.data.collections.get('GS_Equipment_Away')
    if armature is None or camera is None or home is None or away is None:
        raise RuntimeError('The private upper-body review workfile is incomplete.')

    missing_actions = [name for name in ACTION_FRAMES if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing review actions: ' + ', '.join(missing_actions))

    home.hide_render = False
    away.hide_render = True
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 360
    scene.render.resolution_y = 450
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.lens = 64
    camera.data.dof.use_dof = False
    armature.animation_data_create()

    outputs = []
    for action_name, frame in ACTION_FRAMES.items():
        armature.animation_data.action = bpy.data.actions[action_name]
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        for view_name, (location, target) in VIEWS.items():
            camera.location = location
            point_camera(camera, target)
            output = output_dir / f'upper-body-{action_name}-{view_name}-frame-{frame:03d}.png'
            scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
            outputs.append({
                'action': action_name,
                'frame': frame,
                'view': view_name,
                'path': str(output),
            })

    report = {
        'status': 'rendered-for-private-human-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'visibleBrowserWindowOpened': False,
        'visibleBlenderWindowOpened': False,
        'sourceWorkfile': bpy.data.filepath,
        'variant': 'home',
        'actionFrames': ACTION_FRAMES,
        'views': list(VIEWS),
        'outputs': outputs,
        'reviewBoundary': (
            'Every field-player action must pass front, rear, and side deformation review '
            'before the athlete can enter the accepted production asset map.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_UPPER_BODY_ACTION_REVIEW_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
