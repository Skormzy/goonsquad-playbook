import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--output-preview', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def world_bounds(meshes):
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def point_camera(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def make_material(name, color, roughness=0.72, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1.0)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return material


def main():
    args = parse_args()
    source = Path(args.source).resolve()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    output_preview = Path(args.output_preview).resolve()

    for output in (output_blend, output_report, output_preview):
        output.parent.mkdir(parents=True, exist_ok=True)

    if not source.exists():
        raise FileNotFoundError(source)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.import_scene.fbx(filepath=str(source), use_anim=True)

    imported = list(bpy.context.scene.objects)
    meshes = [obj for obj in imported if obj.type == 'MESH']
    armatures = [obj for obj in imported if obj.type == 'ARMATURE']
    if not meshes or not armatures:
        raise RuntimeError('The clean source must include at least one mesh and one armature.')

    minimum, maximum = world_bounds(meshes)
    dimensions = maximum - minimum

    source_collection = bpy.data.collections.new('GS_FieldPlayer_Source')
    bpy.context.scene.collection.children.link(source_collection)
    for obj in imported:
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        source_collection.objects.link(obj)

    root = bpy.data.objects.new('GS_FieldPlayer_Root', None)
    bpy.context.scene.collection.objects.link(root)
    for obj in imported:
        if obj.parent is None:
            obj.parent = root
    root.location.z = -minimum.z

    armatures[0].name = 'GS_FieldPlayer_Rig'
    source_collection['vnext_asset_status'] = 'source-staged-not-accepted'
    source_collection['public_runtime_allowed'] = False

    clay = make_material('GS_SourceReview_Clay', (0.32, 0.36, 0.42), 0.78)
    for mesh in meshes:
        mesh.data.materials.clear()
        mesh.data.materials.append(clay)

    floor_material = make_material('GS_SourceReview_Floor', (0.055, 0.065, 0.078), 0.88)
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = 'GS_SourceReview_Floor'
    floor.data.materials.append(floor_material)

    center_z = dimensions.z * 0.5
    bpy.ops.object.camera_add(location=(0, -4.6, center_z + 0.12))
    camera = bpy.context.object
    camera.name = 'GS_SourceReview_Camera'
    camera.data.lens = 62
    point_camera(camera, (0, 0, center_z))
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type='AREA', location=(-2.4, -2.8, 4.2))
    key_light = bpy.context.object
    key_light.name = 'GS_SourceReview_Key'
    key_light.data.energy = 850
    key_light.data.shape = 'DISK'
    key_light.data.size = 3.2
    point_camera(key_light, (0, 0, 1.0))

    bpy.ops.object.light_add(type='AREA', location=(2.1, -1.4, 2.6))
    fill_light = bpy.context.object
    fill_light.name = 'GS_SourceReview_Fill'
    fill_light.data.energy = 430
    fill_light.data.size = 2.4
    point_camera(fill_light, (0, 0, 1.0))

    bpy.ops.object.light_add(type='AREA', location=(0, 1.8, 3.5))
    rim_light = bpy.context.object
    rim_light.name = 'GS_SourceReview_Rim'
    rim_light.data.energy = 620
    rim_light.data.size = 2.0
    point_camera(rim_light, (0, 0, 1.2))

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 720
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(output_preview)
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('GS_SourceReview_World')
    scene.world.color = (0.012, 0.015, 0.02)

    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    bpy.ops.render.render(write_still=True)

    report = {
        'status': 'source-staged-not-accepted',
        'source': str(source),
        'workfile': str(output_blend),
        'preview': str(output_preview),
        'publicRuntimeAllowed': False,
        'meshCount': len(meshes),
        'armatureCount': len(armatures),
        'meshNames': sorted(obj.name for obj in meshes),
        'armatureNames': sorted(obj.name for obj in armatures),
        'actionNames': sorted(action.name for action in bpy.data.actions),
        'sourceDimensionsMeters': {
            'width': round(dimensions.x, 4),
            'depth': round(dimensions.y, 4),
            'height': round(dimensions.z, 4),
        },
        'requiredNextPass': 'Review clean anatomy and deformation before authoring clothing, equipment, or motion.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
