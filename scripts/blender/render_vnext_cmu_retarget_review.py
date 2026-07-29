import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ACTION_NAME = 'sprint-cmu-lower-body-audition'
SAMPLE_FRAMES = (1, 7, 13, 19)
VIEWS = {
    'front': ((0.0, -4.8, 1.32), (0.0, 0.0, 1.0)),
    'side': ((4.8, 0.0, 1.32), (0.0, 0.0, 1.0)),
    'three-quarter': ((3.3, -4.0, 1.42), (0.0, 0.0, 1.0)),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--action-name', default=ACTION_NAME)
    parser.add_argument('--file-prefix', default='cmu-sprint')
    parser.add_argument('--sample-frames', default=','.join(str(value) for value in SAMPLE_FRAMES))
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    sample_frames = tuple(int(value.strip()) for value in args.sample_frames.split(',') if value.strip())
    if len(sample_frames) != 4:
        raise RuntimeError('Retarget review requires four sample frames.')
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    camera = bpy.data.objects.get('GS_SourceReview_Camera')
    home = bpy.data.collections.get('GS_Equipment_Home')
    away = bpy.data.collections.get('GS_Equipment_Away')
    action = bpy.data.actions.get(args.action_name)
    if armature is None or camera is None or home is None or away is None or action is None:
        raise RuntimeError('The CMU retarget audition workfile is incomplete.')

    home.hide_render = False
    away.hide_render = True
    armature.animation_data.action = action
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 480
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.lens = 64
    camera.data.dof.use_dof = False

    outputs = []
    for view_name, (location, target) in VIEWS.items():
        camera.location = location
        point_camera(camera, target)
        for frame in sample_frames:
            scene.frame_set(frame)
            output = output_dir / f'{args.file_prefix}-{view_name}-frame-{frame:03d}.png'
            scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
            outputs.append({'view': view_name, 'frame': frame, 'path': str(output)})

    report = {
        'status': 'rendered-for-human-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'action': args.action_name,
        'sampleFrames': list(sample_frames),
        'views': list(VIEWS),
        'outputs': outputs,
        'reviewBoundary': 'Still progressions expose pose, deformation, equipment, and grip continuity. Real-time loop and measured planted-foot review remain required.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CMU_RETARGET_REVIEW_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
