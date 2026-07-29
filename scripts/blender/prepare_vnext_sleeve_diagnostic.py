import argparse
import sys

import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def material(name, color):
    result = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1.0)
    result.use_nodes = True
    principled = result.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (*color, 1.0)
    principled.inputs['Roughness'].default_value = 0.35
    return result


args = parse_args()
torso_material = material('GS_Diagnostic_Torso', (0.02, 0.12, 0.8))
sleeve_material = material('GS_Diagnostic_Sleeve', (0.95, 0.02, 0.55))
for side in ('Home', 'Away'):
    torso = bpy.data.objects.get(f'GS_{side}_Jersey')
    if torso is not None:
        torso.data.materials.clear()
        torso.data.materials.append(torso_material)
    for label in ('Left', 'Right'):
        sleeve = bpy.data.objects.get(f'GS_{side}_Jersey_Sleeve_{label}')
        if sleeve is not None:
            sleeve.data.materials.clear()
            sleeve.data.materials.append(sleeve_material)
bpy.ops.wm.save_as_mainfile(filepath=args.output_blend)
