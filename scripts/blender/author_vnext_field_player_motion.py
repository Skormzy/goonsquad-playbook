import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ANIMATED_BONES = (
    'CC_Base_Waist',
    'CC_Base_Spine01',
    'CC_Base_Spine02',
    'CC_Base_Head',
    'CC_Base_L_Upperarm',
    'CC_Base_R_Upperarm',
    'CC_Base_L_Forearm',
    'CC_Base_R_Forearm',
    'CC_Base_L_Hand',
    'CC_Base_R_Hand',
    'CC_Base_L_Thigh',
    'CC_Base_R_Thigh',
    'CC_Base_L_Calf',
    'CC_Base_R_Calf',
    'CC_Base_L_Foot',
    'CC_Base_R_Foot',
)


READY_DIRECTIONS = {
    'CC_Base_Waist': (0.0, -0.10, 0.995),
    'CC_Base_Spine01': (0.0, -0.14, 0.990),
    'CC_Base_Spine02': (0.0, -0.17, 0.985),
    'CC_Base_Head': (0.0, 0.02, 1.0),
    'CC_Base_L_Upperarm': (0.42, -0.42, -0.80),
    'CC_Base_R_Upperarm': (-0.42, -0.42, -0.80),
    'CC_Base_L_Forearm': (-0.22, -0.64, -0.74),
    'CC_Base_R_Forearm': (0.22, -0.64, -0.74),
    'CC_Base_L_Hand': (-0.10, -0.84, -0.53),
    'CC_Base_R_Hand': (0.10, -0.84, -0.53),
    'CC_Base_L_Thigh': (0.10, -0.22, -0.97),
    'CC_Base_R_Thigh': (-0.10, -0.22, -0.97),
    'CC_Base_L_Calf': (-0.02, 0.31, -0.95),
    'CC_Base_R_Calf': (0.02, 0.31, -0.95),
    'CC_Base_L_Foot': (0.02, -0.995, -0.08),
    'CC_Base_R_Foot': (-0.02, -0.995, -0.08),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def normalized(direction):
    return tuple(Vector(direction).normalized())


def with_overrides(base, overrides):
    result = dict(base)
    result.update({name: normalized(direction) for name, direction in overrides.items()})
    return result


def pose(frame, directions, lateral_cm=0.0, forward_cm=0.0, flight_cm=0.0, tag='contact'):
    return {
        'frame': frame,
        'directions': directions,
        'lateralCm': lateral_cm,
        'forwardCm': forward_cm,
        'flightCm': flight_cm,
        'tag': tag,
    }


def run_pose(side, intensity=1.0, crossing=False):
    lean = 0.18 + 0.20 * intensity
    torso = {
        'CC_Base_Waist': (0.0, -lean * 0.72, 1.0),
        'CC_Base_Spine01': (0.0, -lean * 0.90, 1.0),
        'CC_Base_Spine02': (0.0, -lean, 1.0),
        'CC_Base_Head': (0.0, 0.08, 1.0),
    }
    if crossing:
        return with_overrides(READY_DIRECTIONS, {
            **torso,
            'CC_Base_L_Thigh': (0.04, -0.12 * side, -0.99),
            'CC_Base_R_Thigh': (-0.04, 0.12 * side, -0.99),
            'CC_Base_L_Calf': (-0.02, -0.34, -0.94),
            'CC_Base_R_Calf': (0.02, -0.34, -0.94),
            'CC_Base_L_Upperarm': (0.28, 0.22 * side, -0.94),
            'CC_Base_R_Upperarm': (-0.28, -0.22 * side, -0.94),
            'CC_Base_L_Forearm': (-0.16, -0.72, -0.67),
            'CC_Base_R_Forearm': (0.16, -0.72, -0.67),
        })

    forward = 0.40 + 0.30 * intensity
    rear = 0.28 + 0.22 * intensity
    rear_calf_y = -(0.45 + 0.25 * intensity)
    rear_calf_z = math.sqrt(max(0.01, 1 - rear_calf_y * rear_calf_y))
    if side > 0:
        leg_overrides = {
            'CC_Base_L_Thigh': (0.05, -forward, -0.84),
            'CC_Base_R_Thigh': (-0.05, rear, -0.92),
            'CC_Base_L_Calf': (-0.02, 0.08, -0.997),
            'CC_Base_R_Calf': (0.02, rear_calf_y, -rear_calf_z),
            'CC_Base_L_Upperarm': (0.27, 0.30, -0.91),
            'CC_Base_R_Upperarm': (-0.27, -0.52, -0.81),
            'CC_Base_L_Forearm': (-0.10, -0.25, -0.96),
            'CC_Base_R_Forearm': (0.12, -0.78, -0.61),
        }
    else:
        leg_overrides = {
            'CC_Base_L_Thigh': (0.05, rear, -0.92),
            'CC_Base_R_Thigh': (-0.05, -forward, -0.84),
            'CC_Base_L_Calf': (-0.02, rear_calf_y, -rear_calf_z),
            'CC_Base_R_Calf': (0.02, 0.08, -0.997),
            'CC_Base_L_Upperarm': (0.27, -0.52, -0.81),
            'CC_Base_R_Upperarm': (-0.27, 0.30, -0.91),
            'CC_Base_L_Forearm': (-0.12, -0.78, -0.61),
            'CC_Base_R_Forearm': (0.10, -0.25, -0.96),
        }
    return with_overrides(READY_DIRECTIONS, {**torso, **leg_overrides})


def action_specs():
    ready_left = with_overrides(READY_DIRECTIONS, {
        'CC_Base_Waist': (-0.025, -0.10, 0.995),
        'CC_Base_L_Thigh': (0.12, -0.24, -0.965),
        'CC_Base_R_Thigh': (-0.08, -0.19, -0.978),
    })
    ready_right = with_overrides(READY_DIRECTIONS, {
        'CC_Base_Waist': (0.025, -0.10, 0.995),
        'CC_Base_L_Thigh': (0.08, -0.19, -0.978),
        'CC_Base_R_Thigh': (-0.12, -0.24, -0.965),
    })
    deep_ready = with_overrides(READY_DIRECTIONS, {
        'CC_Base_Waist': (0.0, -0.16, 0.987),
        'CC_Base_Spine01': (0.0, -0.20, 0.980),
        'CC_Base_Spine02': (0.0, -0.23, 0.973),
        'CC_Base_L_Thigh': (0.12, -0.34, -0.933),
        'CC_Base_R_Thigh': (-0.12, -0.34, -0.933),
        'CC_Base_L_Calf': (-0.02, 0.46, -0.888),
        'CC_Base_R_Calf': (0.02, 0.46, -0.888),
    })

    turn_plant = with_overrides(deep_ready, {
        'CC_Base_Waist': (-0.18, -0.12, 0.976),
        'CC_Base_Spine01': (-0.22, -0.16, 0.962),
        'CC_Base_Spine02': (-0.26, -0.18, 0.948),
        'CC_Base_Head': (0.28, -0.12, 0.952),
        'CC_Base_L_Thigh': (0.42, -0.30, -0.855),
        'CC_Base_R_Thigh': (-0.10, -0.18, -0.978),
        'CC_Base_L_Calf': (-0.10, 0.52, -0.848),
        'CC_Base_R_Calf': (0.04, 0.30, -0.953),
        'CC_Base_L_Foot': (0.48, -0.87, -0.08),
        'CC_Base_R_Foot': (0.30, -0.95, -0.08),
    })
    turn_cross = with_overrides(deep_ready, {
        'CC_Base_Waist': (-0.27, -0.08, 0.959),
        'CC_Base_Spine01': (-0.31, -0.10, 0.945),
        'CC_Base_Spine02': (-0.34, -0.11, 0.934),
        'CC_Base_Head': (0.40, -0.16, 0.902),
        'CC_Base_L_Thigh': (0.48, -0.17, -0.861),
        'CC_Base_R_Thigh': (0.28, -0.38, -0.882),
        'CC_Base_L_Calf': (-0.08, 0.30, -0.951),
        'CC_Base_R_Calf': (0.06, 0.54, -0.839),
        'CC_Base_L_Foot': (0.70, -0.71, -0.06),
        'CC_Base_R_Foot': (0.66, -0.75, -0.06),
    })

    brake = with_overrides(READY_DIRECTIONS, {
        'CC_Base_Waist': (0.0, 0.10, 0.995),
        'CC_Base_Spine01': (0.0, 0.06, 0.998),
        'CC_Base_Spine02': (0.0, 0.03, 1.0),
        'CC_Base_L_Thigh': (0.12, -0.52, -0.845),
        'CC_Base_R_Thigh': (-0.12, 0.20, -0.972),
        'CC_Base_L_Calf': (-0.02, 0.54, -0.842),
        'CC_Base_R_Calf': (0.02, 0.40, -0.916),
        'CC_Base_L_Upperarm': (0.36, -0.60, -0.71),
        'CC_Base_R_Upperarm': (-0.36, -0.60, -0.71),
        'CC_Base_L_Forearm': (-0.18, -0.73, -0.66),
        'CC_Base_R_Forearm': (0.18, -0.73, -0.66),
    })

    receive_reach = with_overrides(deep_ready, {
        'CC_Base_L_Upperarm': (0.34, -0.60, -0.72),
        'CC_Base_R_Upperarm': (-0.28, -0.56, -0.78),
        'CC_Base_L_Forearm': (-0.24, -0.90, -0.36),
        'CC_Base_R_Forearm': (0.24, -0.86, -0.45),
        'CC_Base_L_Hand': (-0.12, -0.97, -0.22),
        'CC_Base_R_Hand': (0.12, -0.97, -0.22),
    })
    receive_absorb = with_overrides(receive_reach, {
        'CC_Base_Waist': (0.0, -0.20, 0.980),
        'CC_Base_Spine02': (0.0, -0.27, 0.963),
        'CC_Base_L_Upperarm': (0.30, -0.45, -0.84),
        'CC_Base_R_Upperarm': (-0.30, -0.45, -0.84),
        'CC_Base_L_Forearm': (-0.20, -0.66, -0.72),
        'CC_Base_R_Forearm': (0.20, -0.66, -0.72),
    })

    pass_load = with_overrides(deep_ready, {
        'CC_Base_Waist': (0.12, -0.14, 0.983),
        'CC_Base_Spine01': (0.18, -0.17, 0.969),
        'CC_Base_Spine02': (0.24, -0.18, 0.954),
        'CC_Base_L_Upperarm': (0.24, -0.34, -0.91),
        'CC_Base_R_Upperarm': (-0.16, 0.18, -0.97),
        'CC_Base_L_Forearm': (-0.30, -0.82, -0.49),
        'CC_Base_R_Forearm': (0.38, -0.46, -0.80),
        'CC_Base_L_Thigh': (0.12, -0.18, -0.977),
        'CC_Base_R_Thigh': (-0.12, -0.36, -0.925),
    })
    pass_release = with_overrides(deep_ready, {
        'CC_Base_Waist': (-0.14, -0.15, 0.979),
        'CC_Base_Spine01': (-0.20, -0.18, 0.963),
        'CC_Base_Spine02': (-0.27, -0.20, 0.942),
        'CC_Base_L_Upperarm': (0.44, -0.57, -0.69),
        'CC_Base_R_Upperarm': (-0.32, -0.64, -0.70),
        'CC_Base_L_Forearm': (-0.20, -0.94, -0.28),
        'CC_Base_R_Forearm': (0.26, -0.90, -0.35),
        'CC_Base_L_Thigh': (0.14, -0.40, -0.905),
        'CC_Base_R_Thigh': (-0.10, -0.16, -0.982),
    })
    pass_follow = with_overrides(pass_release, {
        'CC_Base_Waist': (-0.22, -0.10, 0.970),
        'CC_Base_Spine02': (-0.34, -0.14, 0.930),
        'CC_Base_L_Upperarm': (0.48, -0.66, -0.58),
        'CC_Base_R_Upperarm': (-0.38, -0.71, -0.59),
    })

    shot_load = with_overrides(pass_load, {
        'CC_Base_Waist': (0.18, -0.18, 0.967),
        'CC_Base_Spine02': (0.32, -0.21, 0.924),
        'CC_Base_L_Thigh': (0.14, -0.16, -0.977),
        'CC_Base_R_Thigh': (-0.16, -0.44, -0.883),
        'CC_Base_R_Calf': (0.03, 0.54, -0.841),
    })
    shot_release = with_overrides(pass_release, {
        'CC_Base_Waist': (-0.20, -0.21, 0.957),
        'CC_Base_Spine01': (-0.28, -0.22, 0.935),
        'CC_Base_Spine02': (-0.38, -0.24, 0.893),
        'CC_Base_L_Upperarm': (0.52, -0.63, -0.58),
        'CC_Base_R_Upperarm': (-0.42, -0.70, -0.58),
        'CC_Base_L_Forearm': (-0.16, -0.97, -0.18),
        'CC_Base_R_Forearm': (0.20, -0.95, -0.24),
        'CC_Base_L_Thigh': (0.18, -0.47, -0.864),
        'CC_Base_R_Thigh': (-0.10, -0.14, -0.985),
    })
    shot_follow = with_overrides(shot_release, {
        'CC_Base_Waist': (-0.28, -0.14, 0.950),
        'CC_Base_Spine02': (-0.46, -0.16, 0.873),
        'CC_Base_L_Upperarm': (0.58, -0.68, -0.45),
        'CC_Base_R_Upperarm': (-0.48, -0.74, -0.47),
    })

    return {
        'ready': [
            pose(1, READY_DIRECTIONS), pose(11, ready_left, lateral_cm=-1.5),
            pose(21, READY_DIRECTIONS), pose(31, ready_right, lateral_cm=1.5),
            pose(41, READY_DIRECTIONS),
        ],
        'jog': [
            pose(1, run_pose(1, 0.65)), pose(9, run_pose(1, 0.65, True), flight_cm=2.0, tag='flight'),
            pose(17, run_pose(-1, 0.65)), pose(25, run_pose(-1, 0.65, True), flight_cm=2.0, tag='flight'),
            pose(33, run_pose(1, 0.65)),
        ],
        'sprint': [
            pose(1, run_pose(1, 1.0)), pose(8, run_pose(1, 1.0, True), flight_cm=4.0, tag='flight'),
            pose(15, run_pose(-1, 1.0)), pose(22, run_pose(-1, 1.0, True), flight_cm=4.0, tag='flight'),
            pose(29, run_pose(1, 1.0)),
        ],
        'turn': [
            pose(1, READY_DIRECTIONS), pose(8, turn_plant, lateral_cm=-2.0),
            pose(16, turn_cross, lateral_cm=-5.0, flight_cm=1.0, tag='pivot'),
            pose(24, turn_plant, lateral_cm=-3.0), pose(32, READY_DIRECTIONS),
        ],
        'stop': [
            pose(1, run_pose(1, 0.9)), pose(8, run_pose(1, 0.9, True), forward_cm=-2.0, flight_cm=2.0, tag='flight'),
            pose(16, brake, forward_cm=-4.0), pose(24, deep_ready, forward_cm=-4.0),
            pose(32, READY_DIRECTIONS),
        ],
        'receive': [
            pose(1, READY_DIRECTIONS), pose(8, receive_reach, forward_cm=-1.0),
            pose(16, receive_absorb, forward_cm=-2.0), pose(24, deep_ready, forward_cm=-1.0),
            pose(32, READY_DIRECTIONS),
        ],
        'pass': [
            pose(1, READY_DIRECTIONS), pose(8, pass_load, lateral_cm=2.0),
            pose(16, pass_release, lateral_cm=-1.0), pose(24, pass_follow, lateral_cm=-2.0),
            pose(32, READY_DIRECTIONS),
        ],
        'shot': [
            pose(1, READY_DIRECTIONS), pose(10, shot_load, lateral_cm=2.5),
            pose(20, shot_release, lateral_cm=-1.5), pose(29, shot_follow, lateral_cm=-3.0),
            pose(38, READY_DIRECTIONS),
        ],
    }


def reset_pose(armature):
    for bone in armature.pose.bones:
        bone.matrix_basis.identity()
        bone.rotation_mode = 'QUATERNION'
        bone.location = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()


def aim_bone(armature, bone_name, direction):
    pose_bone = armature.pose.bones.get(bone_name)
    if pose_bone is None:
        raise KeyError(f'Missing motion bone: {bone_name}')
    target_y = Vector(direction).normalized()
    rest_x = pose_bone.bone.matrix_local.to_3x3().col[0].normalized()
    target_x = rest_x - target_y * rest_x.dot(target_y)
    if target_x.length < 0.001:
        fallback = Vector((1, 0, 0)) if abs(target_y.x) < 0.9 else Vector((0, 0, 1))
        target_x = fallback - target_y * fallback.dot(target_y)
    target_x.normalize()
    target_z = target_x.cross(target_y).normalized()
    target_x = target_y.cross(target_z).normalized()
    matrix = Matrix((target_x, target_y, target_z)).transposed().to_4x4()
    matrix.translation = pose_bone.head
    pose_bone.matrix = matrix
    bpy.context.view_layer.update()


def evaluated_min_z(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for mesh in meshes:
        evaluated = mesh.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    return min(point.z for point in points)


def key_pose(armature, meshes, frame_spec, previous_quaternions):
    scene = bpy.context.scene
    scene.frame_set(frame_spec['frame'])
    reset_pose(armature)
    for bone_name in ANIMATED_BONES:
        aim_bone(armature, bone_name, frame_spec['directions'][bone_name])

    hip = armature.pose.bones.get('CC_Base_Hip')
    if hip is None:
        raise KeyError('Missing motion root bone: CC_Base_Hip')
    hip.location = (0.0, 0.0, 0.0)
    armature.location = (
        frame_spec['lateralCm'] / 100,
        frame_spec['forwardCm'] / 100,
        0.0,
    )
    bpy.context.view_layer.update()
    ground_error = evaluated_min_z(meshes)
    armature.location.z -= ground_error
    armature.location.z += frame_spec['flightCm'] / 100
    bpy.context.view_layer.update()

    hip.keyframe_insert('location', frame=frame_spec['frame'])
    armature.keyframe_insert('location', frame=frame_spec['frame'])
    for bone_name in ANIMATED_BONES:
        bone = armature.pose.bones[bone_name]
        quaternion = bone.rotation_quaternion.copy()
        previous = previous_quaternions.get(bone_name)
        if previous is not None and quaternion.dot(previous) < 0:
            quaternion.negate()
            bone.rotation_quaternion = quaternion
        previous_quaternions[bone_name] = quaternion.copy()
        bone.keyframe_insert('rotation_quaternion', frame=frame_spec['frame'])
        bone.keyframe_insert('location', frame=frame_spec['frame'])

    return {
        'frame': frame_spec['frame'],
        'tag': frame_spec['tag'],
        'minimumWorldZ': round(evaluated_min_z(meshes), 4),
    }


def set_interpolation(action):
    for fcurve in getattr(action, 'fcurves', []):
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = 'BEZIER'
            keyframe.handle_left_type = 'AUTO_CLAMPED'
            keyframe.handle_right_type = 'AUTO_CLAMPED'


def bake_nonpenetration(armature, meshes, action, start, end):
    armature.animation_data.action = action
    corrections = []
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        minimum_z = evaluated_min_z(meshes)
        correction = max(0.0, -minimum_z)
        if correction > 0:
            armature.location.z += correction
            armature.keyframe_insert('location', frame=frame)
            bpy.context.view_layer.update()
        corrections.append(correction)
    return {
        'correctedFrameCount': sum(1 for value in corrections if value > 0.0001),
        'maximumCorrectionMeters': round(max(corrections, default=0.0), 4),
    }


def main():
    args = parse_args()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if armature is None:
        raise RuntimeError('The accepted vNext field-player rig is missing.')

    meshes = [
        obj for obj in bpy.data.objects
        if obj.type == 'MESH'
        and obj.name != 'GS_SourceReview_Floor'
        and not obj.name.startswith('GS_Away_')
        and '_Stick_' not in obj.name
    ]
    if not meshes:
        raise RuntimeError('No field-player meshes are available for contact authoring.')

    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    armature.animation_data_create()
    bpy.context.scene.render.fps = 30

    clips = []
    for clip_name, key_specs in action_specs().items():
        action = bpy.data.actions.new(clip_name)
        action.use_fake_user = True
        armature.animation_data.action = action
        previous_quaternions = {}
        keyframes = [key_pose(armature, meshes, spec, previous_quaternions) for spec in key_specs]
        action.frame_range = (key_specs[0]['frame'], key_specs[-1]['frame'])
        set_interpolation(action)
        grounding = bake_nonpenetration(
            armature,
            meshes,
            action,
            key_specs[0]['frame'],
            key_specs[-1]['frame'],
        )
        set_interpolation(action)
        clips.append({
            'name': clip_name,
            'frameRange': [key_specs[0]['frame'], key_specs[-1]['frame']],
            'durationSeconds': round((key_specs[-1]['frame'] - key_specs[0]['frame']) / 30, 3),
            'keyframes': keyframes,
            'startsGrounded': keyframes[0]['minimumWorldZ'] <= 0.012,
            'endsGrounded': keyframes[-1]['minimumWorldZ'] <= 0.012,
            'groundingBake': grounding,
        })

    armature.animation_data.action = bpy.data.actions.get('ready')
    bpy.context.scene.frame_set(1)
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    report = {
        'status': 'authored-for-human-review',
        'decision': 'not-production-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'outputWorkfile': str(output_blend),
        'sourceQuality': 'internally-authored-high-quality-action-clip-candidate',
        'captureMethod': 'hand-authored-reference-animation',
        'requiredClipNames': ['ready', 'jog', 'sprint', 'turn', 'stop', 'receive', 'pass', 'shot'],
        'missingClipNames': [],
        'clips': clips,
        'approvalRule': 'Human real-time and multi-angle review is required. Authored keyframes and contact metrics cannot approve motion by themselves.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_MOTION_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
