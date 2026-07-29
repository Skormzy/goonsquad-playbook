import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
ARM_BONES = {
    'left': (
        'CC_Base_L_Upperarm',
        'CC_Base_L_Forearm',
        'CC_Base_L_Hand',
    ),
    'right': (
        'CC_Base_R_Upperarm',
        'CC_Base_R_Forearm',
        'CC_Base_R_Hand',
    ),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-glb', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--output-render', required=True)
    parser.add_argument('--action', default='sprint')
    parser.add_argument('--frame', type=float, default=15.0)
    parser.add_argument('--view', choices=('front', 'rear', 'side'), default='rear')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def round_vector(vector, digits=5):
    return [round(value, digits) for value in vector]


def angle_degrees(first, second):
    if first.length <= 1e-8 or second.length <= 1e-8:
        return 0.0
    dot = max(-1.0, min(1.0, first.normalized().dot(second.normalized())))
    return math.degrees(math.acos(dot))


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


def configure_review_scene(scene, view):
    world = bpy.data.worlds.new('GS_Export_Audit_World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.025, 0.03, 0.04, 1.0)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.32
    scene.world = world

    floor_data = bpy.data.meshes.new('GS_Export_Audit_Floor_Mesh')
    floor = bpy.data.objects.new('GS_Export_Audit_Floor', floor_data)
    bpy.context.collection.objects.link(floor)
    floor_data.from_pydata(
        [(-3.2, -3.2, 0.0), (3.2, -3.2, 0.0), (3.2, 3.2, 0.0), (-3.2, 3.2, 0.0)],
        [],
        [(0, 1, 2, 3)],
    )
    floor_material = bpy.data.materials.new('GS_Export_Audit_Floor_Material')
    floor_material.diffuse_color = (0.11, 0.13, 0.16, 1.0)
    floor.data.materials.append(floor_material)

    light_data = bpy.data.lights.new('GS_Export_Audit_Key_Data', type='AREA')
    light_data.energy = 950.0
    light_data.shape = 'DISK'
    light_data.size = 4.0
    light = bpy.data.objects.new('GS_Export_Audit_Key', light_data)
    bpy.context.collection.objects.link(light)
    light.location = (-2.2, -2.8, 4.8)

    fill_data = bpy.data.lights.new('GS_Export_Audit_Fill_Data', type='AREA')
    fill_data.energy = 500.0
    fill_data.size = 3.0
    fill = bpy.data.objects.new('GS_Export_Audit_Fill', fill_data)
    bpy.context.collection.objects.link(fill)
    fill.location = (2.4, 1.8, 3.2)

    camera_data = bpy.data.cameras.new('GS_Export_Audit_Camera_Data')
    camera = bpy.data.objects.new('GS_Export_Audit_Camera', camera_data)
    bpy.context.collection.objects.link(camera)
    locations = {
        'front': (0.0, -4.8, 1.35),
        'rear': (0.0, 4.8, 1.35),
        'side': (4.8, 0.0, 1.35),
    }
    camera.location = locations[view]
    camera.data.lens = 68
    point_camera(camera, (0.0, 0.0, 1.02))
    scene.camera = camera

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 640
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.look = 'AgX - Medium High Contrast'


def arm_report(armature, side):
    upper_name, forearm_name, hand_name = ARM_BONES[side]
    upper = armature.pose.bones[upper_name]
    forearm = armature.pose.bones[forearm_name]
    hand = armature.pose.bones[hand_name]
    shoulder = armature.matrix_world @ upper.head
    elbow = armature.matrix_world @ forearm.head
    wrist = armature.matrix_world @ hand.head
    return {
        'shoulder': round_vector(shoulder),
        'elbow': round_vector(elbow),
        'wrist': round_vector(wrist),
        'elbowBendDegrees': round(angle_degrees(shoulder - elbow, wrist - elbow), 3),
        'shoulderToWristMeters': round((wrist - shoulder).length, 5),
    }


def main():
    args = parse_args()
    input_glb = Path(args.input_glb).resolve()
    output_report = Path(args.output_report).resolve()
    output_render = Path(args.output_render).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)
    output_render.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(input_glb), import_shading='NORMALS')
    armature = bpy.data.objects.get(ARMATURE_NAME)
    action = bpy.data.actions.get(args.action)
    if armature is None or action is None:
        raise RuntimeError(f'Missing exported armature or action: {ARMATURE_NAME}, {args.action}')

    armature.animation_data_create()
    armature.animation_data.action = action
    scene = bpy.context.scene
    scene.render.fps = 30
    frame = int(math.floor(args.frame))
    scene.frame_set(frame, subframe=args.frame - frame)
    bpy.context.view_layer.update()

    configure_review_scene(scene, args.view)
    scene.render.filepath = str(output_render)
    bpy.ops.render.render(write_still=True)

    report = {
        'status': 'exported-glb-pose-audited',
        'inputGlb': str(input_glb),
        'action': args.action,
        'frame': args.frame,
        'view': args.view,
        'render': str(output_render),
        'actions': sorted(action.name for action in bpy.data.actions),
        'armature': ARMATURE_NAME,
        'arms': {
            side: arm_report(armature, side)
            for side in ARM_BONES
        },
        'skinnedMeshes': sorted(
            obj.name
            for obj in bpy.data.objects
            if obj.type == 'MESH' and any(modifier.type == 'ARMATURE' for modifier in obj.modifiers)
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_EXPORTED_POSE_AUDITED ' + str(output_report))


if __name__ == '__main__':
    main()
