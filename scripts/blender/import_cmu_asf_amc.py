import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector


METERS_PER_ASF_UNIT = 0.0254 / 0.45
SOURCE_FPS = 120
ACTION_NAME = 'cmu-run-jog-35-24'
SOURCE_TO_BLENDER = Matrix((
    (1.0, 0.0, 0.0),
    (0.0, 0.0, -1.0),
    (0.0, 1.0, 0.0),
))


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--asf', required=True)
    parser.add_argument('--amc', required=True)
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--subject-prefix', default='CMU35')
    parser.add_argument('--rig-name', default='CMU35_Source_Rig')
    parser.add_argument('--armature-name', default='CMU35_Source_Armature')
    parser.add_argument('--action-name', default=ACTION_NAME)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def clean_lines(path):
    return [
        line.strip() for line in Path(path).read_text(encoding='utf-8').splitlines()
        if line.strip() and not line.lstrip().startswith('#')
    ]


def parse_asf(path):
    lines = clean_lines(path)
    joints = {
        'root': {
            'name': 'root',
            'direction': Vector((0.0, 0.0, 0.0)),
            'length': 0.0,
            'axis': Vector((0.0, 0.0, 0.0)),
            'axisOrder': 'XYZ',
            'dof': ('tx', 'ty', 'tz', 'rx', 'ry', 'rz'),
            'parent': None,
            'children': [],
        },
    }
    index = lines.index(':bonedata') + 1
    while lines[index] != ':hierarchy':
        if lines[index] != 'begin':
            raise RuntimeError(f'Unexpected ASF bone token: {lines[index]}')
        index += 1
        record = {'dof': (), 'children': [], 'parent': None}
        while lines[index] != 'end':
            parts = lines[index].split()
            key = parts[0]
            if key == 'name':
                record['name'] = parts[1]
            elif key == 'direction':
                record['direction'] = Vector(tuple(float(value) for value in parts[1:4]))
            elif key == 'length':
                record['length'] = float(parts[1])
            elif key == 'axis':
                record['axis'] = Vector(tuple(float(value) for value in parts[1:4]))
                record['axisOrder'] = parts[4]
            elif key == 'dof':
                record['dof'] = tuple(parts[1:])
            index += 1
        if record.get('axisOrder') != 'XYZ':
            raise RuntimeError(f"Unsupported ASF axis order for {record.get('name')}: {record.get('axisOrder')}")
        joints[record['name']] = record
        index += 1

    index += 1
    if lines[index] != 'begin':
        raise RuntimeError('ASF hierarchy does not begin correctly.')
    index += 1
    while lines[index] != 'end':
        names = lines[index].split()
        parent = names[0]
        for child in names[1:]:
            joints[parent]['children'].append(child)
            joints[child]['parent'] = parent
        index += 1
    return joints


def parse_amc(path):
    lines = clean_lines(path)
    start = lines.index(':DEGREES') + 1
    frames = []
    current = None
    for line in lines[start:]:
        parts = line.split()
        if len(parts) == 1 and parts[0].isdigit():
            current = {'number': int(parts[0]), 'motion': {}}
            frames.append(current)
            continue
        if current is None:
            raise RuntimeError('AMC motion data appears before the first frame.')
        current['motion'][parts[0]] = [float(value) for value in parts[1:]]
    return frames


def euler_matrix(degrees):
    radians = tuple(math.radians(value) for value in degrees)
    return Euler(radians, 'XYZ').to_matrix()


def joint_rotation(joint, values):
    channels = {channel: value for channel, value in zip(joint['dof'], values)}
    return euler_matrix((
        channels.get('rx', 0.0),
        channels.get('ry', 0.0),
        channels.get('rz', 0.0),
    ))


def source_to_blender_vector(vector, scale=1.0):
    return SOURCE_TO_BLENDER @ vector * scale


def source_to_blender_rotation(rotation):
    return SOURCE_TO_BLENDER @ rotation @ SOURCE_TO_BLENDER.inverted()


def rest_coordinates(joints):
    coordinates = {'root': Vector((0.0, 0.0, 0.0))}

    def visit(parent_name):
        parent_coordinate = coordinates[parent_name]
        for child_name in joints[parent_name]['children']:
            child = joints[child_name]
            coordinates[child_name] = parent_coordinate + child['direction'] * child['length']
            visit(child_name)

    visit('root')
    return coordinates


def frame_transforms(joints, motion):
    root_values = motion['root']
    coordinates = {'root': Vector(root_values[:3])}
    rotations = {'root': euler_matrix(root_values[3:6])}

    def visit(parent_name):
        for child_name in joints[parent_name]['children']:
            child = joints[child_name]
            axis = euler_matrix(child['axis'])
            local = axis @ joint_rotation(child, motion.get(child_name, [])) @ axis.inverted()
            rotations[child_name] = rotations[parent_name] @ local
            coordinates[child_name] = (
                coordinates[parent_name]
                + child['length'] * (rotations[child_name] @ child['direction'])
            )
            visit(child_name)

    visit('root')
    return coordinates, rotations


def hierarchy_order(joints):
    order = ['root']

    def visit(parent_name):
        for child_name in joints[parent_name]['children']:
            order.append(child_name)
            visit(child_name)

    visit('root')
    return order


def create_source_armature(joints, subject_prefix, rig_name, armature_name):
    for obj in list(bpy.data.objects):
        if obj.name.startswith(f'{subject_prefix}_'):
            bpy.data.objects.remove(obj, do_unlink=True)

    armature_data = bpy.data.armatures.new(armature_name)
    armature = bpy.data.objects.new(rig_name, armature_data)
    bpy.context.scene.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')

    coordinates = rest_coordinates(joints)
    edit_bones = {}
    for name in hierarchy_order(joints):
        bone = armature_data.edit_bones.new(f'{subject_prefix}_{name}')
        if name == 'root':
            bone.head = (0.0, 0.0, 0.0)
            bone.tail = (0.0, 0.0, 0.18)
        else:
            parent_name = joints[name]['parent']
            bone.head = source_to_blender_vector(coordinates[parent_name], METERS_PER_ASF_UNIT)
            bone.tail = source_to_blender_vector(coordinates[name], METERS_PER_ASF_UNIT)
            if (bone.tail - bone.head).length < 0.001:
                bone.tail = bone.head + Vector((0.0, 0.0, 0.01))
            bone.parent = edit_bones[parent_name]
        bone.use_connect = False
        edit_bones[name] = bone

    bpy.ops.object.mode_set(mode='POSE')
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = 'QUATERNION'
    bpy.ops.object.mode_set(mode='OBJECT')
    armature.show_in_front = True
    armature.data.display_type = 'STICK'
    return armature


def matrix_from_rotation_translation(rotation, translation):
    matrix = rotation.to_4x4()
    matrix.translation = translation
    return matrix


def bake_action(armature, joints, frames, subject_prefix, action_name):
    armature.animation_data_create()
    armature.animation_data.action = None
    order = hierarchy_order(joints)
    root_positions = []
    foot_positions = {'lfoot': [], 'rfoot': []}
    baked_poses = []

    for source_frame in frames:
        for pose_bone in armature.pose.bones:
            pose_bone.matrix_basis.identity()
        coordinates, rotations = frame_transforms(joints, source_frame['motion'])
        for name in order:
            pose_bone = armature.pose.bones[f'{subject_prefix}_{name}']
            rest_rotation = pose_bone.bone.matrix_local.to_3x3()
            desired_rotation = source_to_blender_rotation(rotations[name]) @ rest_rotation
            if name == 'root':
                head = source_to_blender_vector(coordinates['root'], METERS_PER_ASF_UNIT)
            else:
                head = source_to_blender_vector(
                    coordinates[joints[name]['parent']],
                    METERS_PER_ASF_UNIT,
                )
            pose_bone.matrix = matrix_from_rotation_translation(desired_rotation, head)
            # Child matrix assignment is evaluated against the parent's current
            # pose. Flush each parent before its descendants so Blender derives
            # the correct local basis instead of compounding stale transforms.
            bpy.context.view_layer.update()
        bpy.context.view_layer.update()
        baked_poses.append({
            name: armature.pose.bones[f'{subject_prefix}_{name}'].matrix_basis.copy()
            for name in order
        })
        root_positions.append(source_to_blender_vector(coordinates['root'], METERS_PER_ASF_UNIT))
        for foot_name in foot_positions:
            foot_positions[foot_name].append(
                source_to_blender_vector(coordinates[foot_name], METERS_PER_ASF_UNIT)
            )

    action = bpy.data.actions.get(action_name) or bpy.data.actions.new(action_name)
    action.use_fake_user = True
    armature.animation_data.action = action
    for output_frame, baked_pose in enumerate(baked_poses, start=1):
        bpy.context.scene.frame_set(output_frame)
        for name in order:
            pose_bone = armature.pose.bones[f'{subject_prefix}_{name}']
            pose_bone.matrix_basis = baked_pose[name]
            pose_bone.keyframe_insert('location', frame=output_frame, group=pose_bone.name)
            pose_bone.keyframe_insert('rotation_quaternion', frame=output_frame, group=pose_bone.name)
            pose_bone.keyframe_insert('scale', frame=output_frame, group=pose_bone.name)

    for fcurve in getattr(action, 'fcurves', []):
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = 'LINEAR'
    action.frame_range = (1, len(frames))
    return action, root_positions, foot_positions


def vector_range(vectors, axis):
    values = [vector[axis] for vector in vectors]
    return max(values) - min(values)


def main():
    args = parse_args()
    asf_path = Path(args.asf).resolve()
    amc_path = Path(args.amc).resolve()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    joints = parse_asf(asf_path)
    frames = parse_amc(amc_path)
    if len(frames) < 2:
        raise RuntimeError('The CMU motion requires at least two frames.')

    scene = bpy.context.scene
    scene.render.fps = SOURCE_FPS
    scene.frame_start = 1
    scene.frame_end = len(frames)
    armature = create_source_armature(
        joints,
        args.subject_prefix,
        args.rig_name,
        args.armature_name,
    )
    action, root_positions, foot_positions = bake_action(
        armature,
        joints,
        frames,
        args.subject_prefix,
        args.action_name,
    )
    scene.frame_set(1)
    hierarchy_gaps = []
    for name in hierarchy_order(joints):
        parent_name = joints[name]['parent']
        if parent_name is None:
            continue
        child = armature.pose.bones[f'{args.subject_prefix}_{name}']
        parent = armature.pose.bones[f'{args.subject_prefix}_{parent_name}']
        parent_anchor = parent.head if parent_name == 'root' else parent.tail
        hierarchy_gaps.append((child.head - parent_anchor).length)

    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    root_travel = sum(
        (root_positions[index] - root_positions[index - 1]).length
        for index in range(1, len(root_positions))
    )
    report = {
        'status': 'converted-for-retargeting',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'source': {
            'asf': str(asf_path),
            'amc': str(amc_path),
            'fps': SOURCE_FPS,
            'frameCount': len(frames),
            'durationSeconds': round((len(frames) - 1) / SOURCE_FPS, 4),
            'metersPerAsfUnit': round(METERS_PER_ASF_UNIT, 8),
        },
        'outputWorkfile': str(output_blend),
        'armature': armature.name,
        'action': action.name,
        'boneCount': len(armature.data.bones),
        'maximumHierarchyGapMeters': round(max(hierarchy_gaps, default=0.0), 6),
        'rootTravelMeters': round(root_travel, 4),
        'rootVerticalRangeMeters': round(vector_range(root_positions, 2), 4),
        'leftFootTravelMeters': round(sum(
            (foot_positions['lfoot'][index] - foot_positions['lfoot'][index - 1]).length
            for index in range(1, len(foot_positions['lfoot']))
        ), 4),
        'rightFootTravelMeters': round(sum(
            (foot_positions['rfoot'][index] - foot_positions['rfoot'][index - 1]).length
            for index in range(1, len(foot_positions['rfoot']))
        ), 4),
        'nextGate': 'Select clean gait loops and retarget the captured lower body and root motion to GS_FieldPlayer_Rig.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CMU_ASF_AMC_IMPORTED ' + str(output_report))


if __name__ == '__main__':
    main()
