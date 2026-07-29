import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def render(scene, camera, output_dir, name, position, target, lens):
    camera.location = position
    camera.data.lens = lens
    point_camera(camera, target)
    output = output_dir / f'{name}.png'
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return str(output)


def set_variant(home, away, side):
    home.hide_render = side != 'home'
    away.hide_render = side != 'away'
    bpy.context.view_layer.update()


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_report = Path(args.output_report).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    camera = bpy.data.objects.get('GS_SourceReview_Camera')
    home = bpy.data.collections.get('GS_Equipment_Home')
    away = bpy.data.collections.get('GS_Equipment_Away')
    if camera is None or home is None or away is None:
        raise RuntimeError('The authored equipment workfile is incomplete.')

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.dof.use_dof = False

    views = [
        ('front', (0, -4.4, 1.05), (0, 0, 0.92), 60),
        ('three-quarter', (3.25, -3.55, 1.20), (0, 0, 0.96), 65),
        ('rear', (0, 4.4, 1.05), (0, 0, 0.94), 60),
        ('upper-close', (0, -2.45, 1.43), (0, 0, 1.42), 72),
        ('lower-close', (0, -2.45, 0.48), (0, 0, 0.48), 72),
        ('stick-close', (0.90, -2.25, 0.88), (0.90, -0.08, 0.88), 70),
    ]
    outputs = []
    for side in ('home', 'away'):
        set_variant(home, away, side)
        for view_name, position, target, lens in views:
            outputs.append(render(
                scene,
                camera,
                output_dir,
                f'{side}-{view_name}',
                position,
                target,
                lens,
            ))

    set_variant(home, away, 'home')
    report = {
        'status': 'rendered-for-human-review',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'renderCount': len(outputs),
        'renders': outputs,
        'variants': ['home', 'away'],
        'reviewedEquipment': ['jersey', 'shorts', 'shoes', 'gloves', 'helmet', 'stick'],
        'approvalRule': 'Human close-camera review is required. Render completion does not approve the equipment.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
