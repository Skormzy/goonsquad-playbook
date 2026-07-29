import argparse
import json
import sys
from collections import Counter, deque
from pathlib import Path

import bpy


COLLECTIONS = (
    'GS_FieldPlayer_Source',
    'GS_Equipment_Home',
    'GS_Equipment_Away',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(values):
    return [round(value, 4) for value in values]


def local_bounds(obj):
    if not obj.data.vertices:
        return None
    minimum = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    maximum = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    return {
        'minimum': rounded(minimum),
        'maximum': rounded(maximum),
        'dimensions': rounded([maximum[index] - minimum[index] for index in range(3)]),
    }


def connected_component_count(mesh):
    adjacency = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        left, right = edge.vertices
        adjacency[left].append(right)
        adjacency[right].append(left)
    remaining = set(range(len(mesh.vertices)))
    count = 0
    while remaining:
        count += 1
        seed = remaining.pop()
        queue = deque([seed])
        while queue:
            current = queue.popleft()
            for neighbour in adjacency[current]:
                if neighbour in remaining:
                    remaining.remove(neighbour)
                    queue.append(neighbour)
    return count


def topology(obj):
    mesh = obj.data
    edge_faces = Counter()
    for polygon in mesh.polygons:
        vertices = list(polygon.vertices)
        for index, start in enumerate(vertices):
            end = vertices[(index + 1) % len(vertices)]
            edge_faces[tuple(sorted((start, end)))] += 1
    boundary_edges = sum(count == 1 for count in edge_faces.values())
    non_manifold_edges = sum(count != 2 for count in edge_faces.values())
    weighted_vertices = sum(bool(vertex.groups) for vertex in mesh.vertices)
    return {
        'vertices': len(mesh.vertices),
        'edges': len(mesh.edges),
        'faces': len(mesh.polygons),
        'connectedComponents': connected_component_count(mesh),
        'boundaryEdges': boundary_edges,
        'nonManifoldEdges': non_manifold_edges,
        'weightedVertices': weighted_vertices,
        'unweightedVertices': len(mesh.vertices) - weighted_vertices,
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
        'materials': [material.name if material else None for material in mesh.materials],
        'modifiers': [modifier.type for modifier in obj.modifiers],
        'bounds': local_bounds(obj),
    }


def main():
    args = parse_args()
    output = Path(args.output_report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if armature is None:
        raise RuntimeError('Missing GS_FieldPlayer_Rig.')

    collections = {}
    for collection_name in COLLECTIONS:
        collection = bpy.data.collections.get(collection_name)
        if collection is None:
            raise RuntimeError(f'Missing collection: {collection_name}')
        collections[collection_name] = {
            obj.name: topology(obj)
            for obj in collection.all_objects
            if obj.type == 'MESH'
        }

    report = {
        'status': 'measured',
        'decision': 'supporting-evidence-only',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'collections': collections,
        'bones': {
            bone.name: {
                'head': rounded(bone.head_local),
                'tail': rounded(bone.tail_local),
                'length': round(bone.length, 4),
            }
            for bone in armature.data.bones
            if bone.name.startswith('CC_Base_')
        },
    }
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_UNIFORM_TOPOLOGY_AUDITED ' + str(output))


if __name__ == '__main__':
    main()
