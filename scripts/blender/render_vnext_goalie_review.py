import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


CLIPS = ('goalie-ready', 'goalie-shuffle', 'goalie-set', 'goalie-save-glove', 'goalie-save-blocker')
MOTION_VIEWS = {
    'front': ((0, -4.7, 1.08), (0, 0, 0.90), 62),
    'three-quarter': ((3.35, -3.85, 1.22), (0, 0, 0.92), 66),
}
EQUIPMENT_VIEWS = {
    'front': ((0, -4.7, 1.08), (0, 0, 0.92), 62),
    'three-quarter': ((3.35, -3.85, 1.22), (0, 0, 0.94), 66),
    'side': ((4.6, 0, 1.08), (0, 0, 0.92), 62),
    'rear': ((0, 4.7, 1.08), (0, 0, 0.92), 62),
    'mask-close': ((0, -2.35, 1.68), (0, 0, 1.66), 78),
    'pads-close': ((0, -2.7, 0.48), (0, 0, 0.47), 72),
    'broadcast': ((3.8, -5.4, 2.15), (0, 0, 0.87), 58),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


def sample_frames(action, count=5):
    start = int(math.ceil(action.frame_range[0]))
    end = int(math.floor(action.frame_range[1]))
    return [round(start + (end - start) * index / (count - 1)) for index in range(count)]


def set_variant(home, away, side):
    home.hide_render = side != 'home'
    away.hide_render = side != 'away'
    bpy.context.view_layer.update()


def render(scene, camera, output, position, target, lens):
    camera.location = position
    camera.data.lens = lens
    point_camera(camera, target)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    armature = bpy.data.objects.get('GS_Goalie_Rig')
    camera = bpy.data.objects.get('GS_SourceReview_Camera')
    home = bpy.data.collections.get('GS_Goalie_Home')
    away = bpy.data.collections.get('GS_Goalie_Away')
    if armature is None or camera is None or home is None or away is None:
        raise RuntimeError('The authored vNext goalie workfile is incomplete.')

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 480
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.dof.use_dof = False
    armature.animation_data_create()

    ready = bpy.data.actions.get('goalie-ready')
    armature.animation_data.action = ready
    scene.frame_set(1)
    equipment_renders = []
    for side in ('home', 'away'):
        set_variant(home, away, side)
        for view_name, (position, target, lens) in EQUIPMENT_VIEWS.items():
            output = output_dir / f'equipment-{side}-{view_name}.png'
            render(scene, camera, output, position, target, lens)
            equipment_renders.append(str(output))

    set_variant(home, away, 'home')
    motion_renders = []
    for clip_name in CLIPS:
        action = bpy.data.actions.get(clip_name)
        if action is None:
            raise RuntimeError(f'Missing goalie action: {clip_name}')
        armature.animation_data.action = action
        frames = sample_frames(action)
        clip_views = {}
        for view_name, (position, target, lens) in MOTION_VIEWS.items():
            outputs = []
            for index, frame in enumerate(frames):
                scene.frame_set(frame)
                output = output_dir / f'motion-{clip_name}-{view_name}-{index + 1:02d}-frame-{frame:03d}.png'
                render(scene, camera, output, position, target, lens)
                outputs.append(str(output))
            clip_views[view_name] = outputs
        motion_renders.append({'clipName': clip_name, 'sampleFrames': frames, 'views': clip_views})

    armature.animation_data.action = ready
    scene.frame_set(1)
    set_variant(home, away, 'home')
    report = {
        'status': 'rendered-for-human-review',
        'decision': 'not-public-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'equipmentViews': list(EQUIPMENT_VIEWS.keys()),
        'motionViews': list(MOTION_VIEWS.keys()),
        'equipmentRenders': equipment_renders,
        'motionClips': motion_renders,
        'renderCount': len(equipment_renders) + sum(len(outputs) for clip in motion_renders for outputs in clip['views'].values()),
        'approvalRule': 'Human multi-angle review is required; render completion does not approve the goalie.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
