import argparse
import json
import sys
from pathlib import Path

import bpy


REVIEW_COLLECTIONS = ('GS_FieldPlayer_Source', 'GS_Equipment_Home', 'GS_Equipment_Away')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def socket_value(node, name):
    socket = node.inputs.get(name)
    if socket is None or not hasattr(socket, 'default_value'):
        return None
    value = socket.default_value
    if hasattr(value, '__len__') and not isinstance(value, str):
        return [round(float(component), 6) for component in value]
    return round(float(value), 6)


def material_report(material):
    principled = None
    texture_nodes = []
    if material.use_nodes and material.node_tree:
        for node in material.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                principled = {
                    'baseColor': socket_value(node, 'Base Color'),
                    'metallic': socket_value(node, 'Metallic'),
                    'roughness': socket_value(node, 'Roughness'),
                    'ior': socket_value(node, 'IOR'),
                }
            elif node.type == 'TEX_IMAGE':
                image = node.image
                texture_nodes.append({
                    'node': node.name,
                    'image': image.name if image else None,
                    'source': image.source if image else None,
                    'file': bpy.path.abspath(image.filepath) if image and image.filepath else None,
                    'colorspace': image.colorspace_settings.name if image else None,
                })
    return {
        'name': material.name,
        'useNodes': material.use_nodes,
        'blendMethod': getattr(material, 'surface_render_method', None),
        'principled': principled,
        'imageTextures': texture_nodes,
    }


def mesh_report(obj):
    mesh = obj.data
    return {
        'name': obj.name,
        'collections': sorted(collection.name for collection in obj.users_collection),
        'vertices': len(mesh.vertices),
        'polygons': len(mesh.polygons),
        'uvLayers': [layer.name for layer in mesh.uv_layers],
        'activeUv': mesh.uv_layers.active.name if mesh.uv_layers.active else None,
        'materials': [slot.material.name if slot.material else None for slot in obj.material_slots],
        'armatureModifiers': [
            modifier.object.name if modifier.object else None
            for modifier in obj.modifiers
            if modifier.type == 'ARMATURE'
        ],
    }


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)

    review_objects = {}
    for collection_name in REVIEW_COLLECTIONS:
        collection = bpy.data.collections.get(collection_name)
        if collection is None:
            raise RuntimeError(f'Missing review collection: {collection_name}')
        for obj in collection.all_objects:
            if obj.type == 'MESH':
                review_objects[obj.name] = obj

    meshes = [mesh_report(obj) for obj in sorted(review_objects.values(), key=lambda item: item.name)]
    material_names = sorted({
        material_name
        for mesh in meshes
        for material_name in mesh['materials']
        if material_name
    })
    materials = [material_report(bpy.data.materials[name]) for name in material_names]
    report = {
        'status': 'audited',
        'sourceWorkfile': bpy.data.filepath,
        'collections': list(REVIEW_COLLECTIONS),
        'meshCount': len(meshes),
        'materialCount': len(materials),
        'uvReadyMeshCount': sum(bool(mesh['uvLayers']) for mesh in meshes),
        'imageTextureNodeCount': sum(len(material['imageTextures']) for material in materials),
        'meshes': meshes,
        'materials': materials,
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_MATERIALS_AUDITED ' + str(output_report))


if __name__ == '__main__':
    main()
