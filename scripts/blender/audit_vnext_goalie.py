import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


CLIPS = ('goalie-ready', 'goalie-shuffle', 'goalie-set', 'goalie-save-glove', 'goalie-save-blocker')
LOOPS = {'goalie-ready', 'goalie-shuffle'}
ANIMATED_BONES = (
    'CC_Base_Waist', 'CC_Base_Spine01', 'CC_Base_Spine02', 'CC_Base_Head',
    'CC_Base_L_Upperarm', 'CC_Base_R_Upperarm', 'CC_Base_L_Forearm', 'CC_Base_R_Forearm',
    'CC_Base_L_Hand', 'CC_Base_R_Hand', 'CC_Base_L_Thigh', 'CC_Base_R_Thigh',
    'CC_Base_L_Calf', 'CC_Base_R_Calf', 'CC_Base_L_Foot', 'CC_Base_R_Foot',
)
REQUIRED_GROUPS = ('jersey', 'padded-pants', 'leg-pad', 'shoe', 'catch-glove', 'blocker', 'mask', 'goalie-stick')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def world_bounds(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def pose_snapshot(armature):
    return {name: armature.pose.bones[name].matrix_basis.to_quaternion().normalized() for name in ANIMATED_BONES}


def max_pose_difference(left, right):
    return max(math.degrees(left[name].rotation_difference(right[name]).angle) for name in ANIMATED_BONES)


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    armature = bpy.data.objects.get('GS_Goalie_Rig')
    body = bpy.data.objects.get('CC_Base_Body')
    home = bpy.data.collections.get('GS_Goalie_Home')
    away = bpy.data.collections.get('GS_Goalie_Away')
    if armature is None or body is None or home is None or away is None:
        raise RuntimeError('The authored vNext goalie workfile is incomplete.')

    home_objects = [obj for obj in home.all_objects if obj.type == 'MESH']
    away_objects = [obj for obj in away.all_objects if obj.type == 'MESH']
    active_meshes = [body] + home_objects
    home_groups = sorted(set(obj.get('goalie_equipment_group') for obj in home_objects if obj.get('goalie_equipment_group')))
    away_groups = sorted(set(obj.get('goalie_equipment_group') for obj in away_objects if obj.get('goalie_equipment_group')))

    armature.animation_data_create()
    snapshots = {}
    clips = []
    for clip_name in CLIPS:
        action = bpy.data.actions.get(clip_name)
        if action is None:
            raise RuntimeError(f'Missing goalie action: {clip_name}')
        armature.animation_data.action = action
        start = int(math.ceil(action.frame_range[0]))
        end = int(math.floor(action.frame_range[1]))
        poses = []
        roots = []
        minimum_heights = []
        max_frame_delta = 0.0
        max_excursion = 0.0
        previous = None
        start_pose = None
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            current = pose_snapshot(armature)
            if start_pose is None:
                start_pose = current
            if previous is not None:
                max_frame_delta = max(max_frame_delta, max_pose_difference(previous, current))
            max_excursion = max(max_excursion, max_pose_difference(start_pose, current))
            previous = current
            poses.append(current)
            roots.append(tuple(armature.location))
            minimum_heights.append(world_bounds(active_meshes)[0].z)
        snapshots[clip_name] = {'start': poses[0], 'end': poses[-1]}
        loop_delta = max_pose_difference(poses[0], poses[-1]) if clip_name in LOOPS else None
        clips.append({
            'clipName': clip_name,
            'frameRange': [start, end],
            'frameCount': end - start + 1,
            'durationSeconds': round((end - start) / bpy.context.scene.render.fps, 3),
            'maxFrameRotationDeltaDegrees': round(max_frame_delta, 3),
            'maxPoseExcursionFromStartDegrees': round(max_excursion, 3),
            'loopClosureMaxRotationDegrees': round(loop_delta, 3) if loop_delta is not None else None,
            'rootEndpointOffsetCm': round(math.dist(roots[0], roots[-1]) * 100, 3),
            'lateralTravelCm': round((max(root[0] for root in roots) - min(root[0] for root in roots)) * 100, 3),
            'minimumWorldZ': round(min(minimum_heights), 4),
            'groundedFrameCount': sum(1 for value in minimum_heights if value <= 0.015),
        })

    ready_start = snapshots['goalie-ready']['start']
    for clip in clips:
        clip['transitionOutToReadyMaxRotationDegrees'] = round(max_pose_difference(snapshots[clip['clipName']]['end'], ready_start), 3)

    armature.animation_data.action = bpy.data.actions['goalie-ready']
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    home_min, home_max = world_bounds(active_meshes)
    silhouette = {
        'widthMeters': round(home_max.x - home_min.x, 3),
        'depthMeters': round(home_max.y - home_min.y, 3),
        'heightMeters': round(home_max.z - home_min.z, 3),
        'minimumWorldZ': round(home_min.z, 4),
    }

    policy = {
        'maximumFrameRotationDeltaDegrees': 18.0,
        'maximumLoopClosureDegrees': 0.5,
        'maximumTransitionOutDegrees': 0.5,
        'maximumGroundPenetrationMeters': 0.02,
        'maximumRootEndpointOffsetCm': 0.5,
        'minimumNonReadyPoseExcursionDegrees': 12.0,
        'minimumShuffleTravelCm': 6.0,
        'minimumGoalieSilhouetteWidthMeters': 1.0,
        'minimumEquipmentObjectsPerVariant': 30,
    }
    failures = []
    for group in REQUIRED_GROUPS:
        if group not in home_groups or group not in away_groups:
            failures.append(f'missing equipment group: {group}')
    if len(home_objects) < policy['minimumEquipmentObjectsPerVariant'] or len(away_objects) < policy['minimumEquipmentObjectsPerVariant']:
        failures.append('insufficient authored equipment objects')
    if silhouette['widthMeters'] < policy['minimumGoalieSilhouetteWidthMeters']:
        failures.append('goalie silhouette width')
    for clip in clips:
        if clip['maxFrameRotationDeltaDegrees'] > policy['maximumFrameRotationDeltaDegrees']:
            failures.append(f"{clip['clipName']}: frame rotation delta")
        if clip['minimumWorldZ'] < -policy['maximumGroundPenetrationMeters']:
            failures.append(f"{clip['clipName']}: court penetration")
        if clip['rootEndpointOffsetCm'] > policy['maximumRootEndpointOffsetCm']:
            failures.append(f"{clip['clipName']}: root endpoint offset")
        if clip['loopClosureMaxRotationDegrees'] is not None and clip['loopClosureMaxRotationDegrees'] > policy['maximumLoopClosureDegrees']:
            failures.append(f"{clip['clipName']}: loop closure")
        if clip['transitionOutToReadyMaxRotationDegrees'] > policy['maximumTransitionOutDegrees']:
            failures.append(f"{clip['clipName']}: transition to ready")
        if clip['clipName'] != 'goalie-ready' and clip['maxPoseExcursionFromStartDegrees'] < policy['minimumNonReadyPoseExcursionDegrees']:
            failures.append(f"{clip['clipName']}: insufficient action excursion")
    shuffle = next(clip for clip in clips if clip['clipName'] == 'goalie-shuffle')
    if shuffle['lateralTravelCm'] < policy['minimumShuffleTravelCm']:
        failures.append('goalie-shuffle: insufficient lateral travel')

    report = {
        'status': 'passed' if not failures else 'failed',
        'decision': 'supporting-evidence-only',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'requiredActionNames': list(CLIPS),
        'requiredEquipmentGroups': list(REQUIRED_GROUPS),
        'homeEquipmentGroups': home_groups,
        'awayEquipmentGroups': away_groups,
        'homeEquipmentObjectCount': len(home_objects),
        'awayEquipmentObjectCount': len(away_objects),
        'silhouette': silhouette,
        'policy': policy,
        'failures': failures,
        'clips': clips,
        'approvalRule': 'Geometry and continuity checks support but cannot replace human close and broadcast review.',
    }
    output_report.parent.mkdir(parents=True, exist_ok=True)
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_GOALIE_AUDIT ' + str(output_report))


if __name__ == '__main__':
    main()
