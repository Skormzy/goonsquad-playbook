import json

import bpy


def has_operator(group_name, operator_name):
    group = getattr(bpy.ops, group_name, None)
    return bool(group and hasattr(group, operator_name))


info = {
    "version": bpy.app.version_string,
    "version_tuple": list(bpy.app.version),
    "has_gltf_import": has_operator("import_scene", "gltf"),
    "has_gltf_export": has_operator("export_scene", "gltf"),
    "has_fbx_import": has_operator("import_scene", "fbx"),
}

print("GOON_BLENDER_PROBE " + json.dumps(info, sort_keys=True))
