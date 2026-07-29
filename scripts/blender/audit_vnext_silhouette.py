import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


TARGET_GROUPS = ('Jersey', 'Shoe', 'Glove', 'Helmet')
TARGET_BONES = (
    'CC_Base_Head',
    'CC_Base_L_Hand',
    'CC_Base_R_Hand',
    'CC_Base_L_Foot',
    'CC_Base_R_Foot',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(vector):
    return [round(value, 4) for value in vector]


def local_bounds(obj):
    minimum = Vector((min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    return {
        'minimumCm': rounded(minimum),
        'maximumCm': rounded(maximum),
        'dimensionsCm': rounded(maximum - minimum),
    }


def mesh_record(obj):
    return {
        'vertices': len(obj.data.vertices),
        'faces': len(obj.data.polygons),
        'unweightedVertices': sum(not vertex.groups for vertex in obj.data.vertices),
        'bounds': local_bounds(obj),
        'materials': [material.name for material in obj.data.materials if material],
        'modifiers': [modifier.type for modifier in obj.modifiers],
        'equipmentGroup': obj.get('equipment_group'),
        'silhouetteRevision': obj.get('silhouette_revision'),
    }


def main():
    args = parse_args()
    output = Path(args.output_report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if armature is None:
        raise RuntimeError('Missing GS_FieldPlayer_Rig.')

    objects = {}
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.name.startswith(('GS_Home_', 'GS_Away_')):
            continue
        if any(group in obj.name for group in TARGET_GROUPS):
            objects[obj.name] = mesh_record(obj)

    bones = {}
    for name in TARGET_BONES:
        bone = armature.data.bones.get(name)
        if bone is None:
            raise RuntimeError(f'Missing target bone: {name}')
        bones[name] = {
            'headCm': rounded(bone.head_local),
            'tailCm': rounded(bone.tail_local),
            'lengthCm': round(bone.length, 4),
        }

    cages = sorted(obj.name for obj in bpy.data.objects if '_Helmet_Cage_' in obj.name)
    actions = sorted(action.name for action in bpy.data.actions)
    report = {
        'status': 'audited',
        'sourceWorkfile': bpy.data.filepath,
        'objectCount': len(objects),
        'objects': objects,
        'bones': bones,
        'helmetCageObjects': cages,
        'actionCount': len(actions),
        'actions': actions,
    }
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_SILHOUETTE_AUDIT ' + str(output))


if __name__ == '__main__':
    main()
