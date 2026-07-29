import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
JOG_ACTION = 'jog-cmu16-lower-body-audition'
SPRINT_ACTION = 'sprint-cmu-lower-body-audition'
OUTPUT_ACTION = 'jog-to-sprint'
LOWER_BODY_BONES = (
    'CC_Base_L_Thigh',
    'CC_Base_L_Calf',
    'CC_Base_L_Foot',
    'CC_Base_L_ToeBase',
    'CC_Base_R_Thigh',
    'CC_Base_R_Calf',
    'CC_Base_R_Foot',
    'CC_Base_R_ToeBase',
)
HIP_BONE = 'CC_Base_Hip'


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--jog-action', default=JOG_ACTION)
    parser.add_argument('--sprint-action', default=SPRINT_ACTION)
    parser.add_argument('--output-action', default=OUTPUT_ACTION)
    parser.add_argument('--jog-start-phase', type=float, required=True)
    parser.add_argument('--sprint-start-phase', type=float, required=True)
    parser.add_argument('--jog-cycle-advance', type=float, required=True)
    parser.add_argument('--sprint-cycle-advance', type=float, required=True)
    parser.add_argument('--output-frames', default='1,11')
    parser.add_argument('--foot-lock-side', choices=('Left', 'Right'))
    parser.add_argument('--runtime-start')
    parser.add_argument('--runtime-end')
    parser.add_argument('--lock-release-progress', type=float, default=0.7)
    parser.add_argument('--lock-height', type=float, default=0.004)
    parser.add_argument('--transfer-lock-side', choices=('Left', 'Right'))
    parser.add_argument('--transfer-start-progress', type=float, default=0.8)
    parser.add_argument('--transfer-end-progress', type=float, default=0.9)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def frame_pair(value):
    values = tuple(int(item.strip()) for item in value.split(',') if item.strip())
    if len(values) != 2 or values[1] <= values[0]:
        raise RuntimeError('output-frames must contain two increasing frame numbers.')
    return values


def set_fractional_frame(frame):
    whole = math.floor(frame)
    bpy.context.scene.frame_set(whole, subframe=frame - whole)
    bpy.context.view_layer.update()


def sample_pose(armature, action, phase):
    for bone in armature.pose.bones:
        bone.matrix_basis.identity()
    armature.animation_data.action = action
    start, end = action.frame_range
    frame = start + (phase % 1.0) * (end - start)
    set_fractional_frame(frame)
    return {
        bone.name: bone.matrix_basis.copy().decompose()
        for bone in armature.pose.bones
    }


def smoothstep(value):
    return value * value * (3.0 - 2.0 * value)


def blend_transform(source, target, weight):
    source_location, source_rotation, source_scale = source
    target_location, target_rotation, target_scale = target
    return (
        source_location.lerp(target_location, weight),
        source_rotation.slerp(target_rotation, weight),
        source_scale.lerp(target_scale, weight),
    )


def rotation_error_degrees(first, second):
    return math.degrees(first.rotation_difference(second).angle)


def transform_triplet(value, label):
    values = tuple(float(item.strip()) for item in value.split(',') if item.strip())
    if len(values) != 3:
        raise RuntimeError(f'{label} must contain x,z,rotation.')
    return values


def shoe_objects(side):
    token = f'_Shoe_{side}_'
    return [
        obj for obj in bpy.data.objects
        if obj.type == 'MESH' and token in obj.name and obj.name.startswith('GS_Home_')
    ]


def evaluated_shoe_sample(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    if not points:
        raise RuntimeError('The transition foot lock found no evaluated shoe vertices.')
    return {
        'centerX': sum(point.x for point in points) / len(points),
        'centerY': sum(point.y for point in points) / len(points),
        'minimumZ': min(point.z for point in points),
    }


def translate_pose_bone_in_world(armature, bone, delta_world):
    """Move a pose bone by a measured world-space mesh delta."""
    delta_armature = armature.matrix_world.inverted().to_3x3() @ delta_world
    pose_matrix = bone.matrix.copy()
    pose_matrix.translation += delta_armature
    bone.matrix = pose_matrix


def local_to_runtime_world(local_x, local_y, runtime_transform):
    group_x, group_z, rotation = runtime_transform
    local_z = -local_y
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    return Vector((
        group_x + cosine * local_x + sine * local_z,
        group_z - sine * local_x + cosine * local_z,
    ))


def runtime_world_to_local(world, runtime_transform):
    group_x, group_z, rotation = runtime_transform
    delta_x = world.x - group_x
    delta_z = world.y - group_z
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    local_x = cosine * delta_x - sine * delta_z
    local_z = sine * delta_x + cosine * delta_z
    return Vector((local_x, -local_z))


def interpolated_transform(start, end, progress):
    return tuple(start[index] + (end[index] - start[index]) * progress for index in range(3))


def lock_weight_at(progress, release_progress):
    release = max(0.0, min(1.0, (progress - release_progress) / (1 - release_progress)))
    return 1.0 - smoothstep(release)


def primary_lock_weight(progress, release_progress, transfer_side, transfer_start):
    if transfer_side:
        return 1.0 if progress <= transfer_start else 0.0
    return lock_weight_at(progress, release_progress)


def main():
    args = parse_args()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    output_start, output_end = frame_pair(args.output_frames)
    if bool(args.foot_lock_side) != bool(args.runtime_start and args.runtime_end):
        raise RuntimeError('Foot locking requires side, runtime-start, and runtime-end together.')
    runtime_start = transform_triplet(args.runtime_start, 'runtime-start') if args.runtime_start else None
    runtime_end = transform_triplet(args.runtime_end, 'runtime-end') if args.runtime_end else None
    if not 0 <= args.lock_release_progress < 1:
        raise RuntimeError('lock-release-progress must be at least 0 and less than 1.')
    if args.transfer_lock_side and not args.foot_lock_side:
        raise RuntimeError('Transfer locking requires a primary foot lock.')
    if args.transfer_lock_side and not (
        0 < args.transfer_start_progress < args.transfer_end_progress < 1
    ):
        raise RuntimeError('Transfer lock progress must contain two increasing values between zero and one.')
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get(ARMATURE_NAME)
    jog = bpy.data.actions.get(args.jog_action)
    sprint = bpy.data.actions.get(args.sprint_action)
    if armature is None or jog is None or sprint is None:
        raise RuntimeError('Captured jog/sprint transition inputs are incomplete.')
    armature.animation_data_create()

    existing = bpy.data.actions.get(args.output_action)
    if existing is not None:
        bpy.data.actions.remove(existing)
    transition = bpy.data.actions.new(args.output_action)
    transition.use_fake_user = True
    armature.animation_data.action = transition

    previous_rotations = {}
    maximum_step = 0.0
    frame_records = []
    lock_shoes = shoe_objects(args.foot_lock_side) if args.foot_lock_side else []
    transfer_shoes = shoe_objects(args.transfer_lock_side) if args.transfer_lock_side else []
    if args.foot_lock_side and len(lock_shoes) < 2:
        raise RuntimeError(f'Missing authored {args.foot_lock_side.lower()} shoe meshes for locking.')
    if args.transfer_lock_side and len(transfer_shoes) < 2:
        raise RuntimeError(f'Missing authored {args.transfer_lock_side.lower()} shoe meshes for transfer locking.')
    lock_anchor_world = None
    for frame in range(output_start, output_end + 1):
        progress = (frame - output_start) / (output_end - output_start)
        weight = smoothstep(progress)
        jog_phase = args.jog_start_phase + args.jog_cycle_advance * progress
        sprint_phase = args.sprint_start_phase + args.sprint_cycle_advance * progress
        jog_pose = sample_pose(armature, jog, jog_phase)
        sprint_pose = sample_pose(armature, sprint, sprint_phase)
        armature.animation_data.action = None

        for bone_name, bone in armature.pose.bones.items():
            location, rotation, scale = blend_transform(
                jog_pose[bone_name],
                sprint_pose[bone_name],
                weight,
            )
            bone.rotation_mode = 'QUATERNION'
            previous = previous_rotations.get(bone_name)
            if previous is not None and rotation.dot(previous) < 0:
                rotation.negate()
            if previous is not None and bone_name in LOWER_BODY_BONES:
                maximum_step = max(maximum_step, rotation_error_degrees(previous, rotation))
            previous_rotations[bone_name] = rotation.copy()
            bone.location = location
            bone.rotation_quaternion = rotation
            bone.scale = scale

        lock_record = None
        if args.foot_lock_side:
            runtime_transform = interpolated_transform(runtime_start, runtime_end, progress)
            bpy.context.view_layer.update()
            current = evaluated_shoe_sample(lock_shoes)
            if lock_anchor_world is None:
                lock_anchor_world = local_to_runtime_world(current['centerX'], current['centerY'], runtime_transform)
            lock_weight = primary_lock_weight(
                progress,
                args.lock_release_progress,
                args.transfer_lock_side,
                args.transfer_start_progress,
            )
            desired_local = runtime_world_to_local(lock_anchor_world, runtime_transform)
            hip = armature.pose.bones[HIP_BONE]
            for _ in range(3):
                current = evaluated_shoe_sample(lock_shoes)
                translate_pose_bone_in_world(
                    armature,
                    hip,
                    Vector((
                        (desired_local.x - current['centerX']) * lock_weight,
                        (desired_local.y - current['centerY']) * lock_weight,
                        (args.lock_height - current['minimumZ']) * lock_weight,
                    )),
                )
                bpy.context.view_layer.update()
            corrected = evaluated_shoe_sample(lock_shoes)
            corrected_world = local_to_runtime_world(corrected['centerX'], corrected['centerY'], runtime_transform)
            lock_record = {
                'side': args.foot_lock_side,
                'weight': round(lock_weight, 4),
                'desiredLocalX': round(desired_local.x, 4),
                'desiredLocalY': round(desired_local.y, 4),
                'correctedLocalX': round(corrected['centerX'], 4),
                'correctedLocalY': round(corrected['centerY'], 4),
                'worldErrorMm': round((corrected_world - lock_anchor_world).length * 1000, 3),
                'minimumHeightMeters': round(corrected['minimumZ'], 4),
            }

        final_pose = {
            bone.name: (
                bone.location.copy(),
                bone.rotation_quaternion.copy(),
                bone.scale.copy(),
            )
            for bone in armature.pose.bones
        }
        armature.animation_data.action = transition
        for bone in armature.pose.bones:
            location, rotation, scale = final_pose[bone.name]
            bone.location = location
            bone.rotation_quaternion = rotation
            bone.scale = scale
            bone.keyframe_insert('location', frame=frame)
            bone.keyframe_insert('rotation_quaternion', frame=frame)
            bone.keyframe_insert('scale', frame=frame)

        frame_records.append({
            'frame': frame,
            'progress': round(progress, 4),
            'jogPhase': round(jog_phase % 1.0, 4),
            'sprintPhase': round(sprint_phase % 1.0, 4),
            'blendWeight': round(weight, 4),
            'footLock': lock_record,
        })

    if args.foot_lock_side:
        hip = armature.pose.bones[HIP_BONE]
        for _ in range(4):
            armature.animation_data.action = transition
            for frame in range(output_start, output_end + 1):
                progress = (frame - output_start) / (output_end - output_start)
                lock_weight = primary_lock_weight(
                    progress,
                    args.lock_release_progress,
                    args.transfer_lock_side,
                    args.transfer_start_progress,
                )
                if lock_weight <= 0:
                    continue
                runtime_transform = interpolated_transform(runtime_start, runtime_end, progress)
                desired_local = runtime_world_to_local(lock_anchor_world, runtime_transform)
                bpy.context.scene.frame_set(frame)
                bpy.context.view_layer.update()
                current = evaluated_shoe_sample(lock_shoes)
                translate_pose_bone_in_world(
                    armature,
                    hip,
                    Vector((
                        (desired_local.x - current['centerX']) * lock_weight,
                        (desired_local.y - current['centerY']) * lock_weight,
                        (args.lock_height - current['minimumZ']) * lock_weight,
                    )),
                )
                bpy.context.view_layer.update()
                hip.keyframe_insert('location', frame=frame)

        transfer_anchor_world = None
        if args.transfer_lock_side:
            transfer_frame = round(
                output_start + args.transfer_start_progress * (output_end - output_start)
            )
            transfer_progress = (transfer_frame - output_start) / (output_end - output_start)
            transfer_runtime = interpolated_transform(runtime_start, runtime_end, transfer_progress)
            bpy.context.scene.frame_set(transfer_frame)
            bpy.context.view_layer.update()
            transfer_start_sample = evaluated_shoe_sample(transfer_shoes)
            transfer_anchor_world = local_to_runtime_world(
                transfer_start_sample['centerX'],
                transfer_start_sample['centerY'],
                transfer_runtime,
            )
            for _ in range(4):
                armature.animation_data.action = transition
                for frame in range(transfer_frame + 1, output_end + 1):
                    progress = (frame - output_start) / (output_end - output_start)
                    if progress > args.transfer_end_progress:
                        continue
                    runtime_transform = interpolated_transform(runtime_start, runtime_end, progress)
                    desired_local = runtime_world_to_local(transfer_anchor_world, runtime_transform)
                    bpy.context.scene.frame_set(frame)
                    bpy.context.view_layer.update()
                    current = evaluated_shoe_sample(transfer_shoes)
                    translate_pose_bone_in_world(
                        armature,
                        hip,
                        Vector((
                            desired_local.x - current['centerX'],
                            desired_local.y - current['centerY'],
                            args.lock_height - current['minimumZ'],
                        )),
                    )
                    bpy.context.view_layer.update()
                    hip.keyframe_insert('location', frame=frame)

        for record in frame_records:
            frame = record['frame']
            progress = record['progress']
            runtime_transform = interpolated_transform(runtime_start, runtime_end, progress)
            desired_local = runtime_world_to_local(lock_anchor_world, runtime_transform)
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            corrected = evaluated_shoe_sample(lock_shoes)
            corrected_world = local_to_runtime_world(corrected['centerX'], corrected['centerY'], runtime_transform)
            record['footLock'].update({
                'desiredLocalX': round(desired_local.x, 4),
                'desiredLocalY': round(desired_local.y, 4),
                'correctedLocalX': round(corrected['centerX'], 4),
                'correctedLocalY': round(corrected['centerY'], 4),
                'worldErrorMm': round((corrected_world - lock_anchor_world).length * 1000, 3),
                'minimumHeightMeters': round(corrected['minimumZ'], 4),
            })
            if transfer_anchor_world and args.transfer_start_progress <= progress <= args.transfer_end_progress:
                transfer_sample = evaluated_shoe_sample(transfer_shoes)
                transfer_world = local_to_runtime_world(
                    transfer_sample['centerX'],
                    transfer_sample['centerY'],
                    runtime_transform,
                )
                record['transferLock'] = {
                    'side': args.transfer_lock_side,
                    'worldErrorMm': round((transfer_world - transfer_anchor_world).length * 1000, 3),
                    'minimumHeightMeters': round(transfer_sample['minimumZ'], 4),
                }

    armature.animation_data.action = transition
    bpy.context.scene.frame_start = output_start
    bpy.context.scene.frame_end = output_end
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_set(output_start)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    report = {
        'status': 'authored-for-private-transition-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'outputWorkfile': str(output_blend),
        'armature': ARMATURE_NAME,
        'sourceActions': {'jog': args.jog_action, 'sprint': args.sprint_action},
        'outputAction': args.output_action,
        'outputFrameRange': [output_start, output_end],
        'outputFps': 30,
        'durationSeconds': round((output_end - output_start) / 30, 4),
        'jogStartPhase': round(args.jog_start_phase % 1.0, 4),
        'sprintStartPhase': round(args.sprint_start_phase % 1.0, 4),
        'jogCycleAdvance': round(args.jog_cycle_advance, 4),
        'sprintCycleAdvance': round(args.sprint_cycle_advance, 4),
        'maximumLowerBodyStepDegrees': round(maximum_step, 3),
        'keyedBoneCount': len(armature.pose.bones),
        'footLock': {
            'side': args.foot_lock_side,
            'runtimeStart': list(runtime_start) if runtime_start else None,
            'runtimeEnd': list(runtime_end) if runtime_end else None,
            'releaseProgress': args.lock_release_progress,
            'targetHeightMeters': args.lock_height,
        },
        'footTransfer': {
            'side': args.transfer_lock_side,
            'startProgress': args.transfer_start_progress,
            'endProgress': args.transfer_end_progress,
        } if args.transfer_lock_side else None,
        'frameRecords': frame_records,
        'reviewRule': 'The authored bridge must pass private runtime transition telemetry and close multi-angle deformation review before promotion.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CMU_TRANSITION_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
