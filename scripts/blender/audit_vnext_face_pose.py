import argparse
import json
import math
import sys
from collections import defaultdict, deque
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def round_vector(vector):
    return [round(value, 6) for value in vector]


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
        component = [root]
        while queue:
            vertex = queue.popleft()
            for neighbor in adjacency[vertex]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.append(neighbor)
                    queue.append(neighbor)
        components.append(sorted(component))
    return sorted(components, key=len, reverse=True)


def component_summary(obj, indices):
    mesh = obj.data
    coordinates = [mesh.vertices[index].co for index in indices]
    minimum = Vector((min(coordinate[axis] for coordinate in coordinates) for axis in range(3)))
    maximum = Vector((max(coordinate[axis] for coordinate in coordinates) for axis in range(3)))
    center = sum(coordinates, Vector()) / len(coordinates)

    loops_by_vertex = defaultdict(list)
    uv_layer = mesh.uv_layers.active
    if uv_layer:
        for loop in mesh.loops:
            loops_by_vertex[loop.vertex_index].append(uv_layer.data[loop.index].uv.copy())
    uv_distances = []
    for index in indices:
        for uv in loops_by_vertex[index]:
            uv_distances.append((math.dist(uv, (0.5, 0.5)), index, uv))
    uv_distances.sort(key=lambda item: item[0])
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    evaluated_coordinates = [
        evaluated.matrix_world @ evaluated.data.vertices[index].co
        for index in indices
    ]
    evaluated_center = sum(evaluated_coordinates, Vector()) / len(evaluated_coordinates)
    evaluated_uv_center = None
    if uv_distances:
        evaluated_uv_center = (
            evaluated.matrix_world @ evaluated.data.vertices[uv_distances[0][1]].co
        )
    iris_samples = [
        {
            'distanceFromUvCenter': round(distance, 6),
            'vertex': index,
            'uv': round_vector(uv),
            'coordinateCm': round_vector(mesh.vertices[index].co),
        }
        for distance, index, uv in uv_distances[:8]
    ]
    front_cutoff = minimum.y + max(0.12, (maximum.y - minimum.y) * 0.12)
    front_indices = [index for index in indices if mesh.vertices[index].co.y <= front_cutoff]
    front_uvs = [uv for index in front_indices for uv in loops_by_vertex[index]]
    index_set = set(indices)
    material_counts = defaultdict(int)
    for polygon in mesh.polygons:
        if polygon.vertices[0] in index_set:
            material_counts[polygon.material_index] += 1
    return {
        'vertices': len(indices),
        'minimumCm': round_vector(minimum),
        'maximumCm': round_vector(maximum),
        'centerCm': round_vector(center),
        'evaluatedCenterWorld': round_vector(evaluated_center),
        'evaluatedUvCenterWorld': round_vector(evaluated_uv_center) if evaluated_uv_center else None,
        'evaluatedUvDirection': round_vector(
            (evaluated_uv_center - evaluated_center).normalized()
        ) if evaluated_uv_center else None,
        'frontVertexCount': len(front_indices),
        'frontMeanUv': round_vector(sum(front_uvs, Vector((0.0, 0.0))) / len(front_uvs)) if front_uvs else None,
        'materialPolygonCounts': dict(sorted(material_counts.items())),
        'uvCenterSamples': iris_samples,
    }


def shape_key_summary(obj):
    keys = getattr(obj.data, 'shape_keys', None)
    if keys is None:
        return []
    tokens = ('eye', 'blink', 'wink', 'squint', 'brow', 'look', 'lid')
    return [
        {
            'name': block.name,
            'value': round(block.value, 6),
            'sliderMin': round(block.slider_min, 6),
            'sliderMax': round(block.slider_max, 6),
        }
        for block in keys.key_blocks
        if any(token in block.name.lower() for token in tokens)
    ]


def action_fcurves(action):
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


def main():
    args = parse_args()
    output = Path(args.output_report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    eye = bpy.data.objects.get('CC_Base_Eye')
    body = bpy.data.objects.get('CC_Base_Body')
    if armature is None or eye is None or body is None:
        raise RuntimeError('The private athlete face source is incomplete.')

    eye_bones = []
    for pose_bone in armature.pose.bones:
        if 'eye' not in pose_bone.name.lower():
            continue
        rest_bone = armature.data.bones[pose_bone.name]
        eye_bones.append({
            'name': pose_bone.name,
            'parent': pose_bone.parent.name if pose_bone.parent else None,
            'restHeadCm': round_vector(rest_bone.head_local),
            'restTailCm': round_vector(rest_bone.tail_local),
            'rotationMode': pose_bone.rotation_mode,
            'rotationEuler': round_vector(pose_bone.rotation_euler),
            'rotationQuaternion': round_vector(pose_bone.rotation_quaternion),
            'locationCm': round_vector(pose_bone.location),
            'scale': round_vector(pose_bone.scale),
        })

    memberships = []
    for group in eye.vertex_groups:
        count = sum(
            1
            for vertex in eye.data.vertices
            if any(membership.group == group.index and membership.weight > 0 for membership in vertex.groups)
        )
        memberships.append({'name': group.name, 'weightedVertices': count})

    eye_action_channels = {}
    for action in bpy.data.actions:
        channels = [
            {
                'path': fcurve.data_path,
                'index': fcurve.array_index,
                'keys': len(fcurve.keyframe_points),
            }
            for fcurve in action_fcurves(action)
            if 'eye' in fcurve.data_path.lower()
        ]
        if channels:
            eye_action_channels[action.name] = channels

    report = {
        'status': 'private-face-pose-audited',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'eyeObject': {
            'components': [
                component_summary(eye, component)
                for component in connected_components(eye.data)
            ],
            'vertexGroups': memberships,
            'shapeKeys': shape_key_summary(eye),
            'activeUv': eye.data.uv_layers.active.name if eye.data.uv_layers.active else None,
            'uvLayers': [
                {
                    'name': layer.name,
                    'active': layer == eye.data.uv_layers.active,
                    'activeRender': layer.active_render,
                }
                for layer in eye.data.uv_layers
            ],
            'materials': [
                {
                    'index': index,
                    'name': material.name if material else None,
                    'useNodes': bool(material and material.use_nodes),
                    'surfaceRenderMethod': getattr(material, 'surface_render_method', None) if material else None,
                }
                for index, material in enumerate(eye.data.materials)
            ],
        },
        'bodyEyeShapeKeys': shape_key_summary(body),
        'eyeBones': eye_bones,
        'eyeActionChannels': eye_action_channels,
        'reviewRule': (
            'Licensed texture presence is not an approval gate. Iris direction, eyelid opening, '
            'rest-pose expression, all-action stability, and close runtime appearance must pass.'
        ),
    }
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_FACE_POSE_AUDITED ' + str(output))


if __name__ == '__main__':
    main()
