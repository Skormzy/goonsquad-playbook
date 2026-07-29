import argparse
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-fbx', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def connected_components(mesh):
    adjacency = defaultdict(set)
    for edge in mesh.edges:
        first, second = edge.vertices
        adjacency[first].add(second)
        adjacency[second].add(first)
    remaining = set(range(len(mesh.vertices)))
    components = []
    while remaining:
        root = remaining.pop()
        queue = deque([root])
        component = {root}
        while queue:
            vertex = queue.popleft()
            for neighbor in adjacency[vertex]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)
        components.append(component)
    return sorted(components, key=len, reverse=True)


def material_images(material):
    if material is None or not material.use_nodes:
        return []
    return [
        {
            'node': node.name,
            'image': node.image.name,
            'filepath': bpy.path.abspath(node.image.filepath),
        }
        for node in material.node_tree.nodes
        if node.type == 'TEX_IMAGE' and node.image
    ]


def component_report(obj, component):
    counts = defaultdict(int)
    for polygon in obj.data.polygons:
        if polygon.vertices[0] in component:
            counts[polygon.material_index] += 1
    coordinates = [obj.data.vertices[index].co for index in component]
    return {
        'vertices': len(component),
        'centerCm': [
            round(sum(coordinate[axis] for coordinate in coordinates) / len(coordinates), 6)
            for axis in range(3)
        ],
        'materialPolygonCounts': dict(sorted(counts.items())),
    }


def main():
    args = parse_args()
    source = Path(args.source_fbx).resolve()
    output = Path(args.output_report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source), use_anim=False)
    eye = bpy.data.objects.get('CC_Base_Eye')
    if eye is None:
        raise RuntimeError('The licensed source FBX does not contain CC_Base_Eye.')

    report = {
        'status': 'licensed-source-eye-materials-audited',
        'sourceFbx': str(source),
        'publicRuntimeAllowed': False,
        'materials': [
            {
                'index': index,
                'name': material.name if material else None,
                'diffuseColor': [round(value, 6) for value in material.diffuse_color] if material else None,
                'images': material_images(material),
            }
            for index, material in enumerate(eye.data.materials)
        ],
        'components': [
            component_report(eye, component)
            for component in connected_components(eye.data)
        ],
        'uvLayers': [
            {'name': layer.name, 'activeRender': layer.active_render}
            for layer in eye.data.uv_layers
        ],
        'reviewRule': 'Preserve the licensed inner-eye and corneal-shell assignments in the private candidate.',
    }
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_SOURCE_EYE_MATERIALS_AUDITED ' + str(output))


if __name__ == '__main__':
    main()
