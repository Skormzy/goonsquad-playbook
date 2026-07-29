import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


SOURCE_RIG = 'CMU35_Source_Rig'
SOURCE_ACTION = 'cmu-run-jog-35-24'
TARGET_RIG = 'GS_FieldPlayer_Rig'
TARGET_ACTION = 'sprint'
OUTPUT_ACTION = 'sprint-cmu-lower-body-audition'
SOURCE_FPS = 120
OUTPUT_FPS = 30
SOURCE_LOOP = (15, 105)
OUTPUT_FRAMES = (1, 24)
RIGID_TORSO_ATTACHMENTS = (
    'GS_Home_Jersey_Front_Mark',
    'GS_Away_Jersey_Front_Mark',
)
QUARANTINED_COSMETICS = (
    'GS_Home_Jersey_Back_Number_One',
    'GS_Home_Jersey_Back_Number_SevenTop',
    'GS_Home_Jersey_Back_Number_SevenDiagonal',
    'GS_Away_Jersey_Back_Number_One',
    'GS_Away_Jersey_Back_Number_SevenTop',
    'GS_Away_Jersey_Back_Number_SevenDiagonal',
)
RETARGET_BONES = (
    ('CMU35_lfemur', 'CC_Base_L_Thigh'),
    ('CMU35_ltibia', 'CC_Base_L_Calf'),
    ('CMU35_lfoot', 'CC_Base_L_Foot'),
    ('CMU35_ltoes', 'CC_Base_L_ToeBase'),
    ('CMU35_rfemur', 'CC_Base_R_Thigh'),
    ('CMU35_rtibia', 'CC_Base_R_Calf'),
    ('CMU35_rfoot', 'CC_Base_R_Foot'),
    ('CMU35_rtoes', 'CC_Base_R_ToeBase'),
)
SOURCE_FLOOR_BONES = {
    'Left': ('CMU35_lfoot', 'CMU35_ltoes'),
    'Right': ('CMU35_rfoot', 'CMU35_rtoes'),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-blend', required=True)
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--target-action', default=TARGET_ACTION)
    parser.add_argument('--output-action', default=OUTPUT_ACTION)
    parser.add_argument('--source-loop', default=','.join(str(value) for value in SOURCE_LOOP))
    parser.add_argument('--output-frames', default=','.join(str(value) for value in OUTPUT_FRAMES))
    parser.add_argument('--root-motion-scale', type=float, default=1.0)
    parser.add_argument('--retarget-blend', type=float, default=1.0)
    parser.add_argument('--source-rig', default=SOURCE_RIG)
    parser.add_argument('--source-action', default=SOURCE_ACTION)
    parser.add_argument('--source-prefix', default='CMU35')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def frame_pair(value, label):
    values = tuple(int(item.strip()) for item in value.split(',') if item.strip())
    if len(values) != 2 or values[1] <= values[0]:
        raise RuntimeError(f'{label} must contain two increasing frame numbers.')
    return values


def source_retarget_bones(prefix):
    return tuple(
        (f'{prefix}_{source_name.split("_", 1)[1]}', target_name)
        for source_name, target_name in RETARGET_BONES
    )


def source_floor_bones(prefix):
    return {
        side: tuple(f'{prefix}_{name.split("_", 1)[1]}' for name in names)
        for side, names in SOURCE_FLOOR_BONES.items()
    }


def append_source(source_blend, source_rig, source_action):
    existing = bpy.data.objects.get(source_rig)
    if existing is not None:
        existing.hide_render = True
        existing.hide_set(True)
        return existing
    with bpy.data.libraries.load(str(source_blend), link=False) as (data_from, data_to):
        if source_rig not in data_from.objects:
            raise RuntimeError(f'Missing source rig in CMU workfile: {source_rig}')
        data_to.objects = [source_rig]
    source = data_to.objects[0]
    bpy.context.scene.collection.objects.link(source)
    source.hide_render = True
    source.hide_set(True)
    if source.animation_data is None or source.animation_data.action is None:
        action = bpy.data.actions.get(source_action)
        if action is None:
            raise RuntimeError(f'Missing source action: {source_action}')
        source.animation_data_create()
        source.animation_data.action = action
    return source


def set_fractional_frame(frame):
    whole = math.floor(frame)
    bpy.context.scene.frame_set(whole, subframe=frame - whole)
    bpy.context.view_layer.update()


def direction(pose_bone):
    result = pose_bone.tail - pose_bone.head
    if result.length < 0.0001:
        raise RuntimeError(f'Collapsed source bone: {pose_bone.name}')
    return result.normalized()


def sample_source(source, frame, retarget_bones, floor_bones, root_bone_name):
    set_fractional_frame(frame)
    directions = {
        source_name: direction(source.pose.bones[source_name]).copy()
        for source_name, _ in retarget_bones
    }
    root = source.pose.bones[root_bone_name].head.copy()
    foot_clearance = {}
    for side, bone_names in floor_bones.items():
        floor_points = []
        for bone_name in bone_names:
            bone = source.pose.bones[bone_name]
            floor_points.extend((bone.head.z, bone.tail.z))
        foot_clearance[side] = min(floor_points)
    return {
        'directions': directions,
        'root': root,
        'footClearance': foot_clearance,
    }


def sample_target(target, action, frame):
    target.animation_data.action = action
    set_fractional_frame(frame)
    return {
        'objectMatrix': target.matrix_basis.copy(),
        'bones': {bone.name: bone.matrix_basis.copy() for bone in target.pose.bones},
    }


def aim_bone(armature, bone_name, desired_direction):
    pose_bone = armature.pose.bones.get(bone_name)
    if pose_bone is None:
        raise RuntimeError(f'Missing target retarget bone: {bone_name}')
    target_y = Vector(desired_direction).normalized()
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


def shoe_objects(side):
    token = f'_Shoe_{side}_'
    return [
        obj for obj in bpy.data.objects
        if obj.type == 'MESH'
        and obj.name.startswith('GS_Home_')
        and token in obj.name
    ]


def clean_torso_cosmetics(armature):
    attached = []
    for object_name in RIGID_TORSO_ATTACHMENTS:
        obj = bpy.data.objects.get(object_name)
        if obj is None:
            continue
        world = obj.matrix_world.copy()
        obj.parent = armature
        obj.parent_type = 'BONE'
        obj.parent_bone = 'CC_Base_Spine02'
        obj.matrix_world = world
        attached.append(object_name)
    quarantined = []
    for object_name in QUARANTINED_COSMETICS:
        obj = bpy.data.objects.get(object_name)
        if obj is None:
            continue
        bpy.data.objects.remove(obj, do_unlink=True)
        quarantined.append(object_name)
    bpy.context.view_layer.update()
    return attached, quarantined


def evaluated_minimum_z(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    minimum = None
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            values = [(evaluated.matrix_world @ vertex.co).z for vertex in mesh.vertices]
        finally:
            evaluated.to_mesh_clear()
        if values:
            candidate = min(values)
            minimum = candidate if minimum is None else min(minimum, candidate)
    if minimum is None:
        raise RuntimeError('Accepted shoe meshes produced no evaluated vertices.')
    return minimum


def angular_difference(left, right):
    dot = max(-1.0, min(1.0, left.normalized().dot(right.normalized())))
    return math.degrees(math.acos(dot))


def main():
    args = parse_args()
    source_blend = Path(args.source_blend).resolve()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    source_loop = frame_pair(args.source_loop, 'source loop')
    output_frames = frame_pair(args.output_frames, 'output frames')
    if args.root_motion_scale < 0:
        raise RuntimeError('Root-motion scale cannot be negative.')
    if not 0 < args.retarget_blend <= 1:
        raise RuntimeError('Retarget blend must be greater than zero and no more than one.')
    target_workfile = bpy.data.filepath
    retarget_bones = source_retarget_bones(args.source_prefix)
    floor_bones = source_floor_bones(args.source_prefix)
    root_bone_name = f'{args.source_prefix}_root'
    target = bpy.data.objects.get(TARGET_RIG)
    if target is None:
        raise RuntimeError(f'Missing accepted target rig: {TARGET_RIG}')
    target.animation_data_create()
    authored = bpy.data.actions.get(args.target_action)
    if authored is None:
        raise RuntimeError(f'Missing accepted authored upper-body action: {args.target_action}')
    shoes = {side: shoe_objects(side) for side in floor_bones}
    if any(not objects for objects in shoes.values()):
        raise RuntimeError('Missing accepted home shoe meshes.')
    rigid_torso_attachments, quarantined_cosmetics = clean_torso_cosmetics(target)

    source = append_source(source_blend, args.source_rig, args.source_action)
    source.animation_data.action = bpy.data.actions.get(args.source_action) or source.animation_data.action
    source_start, source_end = source_loop
    output_start, output_end = output_frames
    output_count = output_end - output_start + 1
    authored_start, authored_end = authored.frame_range

    source_samples = []
    target_samples = []
    for index in range(output_count):
        phase = index / (output_count - 1)
        source_frame = source_start + (source_end - source_start) * phase
        authored_frame = authored_start + (authored_end - authored_start) * phase
        source_samples.append(sample_source(source, source_frame, retarget_bones, floor_bones, root_bone_name))
        target_samples.append(sample_target(target, authored, authored_frame))
    source_floor_baseline = {
        side: min(sample['footClearance'][side] for sample in source_samples)
        for side in floor_bones
    }

    existing = bpy.data.actions.get(args.output_action)
    if existing is not None:
        bpy.data.actions.remove(existing)
    output_action = bpy.data.actions.new(args.output_action)
    output_action.use_fake_user = True
    target.animation_data.action = output_action
    source_root_start = source_samples[0]['root']
    grounded_frames = 0
    maximum_clearance = 0.0

    for index, (source_sample, target_sample) in enumerate(zip(source_samples, target_samples)):
        frame = output_start + index
        bpy.context.scene.frame_set(frame)
        target.matrix_basis = target_sample['objectMatrix']
        for bone_name, matrix_basis in target_sample['bones'].items():
            target.pose.bones[bone_name].matrix_basis = matrix_basis
        bpy.context.view_layer.update()

        for source_name, target_name in retarget_bones:
            authored_direction = direction(target.pose.bones[target_name])
            captured_direction = source_sample['directions'][source_name]
            desired_direction = authored_direction.lerp(captured_direction, args.retarget_blend).normalized()
            aim_bone(target, target_name, desired_direction)

        target.location.x += (source_sample['root'].x - source_root_start.x) * args.root_motion_scale
        target.location.y = 0.0
        target.location.z = 0.0
        bpy.context.view_layer.update()
        normalized_clearance = {
            side: max(0.0, source_sample['footClearance'][side] - source_floor_baseline[side])
            for side in floor_bones
        }
        support_side = min(normalized_clearance, key=normalized_clearance.get)
        desired_clearance = normalized_clearance[support_side]
        target.location.z += desired_clearance - evaluated_minimum_z(shoes[support_side])
        bpy.context.view_layer.update()
        resulting_clearance = min(evaluated_minimum_z(objects) for objects in shoes.values())
        if resulting_clearance < 0.0:
            target.location.z -= resulting_clearance
            bpy.context.view_layer.update()
            resulting_clearance = min(evaluated_minimum_z(objects) for objects in shoes.values())
        maximum_clearance = max(maximum_clearance, resulting_clearance)
        if resulting_clearance <= 0.015:
            grounded_frames += 1

        target.keyframe_insert('location', frame=frame)
        target.keyframe_insert('rotation_quaternion', frame=frame)
        target.keyframe_insert('scale', frame=frame)
        for pose_bone in target.pose.bones:
            pose_bone.keyframe_insert('location', frame=frame, group=pose_bone.name)
            pose_bone.keyframe_insert('rotation_quaternion', frame=frame, group=pose_bone.name)
            pose_bone.keyframe_insert('scale', frame=frame, group=pose_bone.name)

    for fcurve in getattr(output_action, 'fcurves', []):
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = 'LINEAR'
    output_action.frame_range = output_frames
    target.animation_data.action = output_action
    bpy.context.scene.render.fps = OUTPUT_FPS
    bpy.context.scene.frame_start = output_start
    bpy.context.scene.frame_end = output_end
    bpy.context.scene.frame_set(output_start)

    seam_angles = [
        angular_difference(source_samples[0]['directions'][name], source_samples[-1]['directions'][name])
        for name, _ in retarget_bones
    ]
    root_travel = (source_samples[-1]['root'] - source_samples[0]['root']).length
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    report = {
        'status': 'retargeted-for-human-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': str(source_blend),
        'targetWorkfile': target_workfile,
        'outputWorkfile': str(output_blend),
        'sourceRig': args.source_rig,
        'sourceAction': args.source_action,
        'authoredUpperBodySource': args.target_action,
        'outputAction': args.output_action,
        'retargetBoundary': 'CMU root-relative leg and foot directions only; accepted authored upper body, two-hand grip, stick control, clothing, and equipment remain authoritative.',
        'sourceLoopFrames': list(source_loop),
        'sourceLoopDurationSeconds': round((source_end - source_start) / SOURCE_FPS, 4),
        'sourceLoopTravelMeters': round(root_travel, 4),
        'rootMotionScale': round(args.root_motion_scale, 6),
        'retargetBlend': round(args.retarget_blend, 6),
        'scaledRootTravelMeters': round(root_travel * args.root_motion_scale, 4),
        'outputFrameRange': list(output_frames),
        'outputFps': OUTPUT_FPS,
        'outputDurationSeconds': round((output_end - output_start) / OUTPUT_FPS, 4),
        'retargetBoneCount': len(retarget_bones),
        'rigidTorsoAttachmentCount': len(rigid_torso_attachments),
        'rigidTorsoAttachments': rigid_torso_attachments,
        'quarantinedCosmeticCount': len(quarantined_cosmetics),
        'quarantinedCosmetics': quarantined_cosmetics,
        'loopSeamMeanAngleDegrees': round(sum(seam_angles) / len(seam_angles), 3),
        'loopSeamMaximumAngleDegrees': round(max(seam_angles), 3),
        'groundedFrameCount': grounded_frames,
        'maximumShoeClearanceMeters': round(maximum_clearance, 4),
        'reviewRule': 'The audition must pass close front, side, three-quarter, real-time loop, planted-foot, and two-hand stick-contact review before replacing an accepted runtime action.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CMU_LOWER_BODY_RETARGETED ' + str(output_report))


if __name__ == '__main__':
    main()
