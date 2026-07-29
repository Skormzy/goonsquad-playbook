import argparse
import json
import sys
from pathlib import Path

import bpy


SAMPLE_FRAMES = (1, 4, 7, 11)
BONES = (
    'CC_Base_Spine01',
    'CC_Base_Spine02',
    'CC_Base_L_Clavicle',
    'CC_Base_L_Upperarm',
    'CC_Base_R_Clavicle',
    'CC_Base_R_Upperarm',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(values):
    return [round(value, 4) for value in values]


def evaluated_bounds(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    finally:
        evaluated.to_mesh_clear()
    if not points:
        return None
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    return {
        'minimum': rounded(minimum),
        'maximum': rounded(maximum),
        'dimensions': rounded([maximum[index] - minimum[index] for index in range(3)]),
    }


def attachment(obj):
    if obj is None:
        return None
    local_bounds = None
    if obj.type == 'MESH' and obj.data.vertices:
        minimum = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
        maximum = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
        local_bounds = {
            'minimum': rounded(minimum),
            'maximum': rounded(maximum),
            'dimensions': rounded([maximum[index] - minimum[index] for index in range(3)]),
        }
    return {
        'name': obj.name,
        'type': obj.type,
        'parent': obj.parent.name if obj.parent else None,
        'parentType': obj.parent_type,
        'parentBone': obj.parent_bone,
        'armatureModifiers': [
            modifier.object.name if modifier.object else None
            for modifier in obj.modifiers
            if modifier.type == 'ARMATURE'
        ],
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
        'localBounds': local_bounds,
    }


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if armature is None:
        raise RuntimeError('Missing GS_FieldPlayer_Rig.')

    bones = {}
    for name in BONES:
        bone = armature.data.bones.get(name)
        if bone is None:
            raise RuntimeError(f'Missing required uniform bone: {name}')
        bones[name] = {
            'head': rounded(bone.head_local),
            'tail': rounded(bone.tail_local),
            'length': round(bone.length, 4),
        }

    variants = {}
    for side in ('Home', 'Away'):
        jersey = bpy.data.objects.get(f'GS_{side}_Jersey')
        stripe = bpy.data.objects.get(f'GS_{side}_Jersey_Sleeve_Stripes')
        front = bpy.data.objects.get(f'GS_{side}_Jersey_Front_Mark')
        back_objects = sorted(
            (obj for obj in bpy.data.objects if obj.name.startswith(f'GS_{side}_Jersey_Back_Number')),
            key=lambda obj: obj.name,
        )
        if jersey is None:
            raise RuntimeError(f'Missing {side} jersey.')
        frame_bounds = {}
        for frame in SAMPLE_FRAMES:
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            frame_bounds[str(frame)] = evaluated_bounds(jersey)
        variants[side.lower()] = {
            'jersey': attachment(jersey),
            'stripe': attachment(stripe),
            'frontMark': attachment(front),
            'backNumbers': [attachment(obj) for obj in back_objects],
            'frameBounds': frame_bounds,
        }

    report = {
        'status': 'measured',
        'decision': 'supporting-evidence-only',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'sampleFrames': list(SAMPLE_FRAMES),
        'bones': bones,
        'variants': variants,
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_UNIFORM_DEFORMATION_AUDITED ' + str(output_report))


if __name__ == '__main__':
    main()
