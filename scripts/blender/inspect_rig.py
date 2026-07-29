import argparse
import json
import sys
from pathlib import Path

import bpy
import mathutils


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_source(source):
    suffix = source.suffix.lower()
    if suffix in [".glb", ".gltf"]:
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source))
    else:
        raise RuntimeError(f"Unsupported source format: {source}")


def main():
    args = parse_args()
    source = Path(args.source)
    clear_scene()
    import_source(source)

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    objects = []
    for obj in bpy.context.scene.objects:
        bounds = []
        if obj.type == "MESH":
            for corner in obj.bound_box:
                world = obj.matrix_world @ mathutils.Vector(corner)
                bounds.append([round(world.x, 4), round(world.y, 4), round(world.z, 4)])
        objects.append({
            "name": obj.name,
            "type": obj.type,
            "location": [round(value, 4) for value in obj.location],
            "dimensions": [round(value, 4) for value in obj.dimensions],
            "bounds": bounds,
            "materials": [slot.material.name for slot in obj.material_slots if slot.material],
        })
    bones = []
    for armature in armatures:
        bones.extend([bone.name for bone in armature.data.bones])

    print("GOON_RIG_INSPECT " + json.dumps({
        "source": str(source),
        "armatures": [obj.name for obj in armatures],
        "objectCount": len(objects),
        "objects": objects,
        "boneCount": len(bones),
        "bones": bones,
        "actions": [action.name for action in bpy.data.actions],
    }, sort_keys=True))


if __name__ == "__main__":
    main()
