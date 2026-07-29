import argparse
import json
import math
import sys
from pathlib import Path

import bpy


LOWER_BODY_SUFFIXES = (
    'lfemur',
    'ltibia',
    'lfoot',
    'ltoes',
    'rfemur',
    'rtibia',
    'rfoot',
    'rtoes',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--rig-name', required=True)
    parser.add_argument('--action-name', required=True)
    parser.add_argument('--subject-prefix', required=True)
    parser.add_argument('--minimum-frame-span', type=int, default=60)
    parser.add_argument('--maximum-frame-span', type=int, default=130)
    parser.add_argument('--target-cycle-distance', type=float, default=1.8139)
    parser.add_argument('--candidate-count', type=int, default=20)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def direction(pose_bone):
    value = pose_bone.tail - pose_bone.head
    if value.length < 0.0001:
        raise RuntimeError(f'Collapsed source bone: {pose_bone.name}')
    return value.normalized()


def angle(left, right):
    dot = max(-1.0, min(1.0, left.dot(right)))
    return math.degrees(math.acos(dot))


def rounded(value):
    return round(value, 4)


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    armature = bpy.data.objects.get(args.rig_name)
    action = bpy.data.actions.get(args.action_name)
    if armature is None or action is None:
        raise RuntimeError('The requested captured source rig or action is missing.')
    armature.animation_data_create()
    armature.animation_data.action = action
    start = int(math.ceil(action.frame_range[0]))
    end = int(math.floor(action.frame_range[1]))
    bone_names = [f'{args.subject_prefix}_{suffix}' for suffix in LOWER_BODY_SUFFIXES]
    root_name = f'{args.subject_prefix}_root'
    foot_names = {
        'left': (f'{args.subject_prefix}_lfoot', f'{args.subject_prefix}_ltoes'),
        'right': (f'{args.subject_prefix}_rfoot', f'{args.subject_prefix}_rtoes'),
    }

    samples = {}
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        root = armature.pose.bones[root_name].head.copy()
        clearances = {}
        for side, names in foot_names.items():
            points = []
            for name in names:
                bone = armature.pose.bones[name]
                points.extend((bone.head.z, bone.tail.z))
            clearances[side] = min(points)
        samples[frame] = {
            'root': root,
            'directions': {name: direction(armature.pose.bones[name]).copy() for name in bone_names},
            'clearances': clearances,
        }

    candidates = []
    for first in range(start, end + 1):
        minimum_end = first + args.minimum_frame_span
        maximum_end = min(first + args.maximum_frame_span, end)
        for last in range(minimum_end, maximum_end + 1):
            angles = [
                angle(samples[first]['directions'][name], samples[last]['directions'][name])
                for name in bone_names
            ]
            path = 0.0
            for frame in range(first + 1, last + 1):
                delta = samples[frame]['root'] - samples[frame - 1]['root']
                path += math.hypot(delta.x, delta.y)
            duration = (last - first) / bpy.context.scene.render.fps
            distance_error = abs(path - args.target_cycle_distance)
            mean_angle = sum(angles) / len(angles)
            maximum_angle = max(angles)
            clearance_delta = sum(
                abs(samples[first]['clearances'][side] - samples[last]['clearances'][side])
                for side in foot_names
            )
            score = (
                mean_angle
                + maximum_angle * 0.65
                + distance_error * 8.0
                + clearance_delta * 20.0
            )
            candidates.append({
                'frames': [first, last],
                'frameSpan': last - first,
                'sourceDurationSeconds': rounded(duration),
                'sourceRootTravelMeters': rounded(path),
                'sourceAverageSpeedMps': rounded(path / duration),
                'distanceErrorMeters': rounded(distance_error),
                'loopSeamMeanAngleDegrees': rounded(mean_angle),
                'loopSeamMaximumAngleDegrees': rounded(maximum_angle),
                'footClearanceDeltaMeters': rounded(clearance_delta),
                'score': rounded(score),
            })

    candidates.sort(key=lambda item: item['score'])
    report = {
        'status': 'analyzed-for-loop-selection',
        'decision': 'not-retarget-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'rig': args.rig_name,
        'action': args.action_name,
        'sourceFrameRange': [start, end],
        'sourceFps': bpy.context.scene.render.fps,
        'targetCycleDistanceMeters': args.target_cycle_distance,
        'minimumFrameSpan': args.minimum_frame_span,
        'maximumFrameSpan': args.maximum_frame_span,
        'candidates': candidates[:args.candidate_count],
        'selectionRule': 'Choose a same-phase lower-body loop with low seam error and credible root travel, then confirm the loop visually before retargeting.',
    }
    output_report.parent.mkdir(parents=True, exist_ok=True)
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CMU_GAIT_LOOPS_ANALYZED ' + str(output_report))


if __name__ == '__main__':
    main()
