import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
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
HEAD_ATTACHMENT_NAMES = (
    'CC_Base_Eye',
    'CC_Base_EyeOcclusion',
    'CC_Base_TearLine',
    'CC_Base_Teeth',
    'CC_Base_Tongue',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def round_vector(vector):
    return [round(value, 4) for value in vector]


def angle_degrees(first, second):
    if first.length <= 1e-8 or second.length <= 1e-8:
        return 0.0
    dot = max(-1.0, min(1.0, first.normalized().dot(second.normalized())))
    return math.degrees(math.acos(dot))


def evaluated_bounds(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    finally:
        evaluated.to_mesh_clear()
    if not points:
        return None
    minimum = Vector((min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector((max(point[axis] for point in points) for axis in range(3)))
    return {
        'minimum': round_vector(minimum),
        'maximum': round_vector(maximum),
        'center': round_vector((minimum + maximum) * 0.5),
        'dimensions': round_vector(maximum - minimum),
    }


def sample_frames(action):
    start = int(math.floor(action.frame_range[0]))
    end = int(math.ceil(action.frame_range[1]))
    return sorted({
        start,
        int(round(start + (end - start) * 0.25)),
        int(round(start + (end - start) * 0.5)),
        int(round(start + (end - start) * 0.75)),
        end,
    })


def pose_point(armature, bone_name, endpoint='head'):
    bone = armature.pose.bones.get(bone_name)
    if bone is None:
        raise RuntimeError(f'Missing pose bone: {bone_name}')
    local = bone.head if endpoint == 'head' else bone.tail
    return armature.matrix_world @ local


def arm_sample(armature, prefix):
    shoulder = pose_point(armature, f'CC_Base_{prefix}_Upperarm')
    elbow = pose_point(armature, f'CC_Base_{prefix}_Forearm')
    wrist = pose_point(armature, f'CC_Base_{prefix}_Hand')
    upper_direction = elbow - shoulder
    lower_direction = wrist - elbow
    return {
        'shoulder': round_vector(shoulder),
        'elbow': round_vector(elbow),
        'wrist': round_vector(wrist),
        'shoulderElevationFromDownDegrees': round(
            angle_degrees(upper_direction, Vector((0.0, 0.0, -1.0))),
            3,
        ),
        'elbowBendDegrees': round(angle_degrees(shoulder - elbow, wrist - elbow), 3),
        'upperArmLength': round(upper_direction.length, 4),
        'forearmLength': round(lower_direction.length, 4),
    }


def rear_sleeve_intrusion(obj, depsgraph):
    sleeve_indices = set()
    for polygon in obj.data.polygons:
        material = obj.data.materials[polygon.material_index]
        if material and material.name.endswith('Accent_Red'):
            sleeve_indices.update(polygon.vertices)
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        candidates = []
        for index in sleeve_indices:
            if index >= len(mesh.vertices):
                continue
            world = evaluated.matrix_world @ mesh.vertices[index].co
            if (
                abs(world.x + 0.0875) <= 0.13
                and world.y >= 0.045
                and 1.08 <= world.z <= 1.42
            ):
                source = obj.data.vertices[index]
                groups = sorted(
                    (
                        (obj.vertex_groups[membership.group].name, membership.weight)
                        for membership in source.groups
                    ),
                    key=lambda item: item[1],
                    reverse=True,
                )
                candidates.append({
                    'vertex': index,
                    'rest': round_vector(source.co),
                    'world': round_vector(world),
                    'weights': [
                        {'bone': name, 'weight': round(weight, 4)}
                        for name, weight in groups[:5]
                    ],
                })
    finally:
        evaluated.to_mesh_clear()
    candidates.sort(key=lambda item: item['world'][1], reverse=True)
    return {
        'candidateCount': len(candidates),
        'furthestRearY': candidates[0]['world'][1] if candidates else None,
        'vertices': candidates[:24],
    }


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing armature: {ARMATURE_NAME}')
    armature.animation_data_create()
    depsgraph = bpy.context.evaluated_depsgraph_get()

    original_action = armature.animation_data.action
    original_frame = bpy.context.scene.frame_current
    action_reports = {}
    for action_name in REQUIRED_ACTIONS:
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f'Missing required action: {action_name}')
        armature.animation_data.action = action
        samples = []
        for frame in sample_frames(action):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            left = arm_sample(armature, 'L')
            right = arm_sample(armature, 'R')
            left_wrist = Vector(left['wrist'])
            right_wrist = Vector(right['wrist'])
            samples.append({
                'frame': frame,
                'left': left,
                'right': right,
                'handSeparation': round((left_wrist - right_wrist).length, 4),
                'maximumShoulderElevationFromDownDegrees': round(max(
                    left['shoulderElevationFromDownDegrees'],
                    right['shoulderElevationFromDownDegrees'],
                ), 3),
            })
        action_reports[action_name] = {
            'frameRange': [round(value, 4) for value in action.frame_range],
            'samples': samples,
            'maximumShoulderElevationFromDownDegrees': round(max(
                sample['maximumShoulderElevationFromDownDegrees'] for sample in samples
            ), 3),
            'minimumElbowBendDegrees': round(min(
                min(sample['left']['elbowBendDegrees'], sample['right']['elbowBendDegrees'])
                for sample in samples
            ), 3),
        }

    review_action = bpy.data.actions['jog-to-sprint-ik']
    armature.animation_data.action = review_action
    bpy.context.scene.frame_set(4)
    bpy.context.view_layer.update()
    head_center = (
        pose_point(armature, 'CC_Base_Head', 'head')
        + pose_point(armature, 'CC_Base_Head', 'tail')
    ) * 0.5
    attachment_reports = {}
    attachment_names = sorted(set(HEAD_ATTACHMENT_NAMES) | {
        obj.name for obj in bpy.data.objects if 'Helmet' in obj.name
    })
    for name in attachment_names:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        bounds = evaluated_bounds(obj, depsgraph)
        if bounds is None:
            continue
        center = Vector(bounds['center'])
        attachment_reports[name] = {
            'hideRender': obj.hide_render,
            'bounds': bounds,
            'distanceFromHeadCenter': round((center - head_center).length, 4),
            'materials': [material.name for material in obj.data.materials if material],
        }

    mesh_reports = {}
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.hide_render:
            continue
        if not (
            obj.name.startswith('GS_Home_')
            or obj.name.startswith('GS_Away_')
            or obj.name == 'CC_Base_Body'
        ):
            continue
        bounds = evaluated_bounds(obj, depsgraph)
        if bounds is not None:
            mesh_reports[obj.name] = bounds
    home_jersey = bpy.data.objects.get('GS_Home_Jersey')
    intrusion_report = rear_sleeve_intrusion(home_jersey, depsgraph) if home_jersey else None

    armature.animation_data.action = original_action
    bpy.context.scene.frame_set(original_frame)
    bpy.context.view_layer.update()

    report = {
        'status': 'measured',
        'decision': 'supporting-evidence-only',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'armature': ARMATURE_NAME,
        'restBoneChains': {
            side: {
                name: {
                    'head': round_vector(armature.data.bones[name].head_local),
                    'tail': round_vector(armature.data.bones[name].tail_local),
                    'parent': armature.data.bones[name].parent.name if armature.data.bones[name].parent else None,
                }
                for name in (
                    f'CC_Base_{prefix}_Clavicle',
                    f'CC_Base_{prefix}_Upperarm',
                    f'CC_Base_{prefix}_UpperarmTwist01',
                    f'CC_Base_{prefix}_UpperarmTwist02',
                    f'CC_Base_{prefix}_Forearm',
                    f'CC_Base_{prefix}_ForearmTwist01',
                    f'CC_Base_{prefix}_ForearmTwist02',
                    f'CC_Base_{prefix}_Hand',
                )
            }
            for side, prefix in (('left', 'L'), ('right', 'R'))
        },
        'actionReports': action_reports,
        'reviewFrame': {
            'action': review_action.name,
            'frame': 4,
            'headCenter': round_vector(head_center),
            'headAttachments': attachment_reports,
            'visibleMeshBounds': mesh_reports,
            'rearSleeveIntrusion': intrusion_report,
        },
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_UPPER_BODY_AUDIT ' + str(output_report))


if __name__ == '__main__':
    main()
