import argparse
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
REFINE_PATH = SCRIPT_DIR / 'refine_vnext_neck_boundary.py'
SPEC = importlib.util.spec_from_file_location('vnext_neck_refine', REFINE_PATH)
refine = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(refine)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--refinement-report', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def main():
    args = parse_args()
    refinement_path = Path(args.refinement_report).resolve()
    output_path = Path(args.output_report).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    refinement = json.loads(refinement_path.read_text(encoding='utf-8'))

    body = bpy.data.objects.get(refine.BODY_NAME)
    armature = bpy.data.objects.get(refine.ARMATURE_NAME)
    if body is None or armature is None:
        raise RuntimeError('The private athlete source is missing the licensed body or rig.')
    if body.get('neck_boundary_revision') != refine.REVISION:
        raise RuntimeError('The workfile does not contain the expected licensed neck restoration.')

    reference = refine.load_reference_body(Path(refinement['referenceWorkfile']))
    reference_indices = refinement['referencePatchPolygonIndices']
    signatures = {
        refine.face_signature(reference.data, reference.data.polygons[index])
        for index in reference_indices
    }
    matched = [
        polygon
        for polygon in body.data.polygons
        if refine.face_signature(body.data, polygon) in signatures
    ]

    material_counts = Counter()
    smooth_counts = Counter()
    for polygon in matched:
        material = (
            body.data.materials[polygon.material_index]
            if polygon.material_index < len(body.data.materials)
            else None
        )
        material_counts[material.name if material else None] += 1
        smooth_counts[str(bool(polygon.use_smooth)).lower()] += 1

    uv_layers = []
    for layer in body.data.uv_layers:
        coordinates = [
            layer.data[loop_index].uv
            for polygon in matched
            for loop_index in polygon.loop_indices
        ]
        uv_layers.append({
            'name': layer.name,
            'active': layer == body.data.uv_layers.active,
            'activeRender': layer.active_render,
            'minimum': [
                round(min(coordinate[axis] for coordinate in coordinates), 6)
                for axis in range(2)
            ] if coordinates else None,
            'maximum': [
                round(max(coordinate[axis] for coordinate in coordinates), 6)
                for axis in range(2)
            ] if coordinates else None,
            'uniqueRoundedCoordinates': len({
                (round(coordinate.x, 5), round(coordinate.y, 5))
                for coordinate in coordinates
            }),
        })

    group_names = {group.index: group.name for group in body.vertex_groups}
    matched_vertices = {
        vertex_index
        for polygon in matched
        for vertex_index in polygon.vertices
    }
    unweighted = [
        index for index in matched_vertices
        if not body.data.vertices[index].groups
    ]
    missing_groups = [
        index for index in matched_vertices
        if any(membership.group not in group_names for membership in body.data.vertices[index].groups)
    ]
    shape_keys = getattr(body.data, 'shape_keys', None)

    report = {
        'status': 'private-neck-restoration-audited',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'revision': body.get('neck_boundary_revision'),
        'expectedPatchPolygons': len(reference_indices),
        'matchedPatchPolygons': len(matched),
        'matchedPatchVertices': len(matched_vertices),
        'patchMaterials': dict(sorted(material_counts.items(), key=lambda item: str(item[0]))),
        'patchSmoothPolygons': dict(sorted(smooth_counts.items())),
        'uvLayers': uv_layers,
        'unweightedPatchVertices': len(unweighted),
        'missingVertexGroups': len(missing_groups),
        'bodyVertices': len(body.data.vertices),
        'bodyPolygons': len(body.data.polygons),
        'shapeKeyCount': len(shape_keys.key_blocks) if shape_keys else 0,
        'shapeKeyVertexCounts': {
            block.name: len(block.data)
            for block in shape_keys.key_blocks
        } if shape_keys else {},
        'actionKeyCounts': refine.action_key_counts(),
        'reviewRule': (
            'The welded neck must preserve licensed UVs, complete rig weights, smooth shading, '
            'all facial shape keys, and every authored runtime action.'
        ),
    }
    bpy.data.objects.remove(reference, do_unlink=True)
    output_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_NECK_RESTORATION_AUDITED ' + str(output_path))


if __name__ == '__main__':
    main()
