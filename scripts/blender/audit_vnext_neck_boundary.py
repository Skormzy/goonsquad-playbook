import argparse
import json
import sys
from collections import Counter, defaultdict, deque
from pathlib import Path

import bpy
from mathutils import Vector


BODY_NAME = 'CC_Base_Body'
ARMATURE_NAME = 'GS_FieldPlayer_Rig'
NECK_MIN_Z_CM = 145.0
NECK_MAX_Z_CM = 172.0
NECK_MAX_ABS_X_CM = 36.0


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--reference-workfile')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(vector):
    return [round(value, 6) for value in vector]


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


def evaluated_bounds(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    coordinates = [vertex.co for vertex in evaluated.data.vertices]
    minimum = Vector(min(coordinate[axis] for coordinate in coordinates) for axis in range(3))
    maximum = Vector(max(coordinate[axis] for coordinate in coordinates) for axis in range(3))
    return minimum, maximum


def boundary_components(mesh):
    edge_faces = Counter()
    for polygon in mesh.polygons:
        vertices = list(polygon.vertices)
        for index, start in enumerate(vertices):
            end = vertices[(index + 1) % len(vertices)]
            edge_faces[tuple(sorted((start, end)))] += 1

    boundary_edges = [edge for edge, count in edge_faces.items() if count == 1]
    adjacency = defaultdict(set)
    for first, second in boundary_edges:
        adjacency[first].add(second)
        adjacency[second].add(first)

    remaining = set(adjacency)
    components = []
    while remaining:
        root = remaining.pop()
        queue = deque([root])
        vertices = {root}
        while queue:
            vertex = queue.popleft()
            for neighbor in adjacency[vertex]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    vertices.add(neighbor)
                    queue.append(neighbor)
        components.append(vertices)
    return boundary_edges, sorted(components, key=len, reverse=True)


def component_record(mesh, vertices, evaluated_mesh=None):
    coordinates = [mesh.vertices[index].co for index in vertices]
    minimum = Vector(min(coordinate[axis] for coordinate in coordinates) for axis in range(3))
    maximum = Vector(max(coordinate[axis] for coordinate in coordinates) for axis in range(3))
    material_counts = Counter()
    polygons = []
    vertex_set = set(vertices)
    for polygon in mesh.polygons:
        if any(index in vertex_set for index in polygon.vertices):
            material_counts[polygon.material_index] += 1
            polygons.append(polygon.index)
    record = {
        'vertices': len(vertices),
        'minimumCm': rounded(minimum),
        'maximumCm': rounded(maximum),
        'spanCm': rounded(maximum - minimum),
        'materialPolygonCounts': dict(sorted(material_counts.items())),
        'polygonCount': len(polygons),
        'vertexSamples': [
            {'index': index, 'coordinateCm': rounded(mesh.vertices[index].co)}
            for index in sorted(vertices, key=lambda index: (
                mesh.vertices[index].co.z,
                mesh.vertices[index].co.x,
                mesh.vertices[index].co.y,
            ))[:160]
        ],
    }
    if evaluated_mesh is not None and len(evaluated_mesh.vertices) == len(mesh.vertices):
        evaluated_coordinates = [evaluated_mesh.vertices[index].co for index in vertices]
        evaluated_minimum = Vector(
            min(coordinate[axis] for coordinate in evaluated_coordinates) for axis in range(3)
        )
        evaluated_maximum = Vector(
            max(coordinate[axis] for coordinate in evaluated_coordinates) for axis in range(3)
        )
        record['evaluatedMinimumLocalCm'] = rounded(evaluated_minimum)
        record['evaluatedMaximumLocalCm'] = rounded(evaluated_maximum)
        record['evaluatedSpanCm'] = rounded(evaluated_maximum - evaluated_minimum)
    return record


def polygon_record(body, polygon):
    coordinates = [body.data.vertices[index].co for index in polygon.vertices]
    minimum_z = min(coordinate.z for coordinate in coordinates)
    maximum_z = max(coordinate.z for coordinate in coordinates)
    center = sum(coordinates, Vector()) / len(coordinates)
    material = body.data.materials[polygon.material_index] if polygon.material_index < len(body.data.materials) else None
    return {
        'index': polygon.index,
        'vertices': list(polygon.vertices),
        'centerCm': rounded(center),
        'minimumZCm': round(minimum_z, 6),
        'maximumZCm': round(maximum_z, 6),
        'zSpanCm': round(maximum_z - minimum_z, 6),
        'areaSqCm': round(polygon.area, 6),
        'materialIndex': polygon.material_index,
        'material': material.name if material else None,
    }


def coordinate_key(coordinate):
    return tuple(round(value, 4) for value in coordinate)


def face_signature(mesh, polygon):
    return tuple(sorted(coordinate_key(mesh.vertices[index].co) for index in polygon.vertices))


def reference_patch_analysis(body, boundary_edges, primary_component, reference_workfile):
    reference_path = Path(reference_workfile).resolve()
    if not reference_path.exists():
        raise RuntimeError(f'Reference workfile does not exist: {reference_path}')
    with bpy.data.libraries.load(str(reference_path), link=False) as (data_from, data_to):
        if BODY_NAME not in data_from.objects:
            raise RuntimeError('Reference workfile does not contain the licensed body object.')
        data_to.objects = [BODY_NAME]
    reference = data_to.objects[0]
    reference_mesh = reference.data

    current_signatures = {face_signature(body.data, polygon) for polygon in body.data.polygons}
    reference_signatures = {
        polygon.index: face_signature(reference_mesh, polygon)
        for polygon in reference_mesh.polygons
    }
    missing = {
        index
        for index, signature in reference_signatures.items()
        if signature not in current_signatures
    }

    primary = set(primary_component or [])
    primary_edges = [
        edge for edge in boundary_edges
        if edge[0] in primary and edge[1] in primary
    ]
    reference_edge_faces = defaultdict(list)
    for polygon in reference_mesh.polygons:
        indices = list(polygon.vertices)
        for edge_index, start in enumerate(indices):
            end = indices[(edge_index + 1) % len(indices)]
            key = tuple(sorted((
                coordinate_key(reference_mesh.vertices[start].co),
                coordinate_key(reference_mesh.vertices[end].co),
            )))
            reference_edge_faces[key].append(polygon.index)

    seed_polygons = set()
    matched_edges = 0
    for first, second in primary_edges:
        key = tuple(sorted((
            coordinate_key(body.data.vertices[first].co),
            coordinate_key(body.data.vertices[second].co),
        )))
        matches = reference_edge_faces.get(key, [])
        if matches:
            matched_edges += 1
        seed_polygons.update(index for index in matches if index in missing)

    polygon_adjacency = defaultdict(set)
    reference_index_edge_faces = defaultdict(list)
    for polygon in reference_mesh.polygons:
        indices = list(polygon.vertices)
        for edge_index, start in enumerate(indices):
            end = indices[(edge_index + 1) % len(indices)]
            reference_index_edge_faces[tuple(sorted((start, end)))].append(polygon.index)
    for polygons in reference_index_edge_faces.values():
        if len(polygons) == 2:
            first, second = polygons
            polygon_adjacency[first].add(second)
            polygon_adjacency[second].add(first)

    def allowed(index):
        polygon = reference_mesh.polygons[index]
        center = polygon.center
        return (
            index in missing
            and center.z >= 151.5
            and abs(center.x) <= 12.0
            and -12.0 <= center.y <= 13.0
        )

    selected = set(seed_polygons)
    queue = deque(seed_polygons)
    while queue:
        polygon = queue.popleft()
        for neighbor in polygon_adjacency[polygon]:
            if neighbor not in selected and allowed(neighbor):
                selected.add(neighbor)
                queue.append(neighbor)

    selected_vertices = {
        vertex
        for index in selected
        for vertex in reference_mesh.polygons[index].vertices
    }
    selected_coordinates = [reference_mesh.vertices[index].co for index in selected_vertices]
    selected_minimum = Vector(
        min(coordinate[axis] for coordinate in selected_coordinates) for axis in range(3)
    ) if selected_coordinates else Vector()
    selected_maximum = Vector(
        max(coordinate[axis] for coordinate in selected_coordinates) for axis in range(3)
    ) if selected_coordinates else Vector()
    selected_materials = Counter()
    for index in selected:
        polygon = reference_mesh.polygons[index]
        material = (
            reference_mesh.materials[polygon.material_index]
            if polygon.material_index < len(reference_mesh.materials)
            else None
        )
        selected_materials[material.name if material else None] += 1

    record = {
        'referenceWorkfile': str(reference_path),
        'referenceVertices': len(reference_mesh.vertices),
        'referencePolygons': len(reference_mesh.polygons),
        'matchedPrimaryBoundaryEdges': matched_edges,
        'primaryBoundaryEdges': len(primary_edges),
        'seedPolygons': sorted(seed_polygons),
        'seedPolygonCount': len(seed_polygons),
        'selectedPatchPolygons': sorted(selected),
        'selectedPatchPolygonCount': len(selected),
        'selectedPatchVertexCount': len(selected_vertices),
        'selectedPatchMinimumCm': rounded(selected_minimum),
        'selectedPatchMaximumCm': rounded(selected_maximum),
        'selectedPatchMaterials': dict(sorted(selected_materials.items(), key=lambda item: str(item[0]))),
        'referenceUvLayer': reference_mesh.uv_layers.active.name if reference_mesh.uv_layers.active else None,
        'selectionLimits': {
            'minimumZCm': 151.5,
            'maximumAbsXCm': 12.0,
            'minimumYCm': -12.0,
            'maximumYCm': 13.0,
        },
    }
    bpy.data.objects.remove(reference, do_unlink=True)
    return record


def main():
    args = parse_args()
    output = Path(args.output_report).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    body = bpy.data.objects.get(BODY_NAME)
    armature = bpy.data.objects.get(ARMATURE_NAME)
    ready = bpy.data.actions.get('ready')
    if body is None or armature is None or ready is None:
        raise RuntimeError('The private athlete is missing the body, rig, or ready action.')

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = ready
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()

    evaluated_body = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    boundary_edges, components = boundary_components(body.data)
    neck_components = []
    primary_neck_component = None
    for component in components:
        coordinates = [body.data.vertices[index].co for index in component]
        minimum_z = min(coordinate.z for coordinate in coordinates)
        maximum_z = max(coordinate.z for coordinate in coordinates)
        minimum_x = min(coordinate.x for coordinate in coordinates)
        maximum_x = max(coordinate.x for coordinate in coordinates)
        if maximum_z >= NECK_MIN_Z_CM and minimum_z <= NECK_MAX_Z_CM and minimum_x <= NECK_MAX_ABS_X_CM and maximum_x >= -NECK_MAX_ABS_X_CM:
            neck_components.append(component_record(body.data, component, evaluated_body.data))
            if primary_neck_component is None or len(component) > len(primary_neck_component):
                primary_neck_component = component

    neck_vertex_weights = []
    if primary_neck_component:
        group_names = {group.index: group.name for group in body.vertex_groups}
        for index in sorted(primary_neck_component, key=lambda vertex_index: (
            body.data.vertices[vertex_index].co.y,
            body.data.vertices[vertex_index].co.x,
        )):
            vertex = body.data.vertices[index]
            weights = [
                {
                    'group': group_names[membership.group],
                    'weight': round(membership.weight, 6),
                }
                for membership in sorted(vertex.groups, key=lambda item: item.weight, reverse=True)
                if membership.weight >= 0.001
            ]
            neck_vertex_weights.append({
                'index': index,
                'restCm': rounded(vertex.co),
                'evaluatedCm': rounded(evaluated_body.data.vertices[index].co),
                'weights': weights,
            })

    boundary_vertices = {index for edge in boundary_edges for index in edge}
    neck_polygons = []
    for polygon in body.data.polygons:
        if not any(index in boundary_vertices for index in polygon.vertices):
            continue
        record = polygon_record(body, polygon)
        center_x, _, center_z = record['centerCm']
        if NECK_MIN_Z_CM <= center_z <= NECK_MAX_Z_CM and abs(center_x) <= NECK_MAX_ABS_X_CM:
            neck_polygons.append(record)
    neck_polygons.sort(key=lambda item: (item['minimumZCm'], item['centerCm'][0], item['centerCm'][1]))

    intersecting_objects = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or obj.hide_render:
            continue
        minimum, maximum = evaluated_bounds(obj)
        if maximum.z < NECK_MIN_Z_CM or minimum.z > NECK_MAX_Z_CM:
            continue
        if maximum.x < -NECK_MAX_ABS_X_CM or minimum.x > NECK_MAX_ABS_X_CM:
            continue
        intersecting_objects.append({
            'name': obj.name,
            'vertices': len(obj.data.vertices),
            'polygons': len(obj.data.polygons),
            'minimumEvaluatedLocalCm': rounded(minimum),
            'maximumEvaluatedLocalCm': rounded(maximum),
            'materials': [material.name if material else None for material in obj.data.materials],
            'equipmentGroup': obj.get('equipment_group'),
            'armatureModifiers': [
                modifier.object.name if modifier.object else None
                for modifier in obj.modifiers
                if modifier.type == 'ARMATURE'
            ],
        })
    intersecting_objects.sort(key=lambda item: item['name'])

    report = {
        'status': 'private-neck-boundary-audited',
        'sourceWorkfile': bpy.data.filepath,
        'body': {
            'vertices': len(body.data.vertices),
            'polygons': len(body.data.polygons),
            'materials': [material.name if material else None for material in body.data.materials],
            'boundaryEdgeCount': len(boundary_edges),
            'boundaryComponentCount': len(components),
            'neckBoundaryComponents': neck_components,
            'primaryNeckVertexWeights': neck_vertex_weights,
            'neckBoundaryPolygons': neck_polygons,
        },
        'readyIntersectingObjects': intersecting_objects,
        'readyActionKeys': sum(len(fcurve.keyframe_points) for fcurve in action_fcurves(ready)),
        'reviewRule': (
            'The exposed jaw and neck silhouette must be repaired at the licensed body and garment '
            'boundary. A visible primitive cover is not an acceptable final repair.'
        ),
    }
    if args.reference_workfile:
        report['referencePatch'] = reference_patch_analysis(
            body,
            boundary_edges,
            primary_neck_component,
            args.reference_workfile,
        )
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_NECK_BOUNDARY_AUDITED ' + str(output))


if __name__ == '__main__':
    main()
