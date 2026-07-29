import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SIDES = ('Home', 'Away')
REQUIRED_ACTIONS = (
    'ready',
    'jog',
    'jog-to-sprint-ik',
    'sprint',
    'turn',
    'stop',
    'receive',
    'pass',
    'shot',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def round_vector(vector):
    return [round(value, 4) for value in vector]


def bounds(obj):
    minimum = Vector((min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    return {
        'minimumCm': round_vector(minimum),
        'maximumCm': round_vector(maximum),
        'dimensionsCm': round_vector(maximum - minimum),
    }


def action_key_counts():
    def fcurves(action):
        legacy = list(getattr(action, 'fcurves', []))
        if legacy:
            return legacy
        return [
            fcurve
            for layer in getattr(action, 'layers', [])
            for strip in getattr(layer, 'strips', [])
            for channelbag in getattr(strip, 'channelbags', [])
            for fcurve in channelbag.fcurves
        ]

    return {
        action.name: sum(len(fcurve.keyframe_points) for fcurve in fcurves(action))
        for action in bpy.data.actions
        if action.name in REQUIRED_ACTIONS
    }


def mesh_summary(obj):
    unweighted = sum(1 for vertex in obj.data.vertices if not vertex.groups)
    return {
        'name': obj.name,
        'vertices': len(obj.data.vertices),
        'faces': len(obj.data.polygons),
        'uvLayers': len(obj.data.uv_layers),
        'unweightedVertices': unweighted,
        'materials': [material.name for material in obj.data.materials if material],
        'bounds': bounds(obj),
        'equipmentGroup': obj.get('equipment_group'),
        'headDetailRevision': obj.get('head_detail_revision'),
    }


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)

    variants = {}
    for side in SIDES:
        prefix = f'GS_{side}_Helmet_'
        objects = sorted(
            (obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.name.startswith(prefix)),
            key=lambda obj: obj.name,
        )
        shell = bpy.data.objects.get(f'GS_{side}_Helmet_Shell')
        stripe = bpy.data.objects.get(f'GS_{side}_Helmet_Center_Stripe')
        if shell is None or stripe is None:
            raise RuntimeError(f'Missing {side} helmet shell or center stripe.')
        variants[side.lower()] = {
            'shell': mesh_summary(shell),
            'stripe': mesh_summary(stripe),
            'helmetMeshes': [mesh_summary(obj) for obj in objects],
            'detailObjectCount': sum(
                1 for obj in objects if obj.get('equipment_group') == 'helmet-detail'
            ),
        }

    cages = sorted(obj.name for obj in bpy.data.objects if '_Helmet_Cage_' in obj.name)
    report = {
        'status': 'private-head-detail-audited',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'variants': variants,
        'cageObjectCount': len(cages),
        'cageObjects': cages,
        'actionKeyCounts': action_key_counts(),
        'pbrHelmetMaterials': sorted(
            material.name
            for material in bpy.data.materials
            if material.name.startswith('GS_PBR_')
            and any(token in material.name for token in ('Plastic', 'Leather', 'Rubber'))
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_HEAD_DETAIL_AUDITED ' + str(output_report))


if __name__ == '__main__':
    main()
