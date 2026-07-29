import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


CLIPS = ('jog', 'sprint')
CONTACT_CLEARANCE_METERS = 0.015
SIDES = ('Left', 'Right')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--clips', default=','.join(CLIPS))
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


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
        raise RuntimeError('The accepted home shoe meshes produced no evaluated vertices.')
    return {
        'centerForwardMeters': sum(point.y for point in points) / len(points),
        'minimumHeightMeters': min(point.z for point in points),
    }


def circular_contact_runs(samples):
    if not samples:
        return []
    contact = [sample['minimumHeightMeters'] <= CONTACT_CLEARANCE_METERS for sample in samples]
    if not any(contact):
        return []

    runs = []
    current = []
    for index, planted in enumerate(contact):
        if planted:
            current.append(index)
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)

    if len(runs) > 1 and contact[0] and contact[-1]:
        runs[0] = runs[-1] + runs[0]
        runs.pop()
    return runs


def stance_report(samples):
    runs = circular_contact_runs(samples)
    reports = []
    for run in runs:
        forward = [samples[index]['centerForwardMeters'] for index in run]
        reports.append({
            'frames': [samples[index]['frame'] for index in run],
            'sampleCount': len(run),
            'frameSpan': max(len(run) - 1, 1),
            'forwardTravelMeters': max(forward) - min(forward),
            'minimumHeightMeters': min(samples[index]['minimumHeightMeters'] for index in run),
        })
    return max(reports, key=lambda report: report['forwardTravelMeters'], default=None)


def rounded(value):
    return round(value, 4) if value is not None else None


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    clips = tuple(name.strip() for name in args.clips.split(',') if name.strip())
    if not clips:
        raise RuntimeError('At least one locomotion clip is required.')
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if armature is None:
        raise RuntimeError('The accepted vNext field-player rig is missing.')

    shoes = {side: shoe_objects(side) for side in SIDES}
    for side, objects in shoes.items():
        if len(objects) < 2:
            raise RuntimeError(f'Missing accepted {side.lower()} shoe meshes.')

    armature.animation_data_create()
    clip_reports = []
    for clip_name in clips:
        action = bpy.data.actions.get(clip_name)
        if action is None:
            raise RuntimeError(f'Missing required locomotion action: {clip_name}')
        armature.animation_data.action = action
        start = int(math.ceil(action.frame_range[0]))
        end = int(math.floor(action.frame_range[1]))
        samples = {side: [] for side in SIDES}
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            for side in SIDES:
                sample = evaluated_shoe_sample(shoes[side])
                sample['frame'] = frame
                samples[side].append(sample)

        stances = {side.lower(): stance_report(samples[side]) for side in SIDES}
        if any(report is None for report in stances.values()):
            clip_reports.append({
                'clipName': clip_name,
                'frameRange': [start, end],
                'durationSeconds': rounded((end - start) / bpy.context.scene.render.fps),
                'status': 'insufficient-contact',
                'contactClearanceMeters': CONTACT_CLEARANCE_METERS,
                'leftContactFrames': [
                    sample['frame'] for sample in samples['Left']
                    if sample['minimumHeightMeters'] <= CONTACT_CLEARANCE_METERS
                ],
                'rightContactFrames': [
                    sample['frame'] for sample in samples['Right']
                    if sample['minimumHeightMeters'] <= CONTACT_CLEARANCE_METERS
                ],
                'leftMinimumHeightMeters': rounded(min(
                    sample['minimumHeightMeters'] for sample in samples['Left']
                )),
                'rightMinimumHeightMeters': rounded(min(
                    sample['minimumHeightMeters'] for sample in samples['Right']
                )),
                'sourceCycleDistanceMeters': None,
                'sourceNominalSpeedMps': None,
            })
            continue
        clip_frame_span = end - start
        matched_distances = [
            report['forwardTravelMeters'] * clip_frame_span / report['frameSpan']
            for report in stances.values()
        ]
        cycle_distance = sum(matched_distances) / len(matched_distances)
        clip_reports.append({
            'clipName': clip_name,
            'frameRange': [start, end],
            'durationSeconds': rounded((end - start) / bpy.context.scene.render.fps),
            'status': 'measured',
            'contactClearanceMeters': CONTACT_CLEARANCE_METERS,
            'leftStance': {
                **stances['left'],
                'forwardTravelMeters': rounded(stances['left']['forwardTravelMeters']),
                'minimumHeightMeters': rounded(stances['left']['minimumHeightMeters']),
            },
            'rightStance': {
                **stances['right'],
                'forwardTravelMeters': rounded(stances['right']['forwardTravelMeters']),
                'minimumHeightMeters': rounded(stances['right']['minimumHeightMeters']),
            },
            'sourceCycleDistanceMeters': rounded(cycle_distance),
            'sourceNominalSpeedMps': rounded(cycle_distance / ((end - start) / bpy.context.scene.render.fps)),
        })

    report = {
        'status': 'measured',
        'decision': 'supporting-evidence-only',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'measurement': 'sum of maximum deformed shoe travel during each circular planted stance',
        'contactClearanceMeters': CONTACT_CLEARANCE_METERS,
        'clips': clip_reports,
        'approvalRule': 'Source stride measurement must improve live planted-foot evidence and cannot approve motion by itself.',
    }
    output_report.parent.mkdir(parents=True, exist_ok=True)
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_LOCOMOTION_STRIDE ' + str(output_report))


if __name__ == '__main__':
    main()
