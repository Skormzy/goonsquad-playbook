import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


CLIPS = (
    'idle-ready',
    'jog-forward',
    'sprint-forward',
    'stick-handle',
    'receive-pass',
    'forehand-pass',
    'wrist-shot',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def sample_frames(action, count=5):
    start = int(math.ceil(action.frame_range[0]))
    end = int(math.floor(action.frame_range[1]))
    if count <= 1 or end <= start:
        return [start]
    return [round(start + (end - start) * index / (count - 1)) for index in range(count)]


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
        raise RuntimeError('The vNext motion audition workfile is incomplete.')

    home.hide_render = False
    away.hide_render = True
    for obj in home.all_objects:
        if obj is not None and '_Stick_' in obj.name:
            obj.hide_render = True

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 480
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.dof.use_dof = False
    camera.location = (3.25, -3.7, 1.18)
    camera.data.lens = 66
    point_camera(camera, (0, 0, 0.96))

    armature.animation_data_create()
    renders = []
    missing = []
    for clip_name in CLIPS:
        action = bpy.data.actions.get(clip_name)
        if action is None:
            missing.append(clip_name)
            continue
        armature.animation_data.action = action
        frames = sample_frames(action)
        clip_renders = []
        for index, frame in enumerate(frames):
            scene.frame_set(frame)
            output = output_dir / f'{clip_name}-{index + 1:02d}-frame-{frame:03d}.png'
            scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
            clip_renders.append(str(output))
        renders.append({
            'clipName': clip_name,
            'frameRange': [action.frame_range[0], action.frame_range[1]],
            'sampleFrames': frames,
            'renders': clip_renders,
        })

    report = {
        'status': 'rendered-for-human-review' if not missing else 'missing-actions',
        'decision': 'not-production-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'renderedClipCount': len(renders),
        'missingClips': missing,
        'clips': renders,
        'reviewBoundary': 'Still sequences expose pose progression only. Motion approval also requires real-time playback and transition review.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
