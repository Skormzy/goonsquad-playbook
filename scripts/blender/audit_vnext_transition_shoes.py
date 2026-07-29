import argparse
import json
import math
import sys
from pathlib import Path

import bpy


CONTACT_CLEARANCE_METERS = 0.015
SIDES = ('Left', 'Right')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--action-name', required=True)
    parser.add_argument('--runtime-speed', type=float, required=True)
    parser.add_argument('--runtime-start')
    parser.add_argument('--runtime-end')
    parser.add_argument('--import-glb')
    parser.add_argument('--sample-count', type=int)
    parser.add_argument('--primary-contact-side', choices=SIDES)
    parser.add_argument('--primary-contact-end', type=float, default=0.8)
    parser.add_argument('--transfer-contact-side', choices=SIDES)
    parser.add_argument('--transfer-contact-end', type=float, default=0.9)
    parser.add_argument('--output-report', required=True)
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
        raise RuntimeError('The transition shoe audit found no evaluated vertices.')
    return {
        'centerX': sum(point.x for point in points) / len(points),
        'centerY': sum(point.y for point in points) / len(points),
        'minimumZ': min(point.z for point in points),
    }


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, math.floor(len(ordered) * fraction))
    return ordered[index]


def rounded(value):
    return round(value, 4) if value is not None else None


def transform_triplet(value, label):
    values = tuple(float(item.strip()) for item in value.split(',') if item.strip())
    if len(values) != 3:
        raise RuntimeError(f'{label} must contain x,z,rotation.')
    return values


def runtime_world_position(sample, runtime_transform):
    group_x, group_z, rotation = runtime_transform
    local_x = sample['centerX']
    local_z = -sample['centerY']
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    return (
        group_x + cosine * local_x + sine * local_z,
        group_z - sine * local_x + cosine * local_z,
    )


def exact_runtime_report(samples, runtime_start, runtime_end):
    displacements = []
    previous = None
    for index, sample in enumerate(samples):
        progress = index / max(len(samples) - 1, 1)
        transform = tuple(
            runtime_start[axis] + (runtime_end[axis] - runtime_start[axis]) * progress
            for axis in range(3)
        )
        world_x, world_z = runtime_world_position(sample, transform)
        planted = sample['minimumZ'] <= CONTACT_CLEARANCE_METERS
        if planted and previous and previous['planted']:
            displacements.append(math.hypot(world_x - previous['x'], world_z - previous['z']))
        previous = {'x': world_x, 'z': world_z, 'planted': planted}
    return {
        'plantedSampleCount': len(displacements),
        'meanMmPerFrame': rounded(sum(displacements) / len(displacements) * 1000) if displacements else None,
        'p95MmPerFrame': rounded(percentile(displacements, 0.95) * 1000) if displacements else None,
        'maximumMmPerFrame': rounded(max(displacements) * 1000) if displacements else None,
    }


def authored_contact_report(
    samples,
    runtime_start,
    runtime_end,
    primary_side,
    primary_end,
    transfer_side,
    transfer_end,
):
    displacements = []
    motion_displacements = []
    clearances = []
    previous = None
    contact_count = 0
    planted_count = 0
    for index in range(len(next(iter(samples.values())))):
        progress = index / max(len(next(iter(samples.values()))) - 1, 1)
        side = primary_side if progress <= primary_end else (
            transfer_side if transfer_side and progress <= transfer_end else None
        )
        if side is None:
            previous = None
            continue
        sample = samples[side]
        sample = sample[index]
        transform = tuple(
            runtime_start[axis] + (runtime_end[axis] - runtime_start[axis]) * progress
            for axis in range(3)
        )
        world_x, world_z = runtime_world_position(sample, transform)
        planted = sample['minimumZ'] <= CONTACT_CLEARANCE_METERS
        contact_count += 1
        clearances.append(sample['minimumZ'] * 1000)
        if planted:
            planted_count += 1
        if previous and previous['side'] == side:
            displacement = math.hypot(world_x - previous['x'], world_z - previous['z'])
            motion_displacements.append(displacement)
            if planted and previous['planted']:
                displacements.append(displacement)
        previous = {'x': world_x, 'z': world_z, 'planted': planted, 'side': side}
    return {
        'contactSampleCount': contact_count,
        'plantedContactSampleCount': planted_count,
        'slideSampleCount': len(displacements),
        'meanMmPerFrame': rounded(sum(displacements) / len(displacements) * 1000) if displacements else None,
        'p95MmPerFrame': rounded(percentile(displacements, 0.95) * 1000) if displacements else None,
        'maximumMmPerFrame': rounded(max(displacements) * 1000) if displacements else None,
        'motionSampleCount': len(motion_displacements),
        'motionP95MmPerFrame': rounded(percentile(motion_displacements, 0.95) * 1000) if motion_displacements else None,
        'motionMaximumMmPerFrame': rounded(max(motion_displacements) * 1000) if motion_displacements else None,
        'clearanceMinimumMm': rounded(min(clearances)) if clearances else None,
        'clearanceMaximumMm': rounded(max(clearances)) if clearances else None,
    }


def trajectory_report(samples, direction_sign, fps, runtime_speed):
    displacements = []
    previous = None
    for sample in samples:
        elapsed = (sample['frame'] - samples[0]['frame']) / fps
        world_x = sample['centerX']
        world_y = sample['centerY'] + direction_sign * runtime_speed * elapsed
        planted = sample['minimumZ'] <= CONTACT_CLEARANCE_METERS
        if planted and previous and previous['planted']:
            displacements.append(math.hypot(world_x - previous['x'], world_y - previous['y']))
        previous = {'x': world_x, 'y': world_y, 'planted': planted}
    return {
        'directionSign': direction_sign,
        'plantedSampleCount': len(displacements),
        'meanMmPerFrame': rounded(sum(displacements) / len(displacements) * 1000) if displacements else None,
        'p95MmPerFrame': rounded(percentile(displacements, 0.95) * 1000) if displacements else None,
        'maximumMmPerFrame': rounded(max(displacements) * 1000) if displacements else None,
    }


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    if args.import_glb:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(Path(args.import_glb).resolve()))
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    action = bpy.data.actions.get(args.action_name)
    if armature is None or action is None:
        raise RuntimeError('The transition shoe audit inputs are incomplete.')
    shoes = {side: shoe_objects(side) for side in SIDES}
    if any(len(objects) < 2 for objects in shoes.values()):
        raise RuntimeError('The transition shoe audit requires both authored shoes.')

    armature.animation_data_create()
    armature.animation_data.action = action
    action_start, action_end = action.frame_range
    start = int(math.ceil(action_start))
    end = int(math.floor(action_end))
    fps = bpy.context.scene.render.fps
    if bool(args.runtime_start) != bool(args.runtime_end):
        raise RuntimeError('Exact runtime audit requires both runtime-start and runtime-end.')
    runtime_start = transform_triplet(args.runtime_start, 'runtime-start') if args.runtime_start else None
    runtime_end = transform_triplet(args.runtime_end, 'runtime-end') if args.runtime_end else None
    samples = {side: [] for side in SIDES}
    if args.sample_count is not None and args.sample_count < 2:
        raise RuntimeError('sample-count must be at least two.')
    frames = [
        action_start + (action_end - action_start) * index / (args.sample_count - 1)
        for index in range(args.sample_count)
    ] if args.sample_count else list(range(start, end + 1))
    for frame in frames:
        whole = math.floor(frame)
        bpy.context.scene.frame_set(whole, subframe=frame - whole)
        bpy.context.view_layer.update()
        for side in SIDES:
            sample = evaluated_shoe_sample(shoes[side])
            sample['frame'] = rounded(frame)
            samples[side].append(sample)

    directions = []
    for sign in (-1, 1):
        sides = {
            side.lower(): trajectory_report(samples[side], sign, fps, args.runtime_speed)
            for side in SIDES
        }
        p95_values = [item['p95MmPerFrame'] for item in sides.values() if item['p95MmPerFrame'] is not None]
        directions.append({
            'directionSign': sign,
            'combinedP95MmPerFrame': rounded(max(p95_values)) if p95_values else None,
            'sides': sides,
        })
    directions.sort(key=lambda item: item['combinedP95MmPerFrame'] if item['combinedP95MmPerFrame'] is not None else float('inf'))
    exact_runtime = None
    authored_contact = None
    if runtime_start:
        sides = {
            side.lower(): exact_runtime_report(samples[side], runtime_start, runtime_end)
            for side in SIDES
        }
        p95_values = [item['p95MmPerFrame'] for item in sides.values() if item['p95MmPerFrame'] is not None]
        exact_runtime = {
            'runtimeStart': list(runtime_start),
            'runtimeEnd': list(runtime_end),
            'combinedP95MmPerFrame': rounded(max(p95_values)) if p95_values else None,
            'sides': sides,
        }
        if args.primary_contact_side:
            authored_contact = authored_contact_report(
                samples,
                runtime_start,
                runtime_end,
                args.primary_contact_side,
                args.primary_contact_end,
                args.transfer_contact_side,
                args.transfer_contact_end,
            )

    report = {
        'status': 'measured',
        'decision': 'supporting-evidence-only',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'action': args.action_name,
        'frameRange': [start, end],
        'fps': fps,
        'durationSeconds': rounded((end - start) / fps),
        'runtimeSpeedMps': args.runtime_speed,
        'contactClearanceMeters': CONTACT_CLEARANCE_METERS,
        'directions': directions,
        'exactRuntime': exact_runtime,
        'authoredContact': authored_contact,
        'samples': {
            side.lower(): [
                {key: rounded(value) if key != 'frame' else value for key, value in sample.items()}
                for sample in samples[side]
            ]
            for side in SIDES
        },
    }
    output_report.parent.mkdir(parents=True, exist_ok=True)
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_TRANSITION_SHOE_AUDIT ' + str(output_report))


if __name__ == '__main__':
    main()
