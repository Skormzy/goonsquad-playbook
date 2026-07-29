import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ACTIONS = ('ready', 'jog', 'sprint', 'turn', 'stop', 'receive', 'pass', 'shot')
CONTACT_FRAMES = {'receive': 16, 'pass': 16, 'shot': 20}
POLICY = {
    'maximumHandTargetDistanceCm': 1.5,
    'maximumHandShaftDistanceCm': 1.5,
    'maximumBallContactErrorCm': 0.25,
    'minimumBladeWorldZ': -0.005,
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def world_bone_point(armature, pose_bone, point):
    return armature.matrix_world @ point


def point_line_distance(point, line_start, line_end):
    direction = line_end - line_start
    if direction.length == 0:
        return (point - line_start).length
    return direction.cross(point - line_start).length / direction.length


def deformation(pose_bone):
    return pose_bone.matrix @ pose_bone.bone.matrix_local.inverted()


def evaluated_min_z(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    return min((evaluated.matrix_world @ Vector(corner)).z for corner in evaluated.bound_box)


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    blade = bpy.data.objects.get('GS_Home_Stick_Blade')
    ball = bpy.data.objects.get('GS_Contact_Ball')
    if armature is None or blade is None or ball is None:
        raise RuntimeError('The authored contact workfile is incomplete.')

    failures = []
    action_reports = []
    for action_name in ACTIONS:
        action = bpy.data.actions.get(action_name)
        if action is None:
            failures.append(f'Missing action: {action_name}.')
            continue
        armature.animation_data.action = action
        start = int(action.frame_range[0])
        end = int(action.frame_range[1])
        left_errors = []
        right_errors = []
        left_shaft_errors = []
        right_shaft_errors = []
        blade_heights = []
        ball_contact_error = None

        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            depsgraph = bpy.context.evaluated_depsgraph_get()
            evaluated_armature = armature.evaluated_get(depsgraph)
            matrix_world = evaluated_armature.matrix_world
            bones = evaluated_armature.pose.bones

            left_hand = world_bone_point(evaluated_armature, bones['CC_Base_L_Hand'], bones['CC_Base_L_Hand'].tail)
            right_hand = world_bone_point(evaluated_armature, bones['CC_Base_R_Hand'], bones['CC_Base_R_Hand'].tail)
            left_target = world_bone_point(evaluated_armature, bones['GS_L_Hand_Target'], bones['GS_L_Hand_Target'].head)
            right_target = world_bone_point(evaluated_armature, bones['GS_R_Hand_Target'], bones['GS_R_Hand_Target'].head)
            left_errors.append((left_hand - left_target).length * 100)
            right_errors.append((right_hand - right_target).length * 100)

            stick_matrix = deformation(bones['GS_Stick_Control'])
            shaft_start = matrix_world @ (stick_matrix @ Vector((0, 0, 0)))
            shaft_end = matrix_world @ (stick_matrix @ Vector((0, 0, 155)))
            left_shaft_errors.append(point_line_distance(left_hand, shaft_start, shaft_end) * 100)
            right_shaft_errors.append(point_line_distance(right_hand, shaft_start, shaft_end) * 100)
            blade_heights.append(evaluated_min_z(blade, depsgraph))

            if CONTACT_FRAMES.get(action_name) == frame:
                ball_matrix = deformation(bones['GS_Ball_Control'])
                ball_center = matrix_world @ (ball_matrix @ Vector((0, 0, 0)))
                expected_local = stick_matrix @ Vector((0, -23, 3.0))
                expected_local += Vector((0, 0, 3.3))
                expected_center = matrix_world @ expected_local
                ball_contact_error = (ball_center - expected_center).length * 100

        report = {
            'name': action_name,
            'frameRange': [start, end],
            'checkedFrameCount': end - start + 1,
            'maxLeftHandTargetDistanceCm': round(max(left_errors), 4),
            'maxRightHandTargetDistanceCm': round(max(right_errors), 4),
            'maxLeftHandShaftDistanceCm': round(max(left_shaft_errors), 4),
            'maxRightHandShaftDistanceCm': round(max(right_shaft_errors), 4),
            'minimumBladeWorldZ': round(min(blade_heights), 5),
            'contactFrame': CONTACT_FRAMES.get(action_name),
            'ballContactErrorCm': None if ball_contact_error is None else round(ball_contact_error, 4),
        }
        action_reports.append(report)
        if report['maxLeftHandTargetDistanceCm'] > POLICY['maximumHandTargetDistanceCm']:
            failures.append(f'{action_name} left hand exceeds target distance policy.')
        if report['maxRightHandTargetDistanceCm'] > POLICY['maximumHandTargetDistanceCm']:
            failures.append(f'{action_name} right hand exceeds target distance policy.')
        if report['maxLeftHandShaftDistanceCm'] > POLICY['maximumHandShaftDistanceCm']:
            failures.append(f'{action_name} left hand separates from the shaft.')
        if report['maxRightHandShaftDistanceCm'] > POLICY['maximumHandShaftDistanceCm']:
            failures.append(f'{action_name} right hand separates from the shaft.')
        if report['minimumBladeWorldZ'] < POLICY['minimumBladeWorldZ']:
            failures.append(f'{action_name} stick blade penetrates the floor.')
        if report['ballContactErrorCm'] is not None and report['ballContactErrorCm'] > POLICY['maximumBallContactErrorCm']:
            failures.append(f'{action_name} ball contact is outside policy.')

    report = {
        'status': 'passed' if not failures else 'failed',
        'decision': 'supporting-evidence-only',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'policy': POLICY,
        'contactFrames': CONTACT_FRAMES,
        'failures': failures,
        'actions': action_reports,
        'approvalRule': 'Measured contact supports but cannot replace close-camera human visual review.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_CONTACT_AUDIT ' + report['status'])


if __name__ == '__main__':
    main()
