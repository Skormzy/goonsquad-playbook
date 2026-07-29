import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
STICK_CONTROL = 'GS_Stick_Control'
BALL_CONTROL = 'GS_Ball_Control'
LEFT_TARGET = 'GS_L_Hand_Target'
RIGHT_TARGET = 'GS_R_Hand_Target'
LEFT_POLE = 'GS_L_Elbow_Pole'
RIGHT_POLE = 'GS_R_Elbow_Pole'
LEFT_HAND = 'CC_Base_L_Hand'
RIGHT_HAND = 'CC_Base_R_Hand'
SPINE = 'CC_Base_Spine02'
BALL_RADIUS_CM = 3.3
SWEET_SPOT_CM = Vector((0.0, -23.0, 3.0))
CONTACT_FRAMES = {'receive': 16, 'pass': 16, 'shot': 20}
TARGET_HEADS_CM = {
    LEFT_TARGET: Vector((1.5, -1.0, 130.5)),
    RIGHT_TARGET: Vector((-1.5, 1.0, 112.5)),
}
GRIP_MIDPOINT_LIFT_CM = 4.5
POLE_HEADS_CM = {
    LEFT_POLE: Vector((48.0, -36.0, 129.0)),
    RIGHT_POLE: Vector((-48.0, -36.0, 129.0)),
}
REQUIRED_ACTIONS = (
    'ready',
    'jog',
    'sprint',
    'turn',
    'stop',
    'receive',
    'pass',
    'shot',
    'jog-to-sprint-ik',
)


# Frame, midpoint offset from upper torso (cm), shaft axis, blade toe direction.
CONTROL_KEYS = {
    'ready': [
        (1, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
        (11, (0.8, -14.5, -5.0), (0.35, 0.04, 0.935), (-0.04, -1.00, 0.00)),
        (21, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
        (31, (-0.8, -13.5, -5.0), (0.41, 0.03, 0.911), (0.04, -1.00, 0.00)),
        (41, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
    ],
    'jog': [
        (1, (0.0, -15.0, -6.0), (0.38, 0.05, 0.923), (0.00, -1.00, 0.00)),
        (9, (1.2, -15.8, -5.0), (0.34, 0.07, 0.938), (-0.07, -1.00, 0.00)),
        (17, (0.0, -15.0, -6.0), (0.39, 0.04, 0.920), (0.03, -1.00, 0.00)),
        (25, (-1.2, -14.2, -5.0), (0.42, 0.06, 0.906), (0.08, -1.00, 0.00)),
        (33, (0.0, -15.0, -6.0), (0.38, 0.05, 0.923), (0.00, -1.00, 0.00)),
    ],
    'sprint': [
        (1, (0.0, -17.0, -7.0), (0.42, 0.07, 0.905), (0.00, -1.00, 0.00)),
        (8, (1.5, -18.0, -6.0), (0.37, 0.10, 0.923), (-0.09, -1.00, 0.00)),
        (15, (0.0, -17.0, -7.0), (0.43, 0.06, 0.901), (0.05, -1.00, 0.00)),
        (22, (-1.5, -16.0, -6.0), (0.46, 0.09, 0.883), (0.10, -1.00, 0.00)),
        (29, (0.0, -17.0, -7.0), (0.42, 0.07, 0.905), (0.00, -1.00, 0.00)),
    ],
    'turn': [
        (1, (0.0, -15.0, -6.0), (0.38, 0.04, 0.924), (0.00, -1.00, 0.00)),
        (8, (-1.0, -15.0, -5.0), (0.43, 0.03, 0.902), (-0.30, -0.95, 0.00)),
        (16, (-2.0, -14.0, -5.0), (0.47, 0.02, 0.883), (-0.70, -0.71, 0.00)),
        (24, (-1.0, -15.0, -5.0), (0.43, 0.03, 0.902), (-0.30, -0.95, 0.00)),
        (32, (0.0, -15.0, -6.0), (0.38, 0.04, 0.924), (0.00, -1.00, 0.00)),
    ],
    'stop': [
        (1, (0.0, -17.0, -7.0), (0.42, 0.07, 0.905), (0.00, -1.00, 0.00)),
        (8, (1.0, -18.0, -6.0), (0.38, 0.10, 0.920), (-0.07, -1.00, 0.00)),
        (16, (0.0, -16.0, -5.0), (0.40, 0.05, 0.915), (0.03, -1.00, 0.00)),
        (24, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
        (32, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
    ],
    'receive': [
        (1, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
        (8, (-2.0, -18.0, -8.0), (0.44, 0.02, 0.898), (-0.08, -1.00, 0.00)),
        (16, (0.0, -19.0, -8.0), (0.35, 0.03, 0.936), (0.00, -1.00, 0.00)),
        (24, (1.0, -16.0, -6.0), (0.34, 0.04, 0.940), (0.04, -1.00, 0.00)),
        (32, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
    ],
    'pass': [
        (1, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
        (8, (-5.0, -16.0, -5.0), (0.51, 0.02, 0.860), (-0.34, -0.94, 0.00)),
        (16, (1.0, -18.0, -7.0), (0.30, 0.03, 0.953), (0.14, -0.99, 0.00)),
        (24, (8.0, -15.0, -4.0), (-0.12, 0.05, 0.992), (0.40, -0.92, 0.00)),
        (32, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
    ],
    'shot': [
        (1, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
        (10, (-7.0, -16.0, -3.0), (0.56, 0.02, 0.828), (-0.46, -0.89, 0.00)),
        (20, (2.0, -19.0, -7.0), (0.27, 0.03, 0.962), (0.18, -0.98, 0.00)),
        (29, (11.0, -14.0, -2.0), (-0.24, 0.05, 0.970), (0.48, -0.88, 0.00)),
        (38, (0.0, -14.0, -5.5), (0.38, 0.03, 0.925), (0.00, -1.00, 0.00)),
    ],
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def round_vector(vector, digits=4):
    return [round(value, digits) for value in vector]


def angle_degrees(first, second):
    if first.length <= 1e-8 or second.length <= 1e-8:
        return 0.0
    dot = max(-1.0, min(1.0, first.normalized().dot(second.normalized())))
    return math.degrees(math.acos(dot))


def interpolate_control(keys, frame):
    if frame <= keys[0][0]:
        offset, axis, toe = keys[0][1:]
        return Vector(offset), Vector(axis).normalized(), Vector(toe).normalized()
    if frame >= keys[-1][0]:
        offset, axis, toe = keys[-1][1:]
        return Vector(offset), Vector(axis).normalized(), Vector(toe).normalized()
    for left, right in zip(keys, keys[1:]):
        if left[0] <= frame <= right[0]:
            mix = (frame - left[0]) / (right[0] - left[0])
            offset = Vector(left[1]).lerp(Vector(right[1]), mix)
            axis = Vector(left[2]).lerp(Vector(right[2]), mix).normalized()
            toe = Vector(left[3]).lerp(Vector(right[3]), mix).normalized()
            return offset, axis, toe
    raise RuntimeError(f'No control interval contains frame {frame}.')


def control_deformation(origin, shaft_direction, toe_direction):
    shaft = Vector(shaft_direction).normalized()
    toe = Vector(toe_direction)
    toe -= shaft * toe.dot(shaft)
    toe.normalize()
    mapped_y = -toe
    mapped_z = shaft
    mapped_x = mapped_y.cross(mapped_z).normalized()
    mapped_y = mapped_z.cross(mapped_x).normalized()
    matrix = Matrix((mapped_x, mapped_y, mapped_z)).transposed().to_4x4()
    matrix.translation = origin
    return matrix, toe, shaft


def set_bone_deformation(pose_bone, deformation):
    pose_bone.rotation_mode = 'QUATERNION'
    pose_bone.matrix = deformation @ pose_bone.bone.matrix_local
    bpy.context.view_layer.update()


def key_bone(pose_bone, frame):
    pose_bone.keyframe_insert('location', frame=frame)
    pose_bone.keyframe_insert('rotation_quaternion', frame=frame)
    pose_bone.keyframe_insert('scale', frame=frame)


def clear_custom_fcurves(action):
    tokens = (STICK_CONTROL, BALL_CONTROL)
    removed = 0
    for fcurve in list(getattr(action, 'fcurves', [])):
        if any(token in fcurve.data_path for token in tokens):
            action.fcurves.remove(fcurve)
            removed += 1
    return removed


def noncustom_key_count(action):
    tokens = (STICK_CONTROL, BALL_CONTROL)
    return sum(
        len(fcurve.keyframe_points)
        for fcurve in getattr(action, 'fcurves', [])
        if not any(token in fcurve.data_path for token in tokens)
    )


def retarget_controls_and_add_poles(armature):
    before = {}
    bpy.ops.object.select_all(action='DESELECT')
    armature.hide_set(False)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='EDIT')
    bones = armature.data.edit_bones
    spine = bones.get(SPINE)
    if spine is None:
        raise RuntimeError(f'Missing torso bone: {SPINE}')

    for name, head in TARGET_HEADS_CM.items():
        bone = bones.get(name)
        if bone is None:
            raise RuntimeError(f'Missing hand target: {name}')
        before[name] = {'headCm': round_vector(bone.head), 'tailCm': round_vector(bone.tail)}
        bone.head = head
        bone.tail = head + Vector((0.0, 0.0, 5.0))

    for name, head in POLE_HEADS_CM.items():
        bone = bones.get(name) or bones.new(name)
        bone.head = head
        bone.tail = head + Vector((0.0, 0.0, 7.0))
        bone.parent = spine
        bone.use_connect = False
        bone.use_deform = False

    bpy.ops.object.mode_set(mode='POSE')
    constraint_report = []
    for hand_name, target_name, pole_name in (
        (LEFT_HAND, LEFT_TARGET, LEFT_POLE),
        (RIGHT_HAND, RIGHT_TARGET, RIGHT_POLE),
    ):
        hand = armature.pose.bones.get(hand_name)
        if hand is None:
            raise RuntimeError(f'Missing pose hand: {hand_name}')
        matching = [
            constraint for constraint in hand.constraints
            if constraint.type == 'IK' and constraint.subtarget == target_name
        ]
        if len(matching) != 1:
            raise RuntimeError(f'Expected one IK constraint for {target_name}, found {len(matching)}.')
        constraint = matching[0]
        constraint.target = armature
        constraint.pole_target = armature
        constraint.pole_subtarget = pole_name
        constraint.chain_count = 3
        constraint.iterations = 96
        constraint.use_tail = True
        constraint.use_rotation = True
        constraint.influence = 1.0
        constraint_report.append({
            'hand': hand_name,
            'target': target_name,
            'pole': pole_name,
            'chainCount': constraint.chain_count,
        })
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()

    after = {
        name: {
            'headCm': round_vector(armature.data.bones[name].head_local),
            'tailCm': round_vector(armature.data.bones[name].tail_local),
        }
        for name in TARGET_HEADS_CM
    }
    poles = {
        name: {
            'headCm': round_vector(armature.data.bones[name].head_local),
            'tailCm': round_vector(armature.data.bones[name].tail_local),
            'parent': armature.data.bones[name].parent.name,
        }
        for name in POLE_HEADS_CM
    }
    return {
        'before': before,
        'after': after,
        'beforeGripSeparationCm': round(
            (Vector(before[LEFT_TARGET]['headCm']) - Vector(before[RIGHT_TARGET]['headCm'])).length,
            4,
        ),
        'afterGripSeparationCm': round(
            (armature.data.bones[LEFT_TARGET].head_local - armature.data.bones[RIGHT_TARGET].head_local).length,
            4,
        ),
        'poles': poles,
        'constraints': constraint_report,
    }


def arm_points(armature, side):
    shoulder = armature.pose.bones[f'CC_Base_{side}_Upperarm'].head.copy()
    elbow = armature.pose.bones[f'CC_Base_{side}_Forearm'].head.copy()
    wrist = armature.pose.bones[f'CC_Base_{side}_Hand'].head.copy()
    return shoulder, elbow, wrist


def elbow_report(armature, side):
    shoulder, elbow, wrist = arm_points(armature, side)
    return {
        'shoulderCm': round_vector(shoulder),
        'elbowCm': round_vector(elbow),
        'wristCm': round_vector(wrist),
        'bendDegrees': round(angle_degrees(shoulder - elbow, wrist - elbow), 3),
    }


def calibrate_pole_angles(armature):
    reports = {}
    for side, hand_name, direction in (
        ('L', LEFT_HAND, 1.0),
        ('R', RIGHT_HAND, -1.0),
    ):
        constraint = next(
            constraint for constraint in armature.pose.bones[hand_name].constraints
            if constraint.type == 'IK' and constraint.pole_subtarget
        )
        shoulder, _, wrist = arm_points(armature, side)
        desired = (shoulder + wrist) * 0.5 + Vector((direction * 11.0, 2.0, 2.0))
        candidates = []
        for degrees in range(-180, 181, 10):
            constraint.pole_angle = math.radians(degrees)
            bpy.context.view_layer.update()
            elbow = armature.pose.bones[f'CC_Base_{side}_Forearm'].head.copy()
            candidates.append(((elbow - desired).length, degrees, elbow.copy()))
        score, degrees, elbow = min(candidates, key=lambda item: item[0])
        constraint.pole_angle = math.radians(degrees)
        bpy.context.view_layer.update()
        reports['left' if side == 'L' else 'right'] = {
            'poleAngleDegrees': degrees,
            'desiredElbowCm': round_vector(desired),
            'evaluatedElbowCm': round_vector(elbow),
            'distanceToDesiredCm': round(score, 4),
        }
    return reports


def evaluated_world_min_z(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    return min((evaluated.matrix_world @ Vector(corner)).z for corner in evaluated.bound_box)


def make_custom_curves_linear(action):
    for fcurve in getattr(action, 'fcurves', []):
        if STICK_CONTROL not in fcurve.data_path and BALL_CONTROL not in fcurve.data_path:
            continue
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = 'LINEAR'


def author_stick_action(armature, action, blade):
    armature.animation_data.action = action
    start = int(math.floor(action.frame_range[0]))
    end = int(math.ceil(action.frame_range[1]))
    keys = CONTROL_KEYS.get(action.name, CONTROL_KEYS['jog'])
    control = armature.pose.bones[STICK_CONTROL]
    left_constraint = next(
        constraint for constraint in armature.pose.bones[LEFT_HAND].constraints
        if constraint.type == 'IK' and constraint.subtarget == LEFT_TARGET
    )
    right_constraint = next(
        constraint for constraint in armature.pose.bones[RIGHT_HAND].constraints
        if constraint.type == 'IK' and constraint.subtarget == RIGHT_TARGET
    )
    constraints = (left_constraint, right_constraint)
    rest_midpoint = (
        armature.data.bones[LEFT_TARGET].head_local
        + armature.data.bones[RIGHT_TARGET].head_local
    ) * 0.5
    poses = {}
    maximum_floor_correction_mm = 0.0

    for frame in range(start, end + 1):
        for constraint in constraints:
            constraint.influence = 0.0
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        torso = armature.pose.bones[SPINE].head.copy()
        offset, shaft, toe = interpolate_control(keys, frame)
        midpoint = torso + offset + Vector((0.0, 0.0, GRIP_MIDPOINT_LIFT_CM))
        rotation, toe_vector, shaft_vector = control_deformation(Vector((0.0, 0.0, 0.0)), shaft, toe)
        origin = midpoint - (rotation @ rest_midpoint)
        deformation = rotation.copy()
        deformation.translation = origin
        set_bone_deformation(control, deformation)

        floor_error = 0.004 - evaluated_world_min_z(blade)
        if floor_error > 0.0:
            correction_cm = floor_error / abs(armature.scale.z)
            deformation.translation.z += correction_cm
            maximum_floor_correction_mm = max(maximum_floor_correction_mm, floor_error * 1000.0)
            set_bone_deformation(control, deformation)

        for constraint in constraints:
            constraint.influence = 1.0
        bpy.context.view_layer.update()
        key_bone(control, frame)
        poses[frame] = {
            'deformation': deformation.copy(),
            'toe': toe_vector.copy(),
            'shaft': shaft_vector.copy(),
            'sweetSpot': deformation @ SWEET_SPOT_CM,
            'leftElbow': elbow_report(armature, 'L'),
            'rightElbow': elbow_report(armature, 'R'),
        }

    return poses, maximum_floor_correction_mm


def ball_position(action_name, frame, poses):
    up = Vector((0.0, 0.0, BALL_RADIUS_CM))
    current = poses[frame]['sweetSpot'] + up
    if action_name == 'receive':
        contact_frame = CONTACT_FRAMES[action_name]
        contact = poses[contact_frame]['sweetSpot'] + up
        direction = poses[contact_frame]['toe']
        if frame <= contact_frame:
            distance = 90.0 * (contact_frame - frame) / max(1, contact_frame - min(poses))
            return contact + direction * distance
        return current
    if action_name in ('pass', 'shot'):
        contact_frame = CONTACT_FRAMES[action_name]
        if frame <= contact_frame:
            return current
        contact = poses[contact_frame]['sweetSpot'] + up
        direction = poses[contact_frame]['toe']
        travel = 220.0 if action_name == 'pass' else 420.0
        progress = (frame - contact_frame) / max(1, max(poses) - contact_frame)
        return contact + direction * travel * progress
    return current


def author_ball_action(armature, action, poses):
    armature.animation_data.action = action
    control = armature.pose.bones[BALL_CONTROL]
    rest = control.bone.matrix_local
    positions = {}
    for frame in range(int(action.frame_range[0]), int(action.frame_range[1]) + 1):
        bpy.context.scene.frame_set(frame)
        position = ball_position(action.name, frame, poses)
        deformation = Matrix.Identity(4)
        deformation.translation = position
        control.rotation_mode = 'QUATERNION'
        control.matrix = deformation @ rest
        bpy.context.view_layer.update()
        key_bone(control, frame)
        positions[frame] = position.copy()
    return positions


def action_summary(action, poses, positions, floor_correction_mm):
    all_samples = list(poses.values())
    contact_frame = CONTACT_FRAMES.get(action.name)
    contact_error_cm = None
    if contact_frame is not None:
        expected = poses[contact_frame]['sweetSpot'] + Vector((0.0, 0.0, BALL_RADIUS_CM))
        contact_error_cm = (positions[contact_frame] - expected).length
    return {
        'name': action.name,
        'frameRange': [int(action.frame_range[0]), int(action.frame_range[1])],
        'shaftTiltRangeDegrees': [
            round(min(angle_degrees(sample['shaft'], Vector((0.0, 0.0, 1.0))) for sample in all_samples), 3),
            round(max(angle_degrees(sample['shaft'], Vector((0.0, 0.0, 1.0))) for sample in all_samples), 3),
        ],
        'leftElbowBendRangeDegrees': [
            round(min(sample['leftElbow']['bendDegrees'] for sample in all_samples), 3),
            round(max(sample['leftElbow']['bendDegrees'] for sample in all_samples), 3),
        ],
        'rightElbowBendRangeDegrees': [
            round(min(sample['rightElbow']['bendDegrees'] for sample in all_samples), 3),
            round(max(sample['rightElbow']['bendDegrees'] for sample in all_samples), 3),
        ],
        'maximumFloorCorrectionMm': round(floor_correction_mm, 3),
        'contactFrame': contact_frame,
        'contactErrorCm': round(contact_error_cm, 5) if contact_error_cm is not None else None,
    }


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    source_workfile = bpy.data.filepath
    armature = bpy.data.objects.get(ARMATURE_NAME)
    blade = bpy.data.objects.get('GS_Home_Stick_Blade')
    ball = bpy.data.objects.get('GS_Contact_Ball')
    if armature is None or blade is None or ball is None:
        raise RuntimeError('The private natural-grip athlete workfile is incomplete.')
    missing_actions = [name for name in REQUIRED_ACTIONS if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing required actions: ' + ', '.join(missing_actions))

    armature.data.pose_position = 'REST'
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    controls = retarget_controls_and_add_poles(armature)

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    ready = bpy.data.actions['ready']
    armature.animation_data.action = ready
    clear_custom_fcurves(ready)
    ready_noncustom_keys = noncustom_key_count(ready)
    ready_poses, _ = author_stick_action(armature, ready, blade)
    pole_angles = calibrate_pole_angles(armature)
    clear_custom_fcurves(ready)

    action_reports = []
    noncustom_key_counts = {}
    for action_name in REQUIRED_ACTIONS:
        action = bpy.data.actions[action_name]
        before_count = noncustom_key_count(action)
        removed_fcurves = clear_custom_fcurves(action)
        after_clear_count = noncustom_key_count(action)
        if before_count != after_clear_count:
            raise RuntimeError(f'Non-control keyframes changed while clearing {action_name}.')
        poses, floor_correction_mm = author_stick_action(armature, action, blade)
        positions = author_ball_action(armature, action, poses)
        make_custom_curves_linear(action)
        after_count = noncustom_key_count(action)
        if before_count != after_count:
            raise RuntimeError(f'Non-control keyframes changed while authoring {action_name}.')
        noncustom_key_counts[action_name] = {
            'before': before_count,
            'after': after_count,
            'removedControlFcurves': removed_fcurves,
        }
        action_reports.append(action_summary(action, poses, positions, floor_correction_mm))

    if ready_noncustom_keys != noncustom_key_count(ready):
        raise RuntimeError('Ready action body keys changed during pole calibration.')

    armature.animation_data.action = bpy.data.actions['ready']
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.context.scene['vnext_upper_body_status'] = 'private-diagonal-stick-review'
    bpy.context.scene['vnext_upper_body_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'diagonal-stick-and-elbow-controls-authored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'armature': ARMATURE_NAME,
        'handControls': controls,
        'poleCalibration': pole_angles,
        'actions': action_reports,
        'nonControlKeyframeCounts': noncustom_key_counts,
        'ballContactReauthored': True,
        'acceptedRuntimeAssetsChanged': False,
        'reviewRule': (
            'The diagonal stick, bent-elbow silhouette, hand contact, ball contact, and floor '
            'clearance must pass all-action close review and private 12-player review before promotion.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_DIAGONAL_STICK_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
