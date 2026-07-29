import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SAMPLE_FRAMES = (15, 45, 75, 105, 135)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--rig-name', default='CMU35_Source_Rig')
    parser.add_argument('--subject-prefix', default='CMU35')
    parser.add_argument('--file-prefix', default='cmu-35-24')
    parser.add_argument('--sample-frames', default=','.join(str(value) for value in SAMPLE_FRAMES))
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def material(name, color):
    result = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1.0)
    result.use_nodes = True
    result.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*color, 1.0)
    result.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.58
    return result


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


def make_bone_visual(name, color):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.018, depth=1.0)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(color)
    return obj


def update_bone_visual(obj, pose_bone, armature):
    head = armature.matrix_world @ pose_bone.head
    tail = armature.matrix_world @ pose_bone.tail
    direction = tail - head
    obj.location = (head + tail) * 0.5
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    obj.scale = (1.0, 1.0, max(direction.length, 0.001))


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    sample_frames = tuple(int(value.strip()) for value in args.sample_frames.split(',') if value.strip())
    if len(sample_frames) != 5:
        raise RuntimeError('Source review requires five sample frames.')
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    armature = bpy.data.objects.get(args.rig_name)
    if armature is None or armature.animation_data is None or armature.animation_data.action is None:
        raise RuntimeError('The converted CMU source rig or action is missing.')

    dark = material(f'{args.subject_prefix}_Dark_Bone', (0.08, 0.12, 0.16))
    accent = material(f'{args.subject_prefix}_Accent_Bone', (0.0, 0.78, 0.95))
    visuals = {}
    for pose_bone in armature.pose.bones:
        color = accent if any(token in pose_bone.name for token in ('femur', 'tibia', 'foot', 'root')) else dark
        visuals[pose_bone.name] = make_bone_visual(f'{args.subject_prefix}_Visual_{pose_bone.name}', color)

    bpy.ops.mesh.primitive_plane_add(size=100, location=(0, 0, 0))
    floor = bpy.context.object
    floor.data.materials.append(material(f'{args.subject_prefix}_Floor', (0.24, 0.28, 0.31)))

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.lens = 72
    camera.data.dof.use_dof = False
    scene.camera = camera
    bpy.ops.object.light_add(type='AREA', location=(2.5, -2.0, 5.0))
    bpy.context.object.data.energy = 1100
    bpy.context.object.data.shape = 'DISK'
    bpy.context.object.data.size = 5.0
    bpy.ops.object.light_add(type='AREA', location=(-3.0, 1.5, 2.8))
    bpy.context.object.data.energy = 650
    bpy.context.object.data.size = 4.0

    world = scene.world or bpy.data.worlds.new(f'{args.subject_prefix}_World')
    scene.world = world
    world.color = (0.025, 0.035, 0.05)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False

    outputs = []
    root_bone_name = f'{args.subject_prefix}_root'
    for frame in sample_frames:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        for pose_bone in armature.pose.bones:
            update_bone_visual(visuals[pose_bone.name], pose_bone, armature)
        root = armature.matrix_world @ armature.pose.bones[root_bone_name].head
        camera.location = root + Vector((1.9, -2.8, 1.25))
        point_camera(camera, root + Vector((0.0, 0.0, 0.45)))
        bpy.context.view_layer.update()
        output = output_dir / f'{args.file_prefix}-frame-{frame:03d}.png'
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(output))

    report = {
        'status': 'rendered-for-source-review',
        'decision': 'not-retarget-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'sampleFrames': list(sample_frames),
        'outputs': outputs,
        'reviewRule': 'The converted skeleton must preserve a coherent upright human hierarchy and captured gait progression before retargeting.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_CMU_SOURCE_REVIEW_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
