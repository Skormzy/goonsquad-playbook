import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_object(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def reset_pose(armature, root, root_z):
    if armature.animation_data:
        armature.animation_data.action = None
    armature.data.pose_position = 'POSE'
    for bone in armature.pose.bones:
        bone.matrix_basis.identity()
    root.location.z = root_z
    bpy.context.view_layer.update()


def aim_bone(armature, bone_name, direction):
    pose_bone = armature.pose.bones.get(bone_name)
    if pose_bone is None:
        raise KeyError(f'Missing review bone: {bone_name}')

    target_y = Vector(direction).normalized()
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


def apply_stick_ready_pose(armature):
    directions = [
        ('CC_Base_L_Upperarm', (0.74, -0.43, -0.52)),
        ('CC_Base_R_Upperarm', (-0.74, -0.43, -0.52)),
        ('CC_Base_L_Forearm', (-0.18, -0.72, -0.67)),
        ('CC_Base_R_Forearm', (0.18, -0.72, -0.67)),
        ('CC_Base_L_Hand', (-0.08, -0.95, -0.30)),
        ('CC_Base_R_Hand', (0.08, -0.95, -0.30)),
        ('CC_Base_L_Thigh', (0.10, -0.16, -0.98)),
        ('CC_Base_R_Thigh', (-0.10, -0.16, -0.98)),
        ('CC_Base_L_Calf', (0.02, 0.24, -0.97)),
        ('CC_Base_R_Calf', (-0.02, 0.24, -0.97)),
        ('CC_Base_L_Foot', (0.02, -0.99, -0.08)),
        ('CC_Base_R_Foot', (-0.02, -0.99, -0.08)),
    ]
    for bone_name, direction in directions:
        aim_bone(armature, bone_name, direction)


def apply_lunge_pose(armature):
    directions = [
        ('CC_Base_L_Upperarm', (0.76, -0.36, -0.54)),
        ('CC_Base_R_Upperarm', (-0.72, 0.30, -0.62)),
        ('CC_Base_L_Forearm', (-0.14, -0.70, -0.70)),
        ('CC_Base_R_Forearm', (0.10, 0.54, -0.84)),
        ('CC_Base_L_Hand', (-0.04, -0.92, -0.38)),
        ('CC_Base_R_Hand', (0.04, 0.84, -0.54)),
        ('CC_Base_L_Thigh', (0.08, -0.48, -0.87)),
        ('CC_Base_R_Thigh', (-0.08, 0.30, -0.95)),
        ('CC_Base_L_Calf', (0.02, 0.28, -0.96)),
        ('CC_Base_R_Calf', (-0.02, -0.20, -0.98)),
        ('CC_Base_L_Foot', (0.02, -0.99, -0.05)),
        ('CC_Base_R_Foot', (-0.02, -0.99, -0.05)),
    ]
    for bone_name, direction in directions:
        aim_bone(armature, bone_name, direction)


def evaluated_min_z(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for mesh in meshes:
        evaluated = mesh.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    return min(point.z for point in points)


def ground_character(meshes, root):
    bpy.context.view_layer.update()
    root.location.z -= evaluated_min_z(meshes)
    bpy.context.view_layer.update()


def render_view(scene, camera, output_dir, name, position, target, lens):
    camera.location = position
    camera.data.lens = lens
    point_object(camera, target)
    output = output_dir / f'{name}.png'
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return str(output)


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    root = bpy.data.objects.get('GS_FieldPlayer_Root')
    camera = bpy.data.objects.get('GS_SourceReview_Camera')
    meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.name != 'GS_SourceReview_Floor']
    if armature is None or root is None or camera is None or not meshes:
        raise RuntimeError('The staged vNext source workfile is incomplete.')

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 600
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.dof.use_dof = False
    root_z = root.location.z
    outputs = []

    reset_pose(armature, root, root_z)
    views = [
        ('neutral-front', (0, -4.1, 1.03), (0, 0, 0.93), 62),
        ('neutral-side', (4.1, 0, 1.03), (0, 0, 0.93), 62),
        ('neutral-rear', (0, 4.1, 1.03), (0, 0, 0.93), 62),
        ('neutral-three-quarter', (3.15, -3.15, 1.18), (0, 0, 0.95), 65),
        ('neutral-broadcast', (5.8, -7.4, 4.0), (0, 0, 0.92), 68),
    ]
    for name, position, target, lens in views:
        outputs.append(render_view(scene, camera, output_dir, name, position, target, lens))

    reset_pose(armature, root, root_z)
    apply_stick_ready_pose(armature)
    ground_character(meshes, root)
    outputs.append(render_view(scene, camera, output_dir, 'deformation-stick-ready-front', (0, -4.1, 1.02), (0, 0, 0.90), 62))
    outputs.append(render_view(scene, camera, output_dir, 'deformation-stick-ready-three-quarter', (3.15, -3.15, 1.15), (0, 0, 0.91), 65))

    reset_pose(armature, root, root_z)
    apply_lunge_pose(armature)
    ground_character(meshes, root)
    outputs.append(render_view(scene, camera, output_dir, 'deformation-lunge-side', (4.1, 0, 1.02), (0, 0, 0.88), 62))
    outputs.append(render_view(scene, camera, output_dir, 'deformation-lunge-three-quarter', (3.15, -3.15, 1.15), (0, 0, 0.90), 65))

    reset_pose(armature, root, root_z)
    report = {
        'status': 'rendered-for-human-review',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'renderCount': len(outputs),
        'renders': outputs,
        'reviewedJoints': ['shoulders', 'elbows', 'wrists', 'hips', 'knees', 'ankles'],
        'approvalRule': 'Human visual review is required. Render completion does not approve the asset.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
