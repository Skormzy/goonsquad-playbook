import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


VIEWS = {
    'backhand': Vector((-0.02, 0.43, 0.035)),
    'palm': Vector((-0.02, -0.43, 0.025)),
    'thumb-three-quarter': Vector((0.33, -0.30, 0.15)),
    'pinky-three-quarter': Vector((-0.31, 0.31, 0.14)),
    'cuff': Vector((-0.41, -0.20, 0.07)),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    base = bpy.data.objects.get('GS_Production_Glove_Base')
    camera = bpy.data.objects.get('GS_Glove_Review_Camera')
    if base is None or camera is None:
        raise RuntimeError('The production glove review scene is incomplete.')

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.85
    scene.camera = camera
    camera.data.lens = 74
    camera.data.dof.use_dof = False

    target = Vector((-0.015, 0.0, 0.0))
    outputs = []
    for view_name, camera_location in VIEWS.items():
        camera.location = camera_location
        point_camera(camera, target)
        output = output_dir / f'production-glove-base-{view_name}.png'
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append({
            'view': view_name,
            'path': str(output),
            'cameraLocation': [round(float(value), 4) for value in camera.location],
        })

    report = {
        'status': 'standalone-production-glove-base-rendered',
        'decision': 'human-review-required',
        'publicRuntimeAllowed': False,
        'visibleBrowserWindowOpened': False,
        'visibleBlenderWindowOpened': False,
        'sourceWorkfile': bpy.data.filepath,
        'resolution': [768, 768],
        'views': list(VIEWS),
        'outputs': outputs,
        'reviewBoundary': (
            'Backhand, palm, thumb, pinky, cuff opening, finger wrap, shaft contact, and '
            'manufactured pad transitions must all read credibly before athlete fitting.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_BASE_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
