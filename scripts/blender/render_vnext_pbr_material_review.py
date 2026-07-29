import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


VIEWS = {
    'front': ((0.0, -4.8, 1.32), (0.0, 0.0, 1.0)),
    'rear': ((0.0, 4.8, 1.32), (0.0, 0.0, 1.0)),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


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
    action = bpy.data.actions.get('ready')
    if None in (armature, camera, home, away, action):
        raise RuntimeError('The private PBR review workfile is incomplete.')

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 360
    scene.render.resolution_y = 450
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.camera = camera
    camera.data.lens = 64
    camera.data.dof.use_dof = False
    armature.animation_data_create()
    armature.animation_data.action = action
    scene.frame_set(1)

    outputs = []
    for side, visible, hidden in (('home', home, away), ('away', away, home)):
        visible.hide_render = False
        hidden.hide_render = True
        for view_name, (location, target) in VIEWS.items():
            camera.location = location
            point_camera(camera, target)
            output = output_dir / f'pbr-{side}-ready-{view_name}.png'
            scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
            outputs.append({
                'side': side,
                'action': 'ready',
                'frame': 1,
                'view': view_name,
                'path': str(output),
                'bytes': output.stat().st_size,
            })

    report = {
        'status': 'rendered-for-private-human-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'variants': ['home', 'away'],
        'views': list(VIEWS),
        'outputs': outputs,
        'reviewBoundary': (
            'These renders verify material transport only. The athlete still requires close, side, '
            'three-quarter, broadcast, deformation, grounding, and explicit human visual approval.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PBR_MATERIAL_REVIEW_RENDERED ' + str(output_report))


if __name__ == '__main__':
    main()
