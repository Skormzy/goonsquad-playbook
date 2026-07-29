import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


STICK_CONTROL = 'GS_Stick_Control'
LEFT_TARGET = 'GS_L_Hand_Target'
RIGHT_TARGET = 'GS_R_Hand_Target'
BALL_CONTROL = 'GS_Ball_Control'
LEFT_HAND = 'CC_Base_L_Hand'
RIGHT_HAND = 'CC_Base_R_Hand'
STICK_ANCHOR_CM = Vector((90.0, -8.0, 4.0))
BALL_RADIUS_CM = 3.3
CONTACT_FRAMES = {'receive': 16, 'pass': 16, 'shot': 20}


STICK_KEYS = {
    'ready': [
        (1, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
        (11, -14, -43, (0.15, 0.07, 0.986), (-0.05, -1, 0)),
        (21, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
        (31, -18, -41, (0.19, 0.07, 0.979), (0.05, -1, 0)),
        (41, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
    ],
    'jog': [
        (1, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
        (9, -13, -45, (0.14, 0.10, 0.985), (-0.08, -1, 0)),
        (17, -17, -42, (0.18, 0.08, 0.980), (0.04, -1, 0)),
        (25, -19, -44, (0.20, 0.10, 0.975), (0.09, -1, 0)),
        (33, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
    ],
    'sprint': [
        (1, -17, -44, (0.20, 0.10, 0.975), (0, -1, 0)),
        (8, -12, -48, (0.15, 0.14, 0.979), (-0.10, -1, 0)),
        (15, -18, -44, (0.21, 0.10, 0.972), (0.05, -1, 0)),
        (22, -21, -47, (0.23, 0.13, 0.964), (0.12, -1, 0)),
        (29, -17, -44, (0.20, 0.10, 0.975), (0, -1, 0)),
    ],
    'turn': [
        (1, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
        (8, -20, -44, (0.21, 0.07, 0.975), (-0.35, -0.94, 0)),
        (16, -27, -42, (0.25, 0.04, 0.967), (-0.78, -0.63, 0)),
        (24, -21, -43, (0.21, 0.06, 0.976), (-0.36, -0.93, 0)),
        (32, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
    ],
    'stop': [
        (1, -18, -45, (0.20, 0.10, 0.975), (0, -1, 0)),
        (8, -14, -48, (0.16, 0.13, 0.979), (-0.08, -1, 0)),
        (16, -17, -44, (0.18, 0.07, 0.981), (0.03, -1, 0)),
        (24, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
        (32, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
    ],
    'receive': [
        (1, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
        (8, -21, -54, (0.22, 0.05, 0.974), (-0.08, -1, 0)),
        (16, -14, -48, (0.16, 0.06, 0.985), (0, -1, 0)),
        (24, -12, -44, (0.14, 0.08, 0.987), (0.04, -1, 0)),
        (32, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
    ],
    'pass': [
        (1, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
        (8, -29, -38, (0.31, 0.05, 0.949), (-0.36, -0.94, 0)),
        (16, -8, -49, (0.12, 0.06, 0.991), (0.14, -0.99, 0)),
        (24, 7, -53, (-0.06, 0.08, 0.995), (0.40, -0.92, 0)),
        (32, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
    ],
    'shot': [
        (1, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
        (10, -36, -35, (0.36, 0.04, 0.932), (-0.46, -0.89, 0)),
        (20, -4, -51, (0.08, 0.06, 0.995), (0.18, -0.98, 0)),
        (29, 18, -59, (-0.18, 0.08, 0.980), (0.48, -0.88, 0)),
        (38, -16, -42, (0.17, 0.08, 0.982), (0, -1, 0)),
    ],
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def ensure_controls(armature):
    bpy.ops.object.select_all(action='DESELECT')
    armature.hide_set(False)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='EDIT')
    bones = armature.data.edit_bones
    for name in (STICK_CONTROL, LEFT_TARGET, RIGHT_TARGET, BALL_CONTROL):
        existing = bones.get(name)
        if existing is not None:
            bones.remove(existing)

    stick = bones.new(STICK_CONTROL)
    stick.head = (0, 0, 0)
    stick.tail = (0, 0, 100)
    stick.use_deform = True

    left = bones.new(LEFT_TARGET)
    left.head = (0, 0, 136)
    left.tail = (0, 0, 141)
    left.parent = stick
    left.use_deform = False

    right = bones.new(RIGHT_TARGET)
    right.head = (0, 0, 116)
    right.tail = (0, 0, 121)
    right.parent = stick
    right.use_deform = False

    ball = bones.new(BALL_CONTROL)
    ball.head = (0, 0, 0)
    ball.tail = (0, 0, 10)
    ball.use_deform = True
    bpy.ops.object.mode_set(mode='POSE')

    for hand_name, target_name in ((LEFT_HAND, LEFT_TARGET), (RIGHT_HAND, RIGHT_TARGET)):
        hand = armature.pose.bones[hand_name]
        for constraint in list(hand.constraints):
            if constraint.name.startswith('GS_Contact_'):
                hand.constraints.remove(constraint)
        constraint = hand.constraints.new('IK')
        constraint.name = f'GS_Contact_{hand_name}'
        constraint.target = armature
        constraint.subtarget = target_name
        constraint.chain_count = 3
        constraint.iterations = 64
        constraint.use_tail = True
        constraint.use_rotation = True
        constraint.influence = 1.0

    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()


def add_armature_modifier(obj, armature):
    for modifier in list(obj.modifiers):
        if modifier.type == 'ARMATURE':
            obj.modifiers.remove(modifier)
    modifier = obj.modifiers.new('GS_ContactArmature', 'ARMATURE')
    modifier.object = armature
    modifier.use_vertex_groups = True


def bind_sticks(armature):
    names = []
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or '_Stick_' not in obj.name:
            continue
        for vertex in obj.data.vertices:
            vertex.co -= STICK_ANCHOR_CM
        obj.parent = armature
        obj.matrix_parent_inverse.identity()
        obj.location = (0, 0, 0)
        obj.rotation_euler = (0, 0, 0)
        obj.scale = (1, 1, 1)
        for group in list(obj.vertex_groups):
            obj.vertex_groups.remove(group)
        group = obj.vertex_groups.new(name=STICK_CONTROL)
        group.add(range(len(obj.data.vertices)), 1.0, 'REPLACE')
        add_armature_modifier(obj, armature)
        names.append(obj.name)
    if len(names) != 6:
        raise RuntimeError(f'Expected six stick meshes, found {len(names)}.')
    return sorted(names)


def make_ball(armature):
    existing = bpy.data.objects.get('GS_Contact_Ball')
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)
    collection = bpy.data.collections.get('GS_Contact_Review')
    if collection is None:
        collection = bpy.data.collections.new('GS_Contact_Review')
        bpy.context.scene.collection.children.link(collection)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=BALL_RADIUS_CM, location=(0, 0, 0))
    ball = bpy.context.object
    ball.name = 'GS_Contact_Ball'
    for source_collection in list(ball.users_collection):
        source_collection.objects.unlink(ball)
    collection.objects.link(ball)
    ball.parent = armature
    ball.matrix_parent_inverse.identity()
    ball.location = (0, 0, 0)
    group = ball.vertex_groups.new(name=BALL_CONTROL)
    group.add(range(len(ball.data.vertices)), 1.0, 'REPLACE')
    add_armature_modifier(ball, armature)

    material = bpy.data.materials.get('GS_Contact_Ball_Orange') or bpy.data.materials.new('GS_Contact_Ball_Orange')
    material.diffuse_color = (1.0, 0.24, 0.025, 1.0)
    material.metallic = 0.0
    material.roughness = 0.42
    material.use_nodes = True
    principled = material.node_tree.nodes.get('Principled BSDF')
    if principled is not None:
        principled.inputs['Base Color'].default_value = (1.0, 0.075, 0.006, 1.0)
        principled.inputs['Roughness'].default_value = 0.42
        principled.inputs['Metallic'].default_value = 0.0
    ball.data.materials.append(material)
    ball['equipment_group'] = 'ball-contact-review'
    return ball


def interpolate_key(keys, frame):
    if frame <= keys[0][0]:
        return keys[0][1:]
    if frame >= keys[-1][0]:
        return keys[-1][1:]
    for left, right in zip(keys, keys[1:]):
        if left[0] <= frame <= right[0]:
            mix = (frame - left[0]) / (right[0] - left[0])
            x = left[1] + (right[1] - left[1]) * mix
            y = left[2] + (right[2] - left[2]) * mix
            axis = Vector(left[3]).lerp(Vector(right[3]), mix).normalized()
            toe = Vector(left[4]).lerp(Vector(right[4]), mix).normalized()
            return x, y, tuple(axis), tuple(toe)
    raise RuntimeError(f'No stick key interval contains frame {frame}.')


def contact_deformation(origin, shaft_direction, toe_direction):
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


def evaluated_world_min_z(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    return min((evaluated.matrix_world @ Vector(corner)).z for corner in evaluated.bound_box)


def key_stick_action(armature, action, blade):
    armature.animation_data.action = action
    start = int(action.frame_range[0])
    end = int(action.frame_range[1])
    poses = {}
    control = armature.pose.bones[STICK_CONTROL]
    left_hand = armature.pose.bones[LEFT_HAND]
    right_hand = armature.pose.bones[RIGHT_HAND]
    contact_constraints = [
        next(constraint for constraint in left_hand.constraints if constraint.name.startswith('GS_Contact_')),
        next(constraint for constraint in right_hand.constraints if constraint.name.startswith('GS_Contact_')),
    ]
    for frame in range(start, end + 1):
        for constraint in contact_constraints:
            constraint.influence = 0.0
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        left_tail = left_hand.tail.copy()
        right_tail = right_hand.tail.copy()
        midpoint = (left_tail + right_tail) * 0.5
        horizontal = left_tail - right_tail
        horizontal.z = 0.0
        axis = (horizontal * 0.13 + Vector((0, 0, 18))).normalized()
        top_grip = midpoint + Vector((0, 10, 10))
        origin = top_grip - axis * 125.0
        _, _, _, toe = interpolate_key(STICK_KEYS[action.name], frame)
        deformation, toe_vector, shaft_vector = contact_deformation(origin, axis, toe)
        set_bone_deformation(control, deformation)
        floor_error = 0.004 - evaluated_world_min_z(blade)
        if floor_error > 0:
            deformation.translation.z += floor_error / abs(armature.scale.z)
            set_bone_deformation(control, deformation)
        for constraint in contact_constraints:
            constraint.influence = 1.0
        bpy.context.view_layer.update()
        key_bone(control, frame)
        sweet_spot = deformation @ Vector((0, -23, 3.0))
        poses[frame] = {
            'deformation': deformation.copy(),
            'toe': toe_vector.copy(),
            'shaft': shaft_vector.copy(),
            'sweetSpot': sweet_spot,
        }
    return poses


def ball_position(action_name, frame, poses):
    up = Vector((0, 0, BALL_RADIUS_CM))
    current = poses[frame]['sweetSpot'] + up
    if action_name == 'receive':
        contact_frame = CONTACT_FRAMES[action_name]
        contact = poses[contact_frame]['sweetSpot'] + up
        direction = poses[contact_frame]['toe']
        if frame <= contact_frame:
            distance = 90.0 * (contact_frame - frame) / (contact_frame - min(poses))
            return contact + direction * distance
        return current
    if action_name in ('pass', 'shot'):
        contact_frame = CONTACT_FRAMES[action_name]
        if frame <= contact_frame:
            return current
        contact = poses[contact_frame]['sweetSpot'] + up
        direction = poses[contact_frame]['toe']
        travel = 220.0 if action_name == 'pass' else 420.0
        progress = (frame - contact_frame) / (max(poses) - contact_frame)
        return contact + direction * travel * progress
    return current


def key_ball_action(armature, action, poses):
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
        positions[frame] = [round(value, 3) for value in position]
    return positions


def make_custom_curves_linear(action):
    custom_tokens = (STICK_CONTROL, BALL_CONTROL)
    for fcurve in getattr(action, 'fcurves', []):
        if not any(token in fcurve.data_path for token in custom_tokens):
            continue
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = 'LINEAR'


def main():
    args = parse_args()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    home = bpy.data.collections.get('GS_Equipment_Home')
    away = bpy.data.collections.get('GS_Equipment_Away')
    if armature is None or home is None or away is None:
        raise RuntimeError('The accepted motion workfile is incomplete.')
    missing_actions = [name for name in STICK_KEYS if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing authored actions: ' + ', '.join(missing_actions))

    ensure_controls(armature)
    stick_objects = bind_sticks(armature)
    ball = make_ball(armature)
    home_blade = bpy.data.objects.get('GS_Home_Stick_Blade')
    if home_blade is None:
        raise RuntimeError('The home stick blade is missing.')
    home.hide_render = False
    away.hide_render = True
    ball.hide_render = False

    action_reports = []
    armature.animation_data_create()
    for action_name in STICK_KEYS:
        action = bpy.data.actions[action_name]
        poses = key_stick_action(armature, action, home_blade)
        ball_positions = key_ball_action(armature, action, poses)
        make_custom_curves_linear(action)
        action_reports.append({
            'name': action_name,
            'frameRange': [int(action.frame_range[0]), int(action.frame_range[1])],
            'keyedContactFrameCount': len(poses),
            'contactFrame': CONTACT_FRAMES.get(action_name),
            'ballStartCm': ball_positions[min(ball_positions)],
            'ballEndCm': ball_positions[max(ball_positions)],
        })

    armature.animation_data.action = bpy.data.actions['ready']
    bpy.context.scene.frame_set(1)
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    report = {
        'status': 'authored-for-contact-review',
        'decision': 'not-production-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'outputWorkfile': str(output_blend),
        'armature': armature.name,
        'controlBones': [STICK_CONTROL, LEFT_TARGET, RIGHT_TARGET, BALL_CONTROL],
        'handConstraints': [f'GS_Contact_{LEFT_HAND}', f'GS_Contact_{RIGHT_HAND}'],
        'stickObjects': stick_objects,
        'ballObject': ball.name,
        'contactFrames': CONTACT_FRAMES,
        'actions': action_reports,
        'approvalRule': 'Every frame must pass measured hand contact and close-camera human review before the contact gate can open.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_CONTACT_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
