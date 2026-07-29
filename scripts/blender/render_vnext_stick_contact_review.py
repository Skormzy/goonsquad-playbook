import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


CLIPS = ('ready', 'jog', 'sprint', 'turn', 'stop', 'receive', 'pass', 'shot')
BALL_FRAMES = {
    'receive': (1, 8, 16, 20, 24),
    'pass': (8, 12, 16, 18, 21),
    'shot': (10, 15, 20, 22, 24),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def sample_frames(action, count=5):
    start = int(math.ceil(action.frame_range[0]))
    end = int(math.floor(action.frame_range[1]))
    return [round(start + (end - start) * index / (count - 1)) for index in range(count)]


def point_camera(camera, target):
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def evaluated_bone_world(armature, bone_name, point_name):
    evaluated = armature.evaluated_get(bpy.context.evaluated_depsgraph_get())
    pose_bone = evaluated.pose.bones[bone_name]
    return evaluated.matrix_world @ getattr(pose_bone, point_name)


def contact_center(armature):
    left = evaluated_bone_world(armature, 'CC_Base_L_Hand', 'tail')
    right = evaluated_bone_world(armature, 'CC_Base_R_Hand', 'tail')
    return (left + right) * 0.5


def blade_ball_center(armature):
    evaluated = armature.evaluated_get(bpy.context.evaluated_depsgraph_get())
    matrix_world = evaluated.matrix_world
    stick = evaluated.pose.bones['GS_Stick_Control']
    ball = evaluated.pose.bones['GS_Ball_Control']
    stick_deformation = stick.matrix @ stick.bone.matrix_local.inverted()
    ball_deformation = ball.matrix @ ball.bone.matrix_local.inverted()
    blade = matrix_world @ (stick_deformation @ Vector((0, -23, 3.0)))
    ball_center = matrix_world @ (ball_deformation @ Vector((0, 0, 0)))
    if (ball_center - blade).length > 1.2:
        return blade
    return (blade + ball_center) * 0.5


def render_frame(scene, camera, output, position, target, lens):
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
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    camera = bpy.data.objects.get('GS_SourceReview_Camera')
    home = bpy.data.collections.get('GS_Equipment_Home')
    away = bpy.data.collections.get('GS_Equipment_Away')
    ball = bpy.data.objects.get('GS_Contact_Ball')
    if armature is None or camera is None or home is None or away is None or ball is None:
        raise RuntimeError('The authored contact workfile is incomplete.')

    home.hide_render = False
    away.hide_render = True
    for obj in home.all_objects:
        if obj is not None:
            obj.hide_render = False
    ball.hide_render = False
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 540
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.dof.use_dof = False
    armature.animation_data_create()

    renders = []
    for clip_name in CLIPS:
        action = bpy.data.actions.get(clip_name)
        if action is None:
            raise RuntimeError(f'Missing contact action: {clip_name}')
        armature.animation_data.action = action
        frames = sample_frames(action)
        views = {'hands-three-quarter': [], 'hands-side': []}
        for frame in frames:
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            target = contact_center(armature)
            output = output_dir / f'{clip_name}-hands-three-quarter-frame-{frame:03d}.png'
            render_frame(scene, camera, output, target + Vector((1.55, -2.10, 0.48)), target, 78)
            views['hands-three-quarter'].append(str(output))
            output = output_dir / f'{clip_name}-hands-side-frame-{frame:03d}.png'
            render_frame(scene, camera, output, target + Vector((2.20, 0.05, 0.30)), target, 82)
            views['hands-side'].append(str(output))
        renders.append({'clipName': clip_name, 'frames': frames, 'views': views})

    ball_renders = []
    for clip_name, frames in BALL_FRAMES.items():
        action = bpy.data.actions[clip_name]
        armature.animation_data.action = action
        outputs = []
        for frame in frames:
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            target = blade_ball_center(armature)
            output = output_dir / f'{clip_name}-ball-contact-frame-{frame:03d}.png'
            render_frame(scene, camera, output, target + Vector((1.35, -1.75, 0.48)), target, 72)
            outputs.append(str(output))
        ball_renders.append({'clipName': clip_name, 'frames': list(frames), 'outputs': outputs})

    report = {
        'status': 'rendered-for-human-contact-review',
        'decision': 'not-production-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'handViews': ['hands-three-quarter', 'hands-side'],
        'handClips': renders,
        'ballClips': ball_renders,
        'approvalRule': 'Close-camera visual review must show both gloves on the shaft and exact ball contact without hiding defects.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_CONTACT_REVIEW_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
