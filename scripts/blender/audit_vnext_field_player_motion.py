import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


CLIPS = ('ready', 'jog', 'sprint', 'turn', 'stop', 'receive', 'pass', 'shot')
LOOPS = {'ready', 'jog', 'sprint'}
ANIMATED_BONES = (
    'CC_Base_Waist', 'CC_Base_Spine01', 'CC_Base_Spine02', 'CC_Base_Head',
    'CC_Base_L_Upperarm', 'CC_Base_R_Upperarm', 'CC_Base_L_Forearm', 'CC_Base_R_Forearm',
    'CC_Base_L_Hand', 'CC_Base_R_Hand', 'CC_Base_L_Thigh', 'CC_Base_R_Thigh',
    'CC_Base_L_Calf', 'CC_Base_R_Calf', 'CC_Base_L_Foot', 'CC_Base_R_Foot',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def evaluated_min_z(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for mesh in meshes:
        evaluated = mesh.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    return min(point.z for point in points)


def pose_snapshot(armature):
    return {
        name: armature.pose.bones[name].matrix_basis.to_quaternion().normalized()
        for name in ANIMATED_BONES
    }


def max_pose_difference(left, right):
    return max(
        math.degrees(left[name].rotation_difference(right[name]).angle)
        for name in ANIMATED_BONES
    )


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if armature is None:
        raise RuntimeError('The authored vNext field-player rig is missing.')
    meshes = [
        obj for obj in bpy.data.objects
        if obj.type == 'MESH'
        and obj.name != 'GS_SourceReview_Floor'
        and not obj.name.startswith('GS_Away_')
        and '_Stick_' not in obj.name
    ]
    if not meshes:
        raise RuntimeError('The authored vNext field-player meshes are missing.')

    armature.animation_data_create()
    snapshots = {}
    clip_reports = []
    for clip_name in CLIPS:
        action = bpy.data.actions.get(clip_name)
        if action is None:
            raise RuntimeError(f'Missing required authored action: {clip_name}')
        armature.animation_data.action = action
        start = int(math.ceil(action.frame_range[0]))
        end = int(math.floor(action.frame_range[1]))
        frame_poses = []
        hip_locations = []
        minimum_heights = []
        max_frame_delta = 0.0
        previous = None
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            current = pose_snapshot(armature)
            if previous is not None:
                max_frame_delta = max(max_frame_delta, max_pose_difference(previous, current))
            previous = current
            frame_poses.append(current)
            hip_locations.append(tuple(armature.location))
            minimum_heights.append(evaluated_min_z(meshes))
        snapshots[clip_name] = {
            'start': frame_poses[0],
            'end': frame_poses[-1],
            'startHip': hip_locations[0],
            'endHip': hip_locations[-1],
        }
        loop_delta = max_pose_difference(frame_poses[0], frame_poses[-1]) if clip_name in LOOPS else None
        clip_reports.append({
            'clipName': clip_name,
            'frameRange': [start, end],
            'frameCount': end - start + 1,
            'durationSeconds': round((end - start) / bpy.context.scene.render.fps, 3),
            'maxFrameRotationDeltaDegrees': round(max_frame_delta, 3),
            'loopClosureMaxRotationDegrees': round(loop_delta, 3) if loop_delta is not None else None,
            'rootEndpointOffsetCm': round(math.dist(hip_locations[0], hip_locations[-1]), 3),
            'minimumWorldZ': round(min(minimum_heights), 4),
            'maximumWorldZ': round(max(minimum_heights), 4),
            'groundedFrameCount': sum(1 for value in minimum_heights if value <= 0.012),
        })

    ready_start = snapshots['ready']['start']
    for clip_report in clip_reports:
        clip_name = clip_report['clipName']
        clip_report['transitionOutToReadyMaxRotationDegrees'] = round(
            max_pose_difference(snapshots[clip_name]['end'], ready_start),
            3,
        )
    stop_in_delta = max_pose_difference(snapshots['sprint']['start'], snapshots['stop']['start'])

    policy = {
        'maximumFrameRotationDeltaDegrees': 18.0,
        'maximumLoopClosureDegrees': 0.5,
        'maximumTransitionOutDegrees': 0.5,
        'maximumGroundPenetrationMeters': 0.015,
        'maximumRootEndpointOffsetCm': 0.5,
        'maximumSprintToStopEntryDegrees': 6.0,
    }
    failures = []
    for clip in clip_reports:
        if clip['maxFrameRotationDeltaDegrees'] > policy['maximumFrameRotationDeltaDegrees']:
            failures.append(f"{clip['clipName']}: frame rotation delta")
        if clip['minimumWorldZ'] < -policy['maximumGroundPenetrationMeters']:
            failures.append(f"{clip['clipName']}: court penetration")
        if clip['rootEndpointOffsetCm'] > policy['maximumRootEndpointOffsetCm']:
            failures.append(f"{clip['clipName']}: root endpoint offset")
        if clip['loopClosureMaxRotationDegrees'] is not None and clip['loopClosureMaxRotationDegrees'] > policy['maximumLoopClosureDegrees']:
            failures.append(f"{clip['clipName']}: loop closure")
        if clip['clipName'] not in LOOPS and clip['transitionOutToReadyMaxRotationDegrees'] > policy['maximumTransitionOutDegrees']:
            failures.append(f"{clip['clipName']}: transition to ready")
    if stop_in_delta > policy['maximumSprintToStopEntryDegrees']:
        failures.append('stop: sprint entry mismatch')

    report = {
        'status': 'passed' if not failures else 'failed',
        'decision': 'supporting-evidence-only',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'requiredClipNames': list(CLIPS),
        'missingClipNames': [],
        'policy': policy,
        'sprintToStopEntryMaxRotationDegrees': round(stop_in_delta, 3),
        'failures': failures,
        'clips': clip_reports,
        'approvalRule': 'Numeric continuity and contact checks cannot replace human real-time visual review.',
    }
    output_report.parent.mkdir(parents=True, exist_ok=True)
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_MOTION_AUDIT ' + str(output_report))


if __name__ == '__main__':
    main()
