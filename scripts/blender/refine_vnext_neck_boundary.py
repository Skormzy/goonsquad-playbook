import argparse
import json
import sys
from collections import Counter, defaultdict, deque
from pathlib import Path

import bpy
from mathutils import Vector


BODY_NAME = 'CC_Base_Body'
ARMATURE_NAME = 'GS_FieldPlayer_Rig'
PATCH_NAME = 'GS_Licensed_Neck_Continuation'
REQUIRED_ACTIONS = {
    'ready',
    'jog',
    'jog-to-sprint-ik',
    'sprint',
    'turn',
    'stop',
    'receive',
    'pass',
    'shot',
}
REVISION = 'licensed-neck-boundary-restoration-v1'


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reference-workfile', required=True)
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


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


def action_key_counts():
    return {
        action.name: sum(len(fcurve.keyframe_points) for fcurve in action_fcurves(action))
        for action in bpy.data.actions
        if action.name in REQUIRED_ACTIONS
    }


def coordinate_key(coordinate):
    return tuple(round(value, 4) for value in coordinate)


def face_signature(mesh, polygon):
    return tuple(sorted(coordinate_key(mesh.vertices[index].co) for index in polygon.vertices))


def edge_face_counts(mesh):
    counts = Counter()
    for polygon in mesh.polygons:
        indices = list(polygon.vertices)
        for edge_index, start in enumerate(indices):
            end = indices[(edge_index + 1) % len(indices)]
            counts[tuple(sorted((start, end)))] += 1
    return counts


def boundary_components(mesh):
    counts = edge_face_counts(mesh)
    boundary_edges = [edge for edge, count in counts.items() if count == 1]
    adjacency = defaultdict(set)
    for first, second in boundary_edges:
        adjacency[first].add(second)
        adjacency[second].add(first)
    remaining = set(adjacency)
    components = []
    while remaining:
        root = remaining.pop()
        queue = deque([root])
        component = {root}
        while queue:
            vertex = queue.popleft()
            for neighbor in adjacency[vertex]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)
        components.append(component)
    return boundary_edges, sorted(components, key=len, reverse=True)


def primary_neck_component(body):
    boundary_edges, components = boundary_components(body.data)
    candidates = []
    for component in components:
        coordinates = [body.data.vertices[index].co for index in component]
        minimum = Vector(min(coordinate[axis] for coordinate in coordinates) for axis in range(3))
        maximum = Vector(max(coordinate[axis] for coordinate in coordinates) for axis in range(3))
        if maximum.z >= 157.0 and minimum.z <= 160.0 and minimum.x <= 8.0 and maximum.x >= -8.0:
            candidates.append(component)
    if not candidates:
        raise RuntimeError('The expected licensed-body neck boundary was not found.')
    component = max(candidates, key=len)
    edges = [edge for edge in boundary_edges if edge[0] in component and edge[1] in component]
    if len(component) != 64 or len(edges) != 64:
        raise RuntimeError('The licensed-body neck boundary topology changed unexpectedly.')
    return component, edges


def load_reference_body(reference_workfile):
    with bpy.data.libraries.load(str(reference_workfile), link=False) as (data_from, data_to):
        if BODY_NAME not in data_from.objects:
            raise RuntimeError('Reference workfile does not contain the licensed body object.')
        data_to.objects = [BODY_NAME]
    reference = data_to.objects[0]
    if reference is None:
        raise RuntimeError('Failed to load the licensed reference body.')
    return reference


def select_reference_patch(body, reference, primary_edges):
    current_signatures = {face_signature(body.data, polygon) for polygon in body.data.polygons}
    reference_mesh = reference.data
    missing = {
        polygon.index
        for polygon in reference_mesh.polygons
        if face_signature(reference_mesh, polygon) not in current_signatures
    }

    coordinate_edge_faces = defaultdict(list)
    index_edge_faces = defaultdict(list)
    for polygon in reference_mesh.polygons:
        indices = list(polygon.vertices)
        for edge_index, start in enumerate(indices):
            end = indices[(edge_index + 1) % len(indices)]
            coordinate_edge_faces[tuple(sorted((
                coordinate_key(reference_mesh.vertices[start].co),
                coordinate_key(reference_mesh.vertices[end].co),
            )))].append(polygon.index)
            index_edge_faces[tuple(sorted((start, end)))].append(polygon.index)

    seed_polygons = set()
    matched_edges = 0
    for first, second in primary_edges:
        edge_key = tuple(sorted((
            coordinate_key(body.data.vertices[first].co),
            coordinate_key(body.data.vertices[second].co),
        )))
        matches = coordinate_edge_faces.get(edge_key, [])
        if matches:
            matched_edges += 1
        seed_polygons.update(index for index in matches if index in missing)
    if matched_edges != len(primary_edges) or not seed_polygons:
        raise RuntimeError('The reference body does not match the current licensed neck boundary.')

    adjacency = defaultdict(set)
    for polygons in index_edge_faces.values():
        if len(polygons) == 2:
            first, second = polygons
            adjacency[first].add(second)
            adjacency[second].add(first)

    def allowed(index):
        center = reference_mesh.polygons[index].center
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
        for neighbor in adjacency[polygon]:
            if neighbor not in selected and allowed(neighbor):
                selected.add(neighbor)
                queue.append(neighbor)

    return sorted(selected), matched_edges, sorted(seed_polygons)


def remove_existing_patch():
    existing = bpy.data.objects.get(PATCH_NAME)
    if existing is None:
        return
    mesh = existing.data
    bpy.data.objects.remove(existing, do_unlink=True)
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)


def create_patch(body, armature, reference, polygon_indices):
    source_mesh = reference.data
    source_vertices = sorted({
        vertex
        for polygon_index in polygon_indices
        for vertex in source_mesh.polygons[polygon_index].vertices
    })
    index_map = {source: target for target, source in enumerate(source_vertices)}
    vertices = [source_mesh.vertices[index].co.copy() for index in source_vertices]
    faces = [
        [index_map[index] for index in source_mesh.polygons[polygon_index].vertices]
        for polygon_index in polygon_indices
    ]

    mesh = bpy.data.meshes.new(f'{PATCH_NAME}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    skin = bpy.data.materials.get('GS_PBR_Skin_Head')
    if skin is None:
        raise RuntimeError('The current licensed PBR head material is missing.')
    mesh.materials.append(skin)
    for polygon in mesh.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True

    source_uv = source_mesh.uv_layers.active
    if source_uv is None:
        raise RuntimeError('The licensed reference neck patch has no active UV layer.')
    target_uv_name = body.data.uv_layers.active.name if body.data.uv_layers.active else source_uv.name
    target_uv = mesh.uv_layers.new(name=target_uv_name)
    for target_polygon, source_polygon_index in zip(mesh.polygons, polygon_indices):
        source_polygon = source_mesh.polygons[source_polygon_index]
        if len(target_polygon.loop_indices) != len(source_polygon.loop_indices):
            raise RuntimeError('Neck patch loop topology changed during reconstruction.')
        for target_loop_index, source_loop_index in zip(
            target_polygon.loop_indices,
            source_polygon.loop_indices,
        ):
            target_uv.data[target_loop_index].uv = source_uv.data[source_loop_index].uv

    patch = bpy.data.objects.new(PATCH_NAME, mesh)
    body.users_collection[0].objects.link(patch)
    patch.parent = body.parent
    patch.matrix_parent_inverse = body.matrix_parent_inverse.copy()
    patch.location = body.location.copy()
    patch.rotation_mode = body.rotation_mode
    patch.rotation_euler = body.rotation_euler.copy()
    patch.scale = body.scale.copy()

    group_by_index = {group.index: group.name for group in reference.vertex_groups}
    target_groups = {
        name: patch.vertex_groups.new(name=name)
        for name in sorted(set(group_by_index.values()))
    }
    unweighted = []
    for target_index, source_index in enumerate(source_vertices):
        memberships = source_mesh.vertices[source_index].groups
        total = sum(membership.weight for membership in memberships)
        if total <= 0.0:
            unweighted.append(target_index)
            continue
        for membership in memberships:
            target_groups[group_by_index[membership.group]].add(
                [target_index], membership.weight / total, 'REPLACE'
            )
    if unweighted:
        raise RuntimeError(f'Licensed neck patch contains {len(unweighted)} unweighted vertices.')

    modifier = patch.modifiers.new('Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_deform_preserve_volume = True
    patch['equipment_group'] = 'licensed-body-restoration'
    patch['neck_boundary_revision'] = REVISION
    patch['source_reference'] = bpy.path.abspath(reference.library.filepath) if reference.library else ''
    return patch, source_vertices


def patch_topology(patch, body, primary_edges):
    patch_counts = edge_face_counts(patch.data)
    patch_boundary_keys = {
        tuple(sorted((
            coordinate_key(patch.data.vertices[first].co),
            coordinate_key(patch.data.vertices[second].co),
        )))
        for (first, second), count in patch_counts.items()
        if count == 1
    }
    body_primary_keys = {
        tuple(sorted((
            coordinate_key(body.data.vertices[first].co),
            coordinate_key(body.data.vertices[second].co),
        )))
        for first, second in primary_edges
    }
    coordinates = [vertex.co for vertex in patch.data.vertices]
    minimum = Vector(min(coordinate[axis] for coordinate in coordinates) for axis in range(3))
    maximum = Vector(max(coordinate[axis] for coordinate in coordinates) for axis in range(3))
    return {
        'vertices': len(patch.data.vertices),
        'polygons': len(patch.data.polygons),
        'boundaryEdges': len(patch_boundary_keys),
        'matchedLicensedBodyEdges': len(patch_boundary_keys & body_primary_keys),
        'expectedLicensedBodyEdges': len(body_primary_keys),
        'minimumCm': [round(value, 6) for value in minimum],
        'maximumCm': [round(value, 6) for value in maximum],
        'uvLayers': len(patch.data.uv_layers),
        'materials': [material.name if material else None for material in patch.data.materials],
        'unweightedVertices': sum(1 for vertex in patch.data.vertices if not vertex.groups),
    }


def mesh_boundary_summary(mesh):
    counts = edge_face_counts(mesh)
    return {
        'boundaryEdges': sum(count == 1 for count in counts.values()),
        'nonManifoldEdges': sum(count != 2 for count in counts.values()),
    }


def merge_patch_into_body(body, patch):
    patch_vertex_count = len(patch.data.vertices)
    shape_keys = getattr(body.data, 'shape_keys', None)
    shape_key_names = [block.name for block in shape_keys.key_blocks] if shape_keys else []
    shape_key_vertices_before = {
        block.name: len(block.data)
        for block in shape_keys.key_blocks
    } if shape_keys else {}
    before = {
        'vertices': len(body.data.vertices),
        'polygons': len(body.data.polygons),
        **mesh_boundary_summary(body.data),
        'shapeKeyCount': len(shape_key_names),
        'shapeKeyVertices': shape_key_vertices_before,
    }

    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    patch.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    if body.name != BODY_NAME:
        raise RuntimeError('The licensed body was not preserved as the active joined mesh.')

    body.active_shape_key_index = 0
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005, use_unselected=False)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    body.data.update()

    shape_keys = getattr(body.data, 'shape_keys', None)
    shape_key_names_after = [block.name for block in shape_keys.key_blocks] if shape_keys else []
    shape_key_vertices_after = {
        block.name: len(block.data)
        for block in shape_keys.key_blocks
    } if shape_keys else {}
    if shape_key_names_after != shape_key_names:
        raise RuntimeError('Joining the licensed neck patch changed the facial shape-key set.')
    if any(count != len(body.data.vertices) for count in shape_key_vertices_after.values()):
        raise RuntimeError('A facial shape key does not cover the welded licensed body topology.')

    _, components = boundary_components(body.data)
    remaining_neck_components = []
    for component in components:
        coordinates = [body.data.vertices[index].co for index in component]
        minimum = Vector(min(coordinate[axis] for coordinate in coordinates) for axis in range(3))
        maximum = Vector(max(coordinate[axis] for coordinate in coordinates) for axis in range(3))
        if maximum.z >= 157.0 and minimum.z <= 160.0 and minimum.x <= 8.0 and maximum.x >= -8.0:
            remaining_neck_components.append({
                'vertices': len(component),
                'minimumCm': [round(value, 6) for value in minimum],
                'maximumCm': [round(value, 6) for value in maximum],
            })
    if any(component['vertices'] == 64 for component in remaining_neck_components):
        raise RuntimeError('The original 64-vertex neck seam remains open after welding.')

    body['neck_boundary_revision'] = REVISION
    after = {
        'vertices': len(body.data.vertices),
        'polygons': len(body.data.polygons),
        **mesh_boundary_summary(body.data),
        'shapeKeyCount': len(shape_key_names_after),
        'shapeKeyVertices': shape_key_vertices_after,
        'remainingNeckBoundaryComponents': remaining_neck_components,
        'mergedVertices': (
            before['vertices'] + patch_vertex_count - len(body.data.vertices)
        ),
    }
    return body, {'before': before, 'after': after}


def main():
    args = parse_args()
    reference_workfile = Path(args.reference_workfile).resolve()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    if not reference_workfile.exists():
        raise RuntimeError(f'Missing licensed reference workfile: {reference_workfile}')

    source_workfile = bpy.data.filepath
    body = bpy.data.objects.get(BODY_NAME)
    armature = bpy.data.objects.get(ARMATURE_NAME)
    if body is None or armature is None:
        raise RuntimeError('The private athlete source is missing the licensed body or field-player rig.')

    counts_before = action_key_counts()
    if set(counts_before) != REQUIRED_ACTIONS:
        raise RuntimeError('The private athlete source is missing required runtime actions.')
    source_action_names = {action.name for action in bpy.data.actions}

    component, primary_edges = primary_neck_component(body)
    reference = load_reference_body(reference_workfile)
    polygon_indices, matched_edges, seed_polygons = select_reference_patch(
        body,
        reference,
        primary_edges,
    )
    remove_existing_patch()
    patch, source_vertices = create_patch(
        body,
        armature,
        reference,
        polygon_indices,
    )
    topology = patch_topology(patch, body, primary_edges)
    if topology['matchedLicensedBodyEdges'] != topology['expectedLicensedBodyEdges']:
        raise RuntimeError('The reconstructed licensed neck patch does not close the complete body seam.')
    patch_vertex_count = len(patch.data.vertices)
    body, weld = merge_patch_into_body(body, patch)
    expected_vertices = weld['before']['vertices'] + patch_vertex_count - len(primary_edges)
    if weld['after']['vertices'] != expected_vertices:
        raise RuntimeError(
            'The licensed neck weld merged an unexpected number of body vertices: '
            f"{weld['after']['vertices']} != {expected_vertices}."
        )

    counts_after = action_key_counts()
    if counts_after != counts_before:
        raise RuntimeError('Neck restoration changed authored action key counts.')

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = bpy.data.actions['ready']
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.context.scene['vnext_neck_status'] = 'licensed-boundary-restored-private-review'
    bpy.context.scene['vnext_neck_public_runtime_allowed'] = False
    bpy.data.objects.remove(reference, do_unlink=True)
    removed_reference_actions = []
    for action in list(bpy.data.actions):
        if action.name in source_action_names:
            continue
        removed_reference_actions.append(action.name)
        bpy.data.actions.remove(action, do_unlink=True)
    if {action.name for action in bpy.data.actions} != source_action_names:
        raise RuntimeError('Reference cleanup changed the source action set.')
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'licensed-neck-boundary-restored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': source_workfile,
        'referenceWorkfile': str(reference_workfile),
        'outputWorkfile': str(output_workfile),
        'revision': REVISION,
        'licensedBodyBoundaryVertices': len(component),
        'licensedBodyBoundaryEdges': len(primary_edges),
        'matchedReferenceEdges': matched_edges,
        'referenceSeedPolygons': len(seed_polygons),
        'referencePatchPolygons': len(polygon_indices),
        'referencePatchPolygonIndices': polygon_indices,
        'referencePatchVertices': len(source_vertices),
        'patchTopology': topology,
        'bodyWeld': weld,
        'removedReferenceActions': sorted(removed_reference_actions),
        'actionKeyCounts': {
            name: {'before': counts_before[name], 'after': counts_after[name]}
            for name in sorted(counts_before)
        },
        'reviewBoundary': (
            'The source-derived neck restoration remains private until close, all-action, export, '
            'runtime, cross-device, and explicit human visual review pass.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_NECK_BOUNDARY_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
