import argparse
import json
import sys
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def main():
    args = parse_args()
    output = Path(args.output_report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    objects = {}
    for name in ('CC_Base_Eye', 'CC_Base_EyeOcclusion', 'CC_Base_TearLine'):
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise RuntimeError(f'Missing {name}.')
        objects[name] = {
            'bounds': [list(corner) for corner in obj.bound_box],
            'materials': [],
        }
        for material in obj.data.materials:
            images = []
            if material and material.node_tree:
                for node in material.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image:
                        images.append({
                            'node': node.name,
                            'image': node.image.name,
                            'size': list(node.image.size),
                            'source': node.image.source,
                            'filepath': bpy.path.abspath(node.image.filepath),
                            'packed': node.image.packed_file is not None,
                        })
            objects[name]['materials'].append({
                'name': material.name if material else None,
                'images': images,
                'blendMethod': getattr(material, 'surface_render_method', None) if material else None,
            })
    output.write_text(json.dumps({'objects': objects}, indent=2), encoding='utf-8')
    print('GOON_VNEXT_EYE_MATERIAL_AUDITED ' + str(output))


if __name__ == '__main__':
    main()
