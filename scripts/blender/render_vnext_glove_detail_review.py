import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ACTION_FRAMES = {
    'ready': 1,
    'pass': 16,
    'shot': 20,
}
VIEW_OFFSETS = {
    'front': Vector((0.0, -1.55, 0.12)),
    'left-three-quarter': Vector((1.15, -1.25, 0.30)),
    'right-three-quarter': Vector((-1.15, -1.25, 0.30)),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()


def evaluated_bounds_center(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    minimum = Vector((min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector((max(point[axis] for point in points) for axis in range(3)))
    return (minimum + maximum) * 0.5


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    camera = bpy.data.objects.get('GS_SourceReview_Camera')
    home = bpy.data.collections.get('GS_Equipment_Home')
    away = bpy.data.collections.get('GS_Equipment_Away')
    if armature is None or camera is None or home is None or away is None:
        raise RuntimeError('The glove close-review workfile is incomplete.')

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.lens = 82
    camera.data.dof.use_dof = False
    armature.animation_data_create()

    outputs = []
    for variant, visible, hidden in (
        ('home', home, away),
        ('away', away, home),
    ):
        visible.hide_render = False
        hidden.hide_render = True
        glove_objects = [
            obj for obj in visible.all_objects
            if obj.type == 'MESH' and '_Glove_' in obj.name
        ]
        if len(glove_objects) != 18:
            raise RuntimeError(f'Expected 18 {variant} glove parts, found {len(glove_objects)}.')
        for action_name, frame in ACTION_FRAMES.items():
            action = bpy.data.actions.get(action_name)
            if action is None:
                raise RuntimeError(f'Missing glove review action: {action_name}')
            armature.animation_data.action = action
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            target = evaluated_bounds_center(glove_objects)
            for view_name, offset in VIEW_OFFSETS.items():
                camera.location = target + offset
                point_camera(camera, target)
                output = output_dir / (
                    f'glove-{variant}-{action_name}-{view_name}-frame-{frame:03d}.png'
                )
                scene.render.filepath = str(output)
                bpy.ops.render.render(write_still=True)
                outputs.append({
                    'variant': variant,
                    'action': action_name,
                    'frame': frame,
                    'view': view_name,
                    'path': str(output),
                })

    report = {
        'status': 'rendered-for-private-glove-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'actionFrames': ACTION_FRAMES,
        'views': list(VIEW_OFFSETS),
        'outputs': outputs,
        'reviewBoundary': (
            'The close set must show a hockey-glove silhouette, segmented finger and thumb '
            'protection, palm-to-shaft contact, cuff clearance, and no exposed bare hand geometry.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_GLOVE_DETAIL_REVIEW_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
