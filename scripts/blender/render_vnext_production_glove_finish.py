import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


FIT_REVISION = 'production-integrated-source-fit-v2'
FINISH_REVISION = 'tucked-sleeve-manufactured-finish-v1'
ACTION_FRAMES = {
    'ready': 1,
    'pass': 16,
    'shot': 20,
}
HOME_VIEWS = ('front', 'left-three-quarter', 'right-three-quarter')
AWAY_VIEWS = ('front', 'left-three-quarter')


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


def finished_objects(collection, side):
    prefix = f'_Glove_{side}_'
    return [
        obj
        for obj in collection.all_objects
        if obj.type == 'MESH'
        and prefix in obj.name
        and (
            obj.get('production_glove_fit_revision') == FIT_REVISION
            or obj.get('production_glove_finish_revision') == FINISH_REVISION
        )
    ]


def view_offset(view):
    if view == 'front':
        return Vector((0.0, -0.54, 0.025))
    if view == 'left-three-quarter':
        return Vector((0.39, -0.42, 0.07))
    return Vector((-0.39, -0.42, 0.07))


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
        raise RuntimeError('The private finished-glove review workfile is incomplete.')

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.lens = 86
    camera.data.clip_start = 0.01
    camera.data.dof.use_dof = False
    armature.animation_data_create()

    outputs = []
    for variant, visible, hidden, action_frames, views in (
        ('home', home, away, ACTION_FRAMES, HOME_VIEWS),
        ('away', away, home, {'ready': 1}, AWAY_VIEWS),
    ):
        visible.hide_render = False
        hidden.hide_render = True
        for action_name, frame in action_frames.items():
            action = bpy.data.actions.get(action_name)
            if action is None:
                raise RuntimeError(f'Missing finished-glove review action: {action_name}')
            armature.animation_data.action = action
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            for side in ('Left', 'Right'):
                objects = finished_objects(visible, side)
                if len(objects) != 32:
                    raise RuntimeError(
                        f'Expected 32 finished {variant} {side} glove objects, found {len(objects)}.'
                    )
                target = evaluated_bounds_center(objects)
                for view in views:
                    camera.location = target + view_offset(view)
                    point_camera(camera, target)
                    output = output_dir / (
                        f'production-glove-finish-{variant}-{side.lower()}-'
                        f'{action_name}-{view}-frame-{frame:03d}.png'
                    )
                    scene.render.filepath = str(output)
                    bpy.ops.render.render(write_still=True)
                    outputs.append({
                        'variant': variant,
                        'side': side.lower(),
                        'action': action_name,
                        'frame': frame,
                        'view': view,
                        'path': str(output),
                    })

    report = {
        'status': 'rendered-for-private-production-glove-finish-review',
        'decision': 'human-review-required',
        'finishRevision': FINISH_REVISION,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'visibleBrowserWindowOpened': False,
        'visibleBlenderWindowOpened': False,
        'sourceWorkfile': bpy.data.filepath,
        'resolution': [512, 512],
        'outputs': outputs,
        'reviewBoundary': (
            'The close set must prove hidden sleeve openings, segmented manufactured cuffs, '
            'controlled leather grain, palm and thread separation, covered hands, left-right fit, '
            'and stable ready, pass, and shot shapes.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_FINISH_REVIEW_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
